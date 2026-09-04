"""Transcribe every rendered clip and compare it with the line it should say.

Worth doing because the delivery notes are sent to the model as part of the
prompt: if it ever decides to read the instruction instead of the line, the audio
sounds fine and says the wrong thing. This catches that, along with truncated and
mis-rendered clips.

    python tools/verify_voice.py
"""

import base64
import difflib
import json
import os
import re
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_voice import GAME, VOICE_DIR, collect_lines  # noqa: E402

MODEL = 'gemini-2.5-flash'
ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % MODEL
PASS_RATIO = 0.85


# A spoken script spells numbers out ("ninety degrees") and a transcript writes
# them as digits ("90 degrees"). Without folding the two together, a perfectly
# correct clip scores near zero on the diff. Longest forms first so "five
# hundred" is not eaten by "five".
NUMBER_WORDS = [
    ('five hundred', '500'), ('seventeen', '17'), ('ninety', '90'),
    ('eighty', '80'), ('seventy', '70'), ('sixty', '60'), ('fifty', '50'),
    ('forty', '40'), ('thirty', '30'), ('twenty', '20'), ('twelve', '12'),
    ('eleven', '11'), ('ten', '10'), ('nine', '9'), ('eight', '8'),
    ('seven', '7'), ('six', '6'), ('five', '5'), ('four', '4'),
    ('three', '3'), ('two', '2'), ('one', '1'), ('zero', '0'),
]


def normalise(text):
    text = text.lower().replace('’', "'").replace('—', ' ').replace('–', ' ')
    text = text.replace('°', ' degrees ').replace('%', ' percent ')
    text = re.sub(r'[^a-z0-9\' ]+', ' ', text)
    text = ' '.join(text.split())
    for word, digit in NUMBER_WORDS:
        text = re.sub(r'\b%s\b' % word, digit, text)
    # "milliseconds" vs "ms" is a transcription choice, not a reading error.
    text = re.sub(r'\bmilliseconds?\b', 'ms', text)
    return ' '.join(text.split())


def transcribe(path, key):
    with open(path, 'rb') as fh:
        audio = base64.b64encode(fh.read()).decode('ascii')
    body = {
        'contents': [{'parts': [
            {'text': 'Transcribe this audio verbatim. Output only the spoken words.'},
            {'inlineData': {'mimeType': 'audio/mp3', 'data': audio}},
        ]}],
        'generationConfig': {'temperature': 0},
    }
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': key},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', 'replace').replace(key, '<KEY>')
        return None, 'HTTP %d %s' % (exc.code, detail[:200].replace('\n', ' '))

    cand = (payload.get('candidates') or [{}])[0]
    content = cand.get('content') or {}
    parts = content.get('parts') or []
    if not parts:
        return None, 'no transcript (finishReason=%s)' % cand.get('finishReason')
    return ''.join(p.get('text', '') for p in parts).strip(), None


def main():
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        raise SystemExit('GEMINI_API_KEY is not set')

    failures = []
    for line in collect_lines():
        path = os.path.join(VOICE_DIR, line['id'] + '.mp3')
        if not os.path.exists(path):
            failures.append((line['id'], 0.0, 'clip missing'))
            continue

        heard, err = transcribe(path, key)
        if err:
            failures.append((line['id'], 0.0, err))
            print('%-10s ?? %s' % (line['id'], err))
            continue

        want, got = normalise(line['text']), normalise(heard)
        ratio = difflib.SequenceMatcher(None, want, got).ratio()
        flag = 'ok  ' if ratio >= PASS_RATIO else 'FAIL'
        print('%-10s %s %.2f  %s' % (line['id'], flag, ratio, got[:70]))
        if ratio < PASS_RATIO:
            failures.append((line['id'], ratio, got))

    print()
    if failures:
        print('%d clip(s) did not match their line:' % len(failures))
        for cid, ratio, got in failures:
            print('  %-10s %.2f  %s' % (cid, ratio, got[:120]))
        sys.exit(1)
    print('every clip says its line')


if __name__ == '__main__':
    main()
