# Your voice and footage: audio clean-up, colour matching, speaker labels

Three finishing tools for the user's own recordings. Each one measures first, fixes only what it
found, and measures again so the result says what changed. In a studio edit the footage analyst
runs the measurements and the finisher applies them.

## Audio clean-up

```sh
pnpm tempoloom media voice TALK.mp4 --plan     # what is wrong and what it would do
pnpm tempoloom media voice TALK.mp4            # TALK-clean.mp4 (the picture is copied untouched)
```

| It measures | How | What it does about it |
| --- | --- | --- |
| Background noise | the speech level over the level of the quiet parts | FFT noise reduction (and non-local means when it is bad), stronger the closer the noise is |
| Mains hum | 50 and 60 Hz against the frequencies beside them | narrow notches at the hum and three harmonics |
| Room echo | how long the sound takes to fall 20 dB after a word ends | the room between words turned down (a downward expander) |
| Uneven loudness | how much the voice's level moves from second to second | evened out over about 1.5 s; the pauses are not raised |
| Clipping | samples at full scale | reported (distortion cannot be fully undone) |

Rumble under 75 Hz is always removed. Override a choice: `--denoise 0.6`, `--hum 60`, `--echo 0.5`,
`--no-even`, `--deess 0.4` (harsh "s" sounds), `--loudness -16` (a podcast level). In an edit
list it is the `voice` operation (`--plan` prints it).

Echo inside the words stays: the clean-up turns the room down between words, which is where it is
heard most, but a voice recorded in a bare room still sounds like one.

## Colour matching

```sh
pnpm tempoloom media match CAM-A.mp4 CAM-B.mp4 CAM-C.mp4            # to the most typical clip
pnpm tempoloom media match CAM-B.mp4 CAM-C.mp4 --to CAM-A.mp4       # to a chosen clip
```

Each clip's colour is measured (the average and spread of red, green and blue, the black and white
points) from frames across it. Each other clip gets a per-channel curve that gives it the
reference's average colour and contrast (Reinhard's colour transfer), written as `NAME-matched.mp4`.
Without `--to`, the reference is the clip whose look is closest to all the others, so the least
changes. The difference before and after is reported (under 3 reads as one shoot). In an edit
list it is the `match` operation; `--strength 0.7` matches part of the way.

It matches the overall look. Mixed light inside a shot (a window on one side, a lamp on the
other) stays as it was.

## Speaker labels

```sh
pnpm tempoloom media speakers INTERVIEW.mp4 --names "Sara,Ali" --roles "Host,Guest" --bars
```

- **Who speaks when**: each stretch of speech is described by how it sounds (the spectrum's shape,
  MFCCs, and the pitch) and grouped with the stretches that sound alike. The number of voices is
  found, or given with `--count 3`. With a transcript (`--transcript WORDS.json` from `media
  transcribe`), the stretches follow the words; a transcript made with `--diarize` already says
  who speaks, and that is used as it is.
- **Names**: `--names` in the order people first speak; without names, an introduction in a
  speaker's first words ("I'm Sara", "my name is Ali") names them, else Speaker A, B.
- **On screen** (`--bars`): a name bar (the name, and the role under it) in the brand's colours and
  font, lower left, for four seconds when each speaker first speaks and again after a minute
  without them: `NAME-names.mp4`.
- **Captions with names**: with a transcript, `NAME.speakers.srt` starts each turn with the
  speaker's name. `NAME.speakers.json` keeps every turn.

Two voices that sound alike (the same pitch and a similar voice) can be taken for one: give
`--count`. Overlapping speech goes to whoever is louder.
