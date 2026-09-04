"""Render every spoken line in the activity to a local audio file.

The activity ships with no text-to-speech fallback: whatever this script writes
into smart-rain-roof-game/assets/voice/ is the only voice the lesson has. So the
lines are not duplicated here. They are parsed straight out of the source that
displays them, which makes it impossible for the audio to drift away from the
words on screen — if a line is reworded, the parse still finds it and the clip
is re-rendered.

Usage (needs GEMINI_API_KEY in the environment and ffmpeg on PATH):

    python tools/build_voice.py           # render only missing/changed clips
    python tools/build_voice.py --force   # re-render everything

Outputs:
    smart-rain-roof-game/assets/voice/<id>.mp3
    smart-rain-roof-game/js/voice-manifest.js   (generated; do not hand-edit)
"""

import argparse
import base64
import hashlib
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(os.path.dirname(__file__)))
GAME = os.path.join(ROOT, 'smart-rain-roof-game')
VOICE_DIR = os.path.join(GAME, 'assets', 'voice')
MANIFEST_JS = os.path.join(GAME, 'js', 'voice-manifest.js')

MODEL = 'gemini-2.5-flash-preview-tts'
ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % MODEL

# Two children. Leda and Puck are the youngest-reading voices in the set, which
# matters more than gender-matching for a KG-to-G3 audience.
VOICES = {'aisha': 'Leda', 'arjun': 'Puck'}

SAMPLE_RATE = 24000
MP3_BITRATE = '64k'          # mono speech; keeps the whole voice pack under ~1 MB

# Delivery notes go to the model as a style prompt, never into the audible text.
STYLE = ('Two Indian schoolchildren building an electronics project together. '
         'Read warmly and clearly at a relaxed pace, bright but not shouty, '
         'as if explaining to a friend.')
STYLE_HAPPY = ('Two Indian schoolchildren who have just succeeded at their '
               'electronics project. Read with delighted, grateful excitement.')


# --------------------------------------------------------------------------- #
# Line discovery
# --------------------------------------------------------------------------- #

def read(path):
    with open(path, encoding='utf-8') as fh:
        return fh.read()


def js_string(raw):
    """Decode a single-quoted JS literal. The sources use typographic quotes
    rather than escapes, so an escape here means the parser needs revisiting."""
    if '\\' in raw:
        raise SystemExit('unexpected escape in JS string, parser needs updating: %r' % raw[:80])
    return raw


def find_build_lines(ui_js):
    block = re.search(r'var BUILD_LINES = \[(.*?)\n  \];', ui_js, re.S)
    if not block:
        raise SystemExit('BUILD_LINES not found in js/ui.js')
    items = re.findall(r"^\s*'(.*)',?\s*$", block.group(1), re.M)
    if len(items) != 6:
        raise SystemExit('expected 6 BUILD_LINES, parsed %d' % len(items))
    # Speaker alternates with the build index; see _narrateBuild in js/ui.js.
    return [
        {'id': 'build-%d' % i,
         'who': 'aisha' if i % 2 == 0 else 'arjun',
         'text': js_string(t)}
        for i, t in enumerate(items)
    ]


def find_story_lines(story_js):
    block = re.search(r'var STEPS = \[(.*?)\n  \];', story_js, re.S)
    if not block:
        raise SystemExit('STEPS not found in js/story.js')
    steps = re.findall(r"\{ who: '(\w+)',.*?text: '(.*?)',", block.group(1), re.S)
    if len(steps) != 6:
        raise SystemExit('expected 6 story STEPS, parsed %d' % len(steps))
    return [
        {'id': 'story-%d' % i, 'who': who, 'text': js_string(text)}
        for i, (who, text) in enumerate(steps)
    ]


def find_landing_lines(index_html, ui_js):
    first = re.search(r'<p id="landingDialogue">(.*?)</p>', index_html, re.S)
    if not first:
        raise SystemExit('#landingDialogue not found in index.html')
    second = re.search(r"\$\('landingDialogue'\)\.textContent = '(.*?)';", ui_js)
    if not second:
        raise SystemExit('landing beat 2 assignment not found in js/ui.js')
    return [
        {'id': 'landing-1', 'who': 'aisha', 'text': first.group(1).strip()},
        {'id': 'landing-2', 'who': 'arjun', 'text': js_string(second.group(1))},
    ]


def find_finale_line(index_html):
    line = re.search(r'<p id="finaleLine"[^>]*>(.*?)</p>', index_html, re.S)
    if not line:
        raise SystemExit('#finaleLine not found in index.html — add the finale markup first')
    return [{'id': 'finale', 'who': 'team', 'text': line.group(1).strip(), 'happy': True}]


def collect_lines():
    ui_js = read(os.path.join(GAME, 'js', 'ui.js'))
    story_js = read(os.path.join(GAME, 'js', 'story.js'))
    index_html = read(os.path.join(GAME, 'index.html'))

    lines = []
    lines += find_landing_lines(index_html, ui_js)
    lines += find_build_lines(ui_js)
    lines += find_story_lines(story_js)
    lines += find_finale_line(index_html)

    for line in lines:
        text = re.sub(r'\s+', ' ', line['text']).strip()
        if not text:
            raise SystemExit('empty text for %s' % line['id'])
        line['text'] = text
    return lines


# --------------------------------------------------------------------------- #
# Speech shaping
# --------------------------------------------------------------------------- #

def split_for_duo(text):
    """Hand a two-speaker line to both children, split at the sentence boundary
    nearest the middle. The words are never changed, only who says them."""
    parts = re.findall(r'[^.!?]+[.!?]*\s*', text)
    if len(parts) < 2:
        return [('aisha', text)]
    best, best_gap = 1, None
    for i in range(1, len(parts)):
        gap = abs(len(''.join(parts[:i])) - len(''.join(parts[i:])))
        if best_gap is None or gap < best_gap:
            best, best_gap = i, gap
    return [('aisha', ''.join(parts[:best]).strip()),
            ('arjun', ''.join(parts[best:]).strip())]


# The TTS endpoint intermittently answers with a bare candidate and
# finishReason=OTHER — a refusal to speak that has nothing to do with the words,
# since the same text succeeds on a re-ask. Rewording the *instruction* around
# the line shakes it loose; the spoken text itself is never altered.
WRAPPERS = [
    '{style}\nSay this: {text}',
    '{text}',
    '{style}\n\n{text}',
    'Read this line aloud clearly: {text}',
]


def request_body(line, variant=0):
    style = STYLE_HAPPY if line.get('happy') else STYLE
    if line['who'] == 'team':
        turns = split_for_duo(line['text'])
        if len(turns) == 1:
            who, text = turns[0][0], turns[0][1]
            prompt = WRAPPERS[variant % len(WRAPPERS)].format(style=style, text=text)
            speech = {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICES[who]}}}
        else:
            script = '\n'.join('%s: %s' % (w.capitalize(), t) for w, t in turns)
            prompt = ('%s\nRead this conversation:\n%s' % (style, script)
                      if variant % 2 == 0 else script)
            speech = {'multiSpeakerVoiceConfig': {'speakerVoiceConfigs': [
                {'speaker': 'Aisha',
                 'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICES['aisha']}}},
                {'speaker': 'Arjun',
                 'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICES['arjun']}}},
            ]}}
    else:
        prompt = WRAPPERS[variant % len(WRAPPERS)].format(style=style, text=line['text'])
        speech = {'voiceConfig': {
            'prebuiltVoiceConfig': {'voiceName': VOICES[line['who']]}}}

    return {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': speech},
    }


# --------------------------------------------------------------------------- #
# Synthesis
# --------------------------------------------------------------------------- #

def attempt(line, key, variant=0):
    """One synthesis call. Returns audio bytes, or a reason string on a miss."""
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(request_body(line, variant)).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': key},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', 'replace').replace(key, '<KEY>')
        return 'HTTP %d %s' % (exc.code, detail[:300].replace('\n', ' '))
    except urllib.error.URLError as exc:
        return 'network: %s' % exc

    candidates = payload.get('candidates') or []
    if not candidates:
        return 'no candidates (%s)' % json.dumps(payload.get('promptFeedback', {}))[:200]

    cand = candidates[0]
    content = cand.get('content')
    if not content or not content.get('parts'):
        # The model can return a bare candidate with only a finishReason; that is
        # a transient refusal far more often than a real one, so report and retry.
        return 'empty candidate, finishReason=%s' % cand.get('finishReason')

    inline = content['parts'][0].get('inlineData') or content['parts'][0].get('inline_data')
    if not inline:
        return 'candidate carried no audio part'
    return base64.b64decode(inline['data'])


def synthesize(line, key, tries=8):
    last = None
    for i in range(tries):
        got = attempt(line, key, i)
        if isinstance(got, bytes):
            return got
        last = got
        print('       retry %d/%d after: %s' % (i + 1, tries - 1, last))
        time.sleep(min(20, 2 + 3 * i))
    raise SystemExit('%s: giving up after %d tries — %s' % (line['id'], tries, last))


def wav_bytes(pcm):
    """Wrap raw 16-bit mono PCM in a WAV header so ffmpeg needs no -f flags."""
    header = b'RIFF' + struct.pack('<I', 36 + len(pcm)) + b'WAVEfmt '
    header += struct.pack('<IHHIIHH', 16, 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16)
    header += b'data' + struct.pack('<I', len(pcm))
    return header + pcm


def to_mp3(pcm, out_path):
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'clip.wav')
        with open(wav, 'wb') as fh:
            fh.write(wav_bytes(pcm))
        cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
               '-ac', '1', '-b:a', MP3_BITRATE, out_path]
        subprocess.run(cmd, check=True)


def probe_duration(path):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=nw=1:nk=1', path],
        check=True, capture_output=True, text=True)
    return round(float(out.stdout.strip()), 2)


# --------------------------------------------------------------------------- #

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true', help='re-render every clip')
    ap.add_argument('--only', help='comma-separated clip ids')
    args = ap.parse_args()

    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        raise SystemExit('GEMINI_API_KEY is not set')

    os.makedirs(VOICE_DIR, exist_ok=True)
    lines = collect_lines()
    wanted = set(args.only.split(',')) if args.only else None

    state_path = os.path.join(VOICE_DIR, '.texts.json')
    try:
        with open(state_path, encoding='utf-8') as fh:
            state = json.load(fh)
    except (OSError, ValueError):
        state = {}

    manifest = []
    for line in lines:
        mp3 = os.path.join(VOICE_DIR, line['id'] + '.mp3')
        digest = hashlib.sha256(line['text'].encode('utf-8')).hexdigest()[:16]
        stale = args.force or not os.path.exists(mp3) or state.get(line['id']) != digest
        if wanted is not None and line['id'] not in wanted:
            stale = False

        if stale:
            print('render %-10s (%s) %s' % (line['id'], line['who'], line['text'][:58]))
            to_mp3(synthesize(line, key), mp3)
            state[line['id']] = digest
        else:
            print('keep   %-10s' % line['id'])

        manifest.append({
            'id': line['id'],
            'who': line['who'],
            'file': line['id'] + '.mp3',
            'seconds': probe_duration(mp3),
        })

    with open(state_path, 'w', encoding='utf-8') as fh:
        json.dump(state, fh, indent=2, sort_keys=True)

    body = json.dumps({m['id']: {'file': m['file'], 'who': m['who'], 'seconds': m['seconds']}
                       for m in manifest}, indent=2, sort_keys=True)
    with open(MANIFEST_JS, 'w', encoding='utf-8', newline='\r\n') as fh:
        fh.write('/* GENERATED by tools/build_voice.py — do not edit by hand.\n'
                 '   Every spoken line in the activity, rendered to a local file.\n'
                 '   There is no text-to-speech fallback: this is the whole voice track. */\n'
                 'window.SRR = window.SRR || {};\n'
                 'SRR.VOICE_BASE = \'assets/voice/\';\n'
                 'SRR.VOICE_CLIPS = %s;\n' % body)

    total = sum(os.path.getsize(os.path.join(VOICE_DIR, m['file'])) for m in manifest)
    print('\n%d clips, %.0f s, %.0f KB total' %
          (len(manifest), sum(m['seconds'] for m in manifest), total / 1024))


if __name__ == '__main__':
    main()
