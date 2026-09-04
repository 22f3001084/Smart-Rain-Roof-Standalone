# Voice auditions

Why the two voices in `tools/build_voice.py` are the ones they are.

The prebuilt Gemini TTS voices are described by character — "upbeat", "firm",
"breezy" — never by accent, and how readily each one takes an accent instruction
varies a lot. Picking by name is guesswork, so `tools/audition_voice.py` renders
the same line through every candidate and asks a model to *name* the accent it
hears (asking "is this Indian?" invites a yes).

Sample line: *"Stand the rain sensor a foot above the roof on its round rod.
Keep its copper tracks facing the sky."*

## Male voices, for Arjun

`indian_score` is the judge's 0–10 rating of how clearly Indian English the
accent sounds.

| Voice | Accent heard | Score |
| --- | --- | --- |
| **Iapetus** | Indian English | **9**, 9 |
| Charon | Indian English | 9, 9 |
| Achird | Indian English | 8 |
| Rasalgethi | Indian English | 9, 7 |
| Algenib | Educated Indian English | 6 |
| Puck | General American / British English | **1, 0, 0** |
| Fenrir, Orus, Sadachbia, Zubenelgenubi, Enceladus, Umbriel, Alnilam, Schedar | General American | 0 |

Arjun shipped on **Puck** first, which is why his accent was wrong: it does not
carry Indian English at all. He is now on **Iapetus**.

## Female voices, for Aisha

| Voice | Accent heard | Score |
| --- | --- | --- |
| **Sulafat** | Indian English | **9** |
| Vindemiatrix | Indian English | 9 |
| Laomedeia | Indian English | 9 |
| Despina | Indian English | 8 |
| Erinome | Indian English | 7 |
| Callirrhoe | Indian English | 6 |
| Leda | Educated Indian English | 3 ("inconsistent") |
| Achernar | British English | 1 |
| Kore, Aoede, Autonoe | General American | 0 |

Aisha shipped on **Leda** first, which carried the accent only weakly and
unevenly. She is now on **Sulafat**, which is both a 9 and the warmest of the
three top scorers — the right register for the character who does the
encouraging.

## Why a gate rather than a better prompt

Two findings made a per-render check necessary:

1. **A bare-text retry variant was silently dropping the accent.** The retry
   logic rewords the instruction when the endpoint refuses to speak, and one
   variant was the line on its own — no style, no accent. Most lines need at
   least one retry, so most of the pack had been rendered with no accent
   instruction. Every variant now carries the style block.
2. **Even with the instruction present, the accent is stochastic.** The same
   voice and prompt can return Indian English on one call and General American
   on the next. One render is a coin toss.

So `build_voice.py` judges each render and re-renders until it clears
`ACCENT_MIN`, keeping the best attempt if none does. That is what makes the
shipped accent reproducible instead of lucky.

## Reproducing

```bash
python tools/audition_voice.py --speaker arjun
python tools/audition_voice.py --speaker aisha --voices Leda,Kore,Aoede
```

Sample clips land in this directory and are gitignored — they are working files,
not part of the package.
