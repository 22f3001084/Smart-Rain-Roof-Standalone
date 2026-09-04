"""Audition prebuilt TTS voices for a given accent, and score the results.

Picking a voice by name is guesswork — the prebuilt voices are described by
character ("upbeat", "firm"), not by accent, and how strongly each one takes an
accent instruction varies. So this renders the same line through every candidate
and asks a model to name the accent it hears, which turns the choice into
something checkable instead of a preference.

    python tools/audition_voice.py --speaker arjun
    python tools/audition_voice.py --speaker arjun --voices Puck,Orus,Achird

Writes the samples to tools/auditions/<speaker>-<voice>.mp3 so they can be
listened to as well; that directory is not part of the shipped package.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
import base64

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_voice as bv  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'auditions')
JUDGE_MODEL = 'gemini-2.5-flash'
JUDGE_ENDPOINT = ('https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent'
                  % JUDGE_MODEL)

# Male-reading voices from the prebuilt set, plus the two already in use so the
# scores have a baseline to sit against.
MALE_CANDIDATES = ['Puck', 'Fenrir', 'Orus', 'Iapetus', 'Achird', 'Algenib',
                   'Sadachbia', 'Zubenelgenubi', 'Enceladus', 'Umbriel', 'Charon',
                   'Rasalgethi', 'Alnilam', 'Schedar']
FEMALE_CANDIDATES = ['Leda', 'Kore', 'Aoede', 'Callirrhoe', 'Autonoe', 'Despina',
                     'Erinome', 'Laomedeia', 'Achernar', 'Gacrux', 'Pulcherrima',
                     'Vindemiatrix', 'Sulafat', 'Zephyr']

SAMPLE = ('Stand the rain sensor a foot above the roof on its round rod. '
          'Keep its copper tracks facing the sky.')


def judge(path, key):
    """Ask for the accent by name. Deliberately open-ended rather than
    'is this Indian?', which invites a yes."""
    with open(path, 'rb') as fh:
        audio = base64.b64encode(fh.read()).decode('ascii')
    prompt = (
        'Listen to this speech sample and identify the speaker\'s accent.\n'
        'Reply as strict JSON only, no prose:\n'
        '{"accent": "<the accent you hear, e.g. Indian English, General American, '
        'British RP, Australian>", "indian_score": <0-10 integer, how clearly '
        'Indian English the accent sounds>, "age": "<child, teenager or adult>", '
        '"notes": "<one short phrase>"}'
    )
    body = {
        'contents': [{'parts': [
            {'text': prompt},
            {'inlineData': {'mimeType': 'audio/mp3', 'data': audio}},
        ]}],
        'generationConfig': {'temperature': 0},
    }
    req = urllib.request.Request(
        JUDGE_ENDPOINT,
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': key},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as exc:
        return {'error': 'HTTP %d %s' % (exc.code, exc.read()[:160])}

    cand = (payload.get('candidates') or [{}])[0]
    parts = (cand.get('content') or {}).get('parts') or []
    text = ''.join(p.get('text', '') for p in parts).strip()
    match = re.search(r'\{.*\}', text, re.S)
    if not match:
        return {'error': 'unparsable verdict: %s' % text[:120]}
    try:
        return json.loads(match.group(0))
    except ValueError:
        return {'error': 'bad JSON: %s' % match.group(0)[:120]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--speaker', default='arjun', choices=['aisha', 'arjun'])
    ap.add_argument('--voices', help='comma-separated voice names to try')
    ap.add_argument('--text', default=SAMPLE)
    args = ap.parse_args()

    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        raise SystemExit('GEMINI_API_KEY is not set')

    if args.voices:
        candidates = args.voices.split(',')
    else:
        candidates = MALE_CANDIDATES if args.speaker == 'arjun' else FEMALE_CANDIDATES

    os.makedirs(OUT_DIR, exist_ok=True)
    rows = []
    for voice in candidates:
        path = os.path.join(OUT_DIR, '%s-%s.mp3' % (args.speaker, voice))
        line = {'id': 'audition-%s' % voice, 'who': args.speaker, 'text': args.text}
        try:
            # Render through the real pipeline so the audition hears exactly what
            # the lesson would ship.
            saved = bv.VOICES[args.speaker]
            bv.VOICES[args.speaker] = voice
            try:
                bv.to_mp3(bv.synthesize(line, key), path)
            finally:
                bv.VOICES[args.speaker] = saved
        except SystemExit as exc:
            print('%-16s render failed: %s' % (voice, exc))
            continue

        verdict = judge(path, key)
        score = verdict.get('indian_score')
        rows.append((voice, score if isinstance(score, int) else -1, verdict))
        print('%-16s %-18s indian=%-4s age=%-10s %s' % (
            voice, verdict.get('accent', verdict.get('error', '?')),
            score, verdict.get('age', '?'), verdict.get('notes', '')[:44]))

    rows.sort(key=lambda r: r[1], reverse=True)
    print('\nbest for %s:' % args.speaker)
    for voice, score, verdict in rows[:5]:
        print('  %-16s indian=%-4s %s' % (voice, score, verdict.get('accent')))


if __name__ == '__main__':
    main()
