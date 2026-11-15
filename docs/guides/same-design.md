# Same design, your content

Give the studio a video you like and say "make mine like this":

- **A motion graphics video**: its design is recreated scene by scene with your own script, logo,
  colours and language: each scene's timing, how it comes in, where its content and words sit and
  how big, which colour plays which role, how much it moves.
- **An edited video**: your footage is edited the same way: the same cut pace, punch-in zooms,
  captions (place, size, colours, one word or a phrase at a time), colour grade and music.

Only the design or the editing style is taken. The reference's artwork, logo, footage and words
never go into your video; the blueprint keeps measurements, and its frames are only for looking.

On the page: **New video**, add the video under **Reference**, then tick **Same design, my
content** (motion) or **Edit my footage the same way as this reference** (edit). The studio plans
the job from it; the two looks to pick from are skipped for a motion video (the look is the
reference's).

## Motion: the blueprint, the plan, the check

`pnpm tempoloom recreate study REFERENCE.mp4` reads the reference into `NAME-blueprint/`:

| In each scene | How it is found |
| --- | --- |
| Start, end, length | A lasting change of the whole picture (not one element moving), in colour, so two scenes as bright as each other are still told apart |
| How it comes in | A cut, a fade (through black), a flash (through white), a dissolve (each frame a mix of the two), or a move (a wipe, slide or zoom) |
| Where things sit | What differs from the background, as a 6x6 grid and a box ("top left, 48% wide") |
| Text | Where each line sits and how tall it is, with the media tools' text reader (`media setup`); never the words |
| Colours | The background, the ink (what stands out most from it) and the accent (the most colourful other) |
| Motion | Still, gentle or busy, and whether it builds in |

It writes `blueprint.json`, `blueprint.md` (a table of the scenes) and `sheet.jpg` (one frame per
scene, in order). If it finds too few or too many scenes, give their start times: `--scenes
2.5,5.1,7.4`.

`pnpm tempoloom recreate plan BLUEPRINT --script SCRIPT.txt` puts your content into the design:
your sentences share the scenes in order by their time; a last scene with a small mark in the
middle becomes your logo's; each of the reference's colours becomes one of yours of the same role
(a dark background stays dark, two different backgrounds stay different, words always readable at
4.5:1 or more); a scene is held longer when your words need it. Your brand's colours come from
`config/brand.json`, or `--primary --accent --background --text-color`.

`pnpm tempoloom recreate check BLUEPRINT VIDEO.mp4` measures a made video the same way and
compares it scene by scene: the number of scenes, each one's length, how it comes in, where its
content and words sit and how big, and that it uses your colours, not the reference's. Every
difference is one line ("Scene 2: the content sits top left; in the design it sits middle
centre"). It passes when every scene is laid out like the design and 85% of everything matches.
In a studio job the preview cannot be finished until it passes (`--job JOB` records the result).

## Footage: edit it the same way

`pnpm tempoloom recreate style REFERENCE.mp4` measures how it is edited:

- **Pace**: cuts a minute and the typical shot length.
- **Punch-ins**: at each cut, whether the picture after it is the one before enlarged (or reduced),
  how much, how often, and how long each is held.
- **Captions** (with the text reader): where they sit, how big, one word or a phrase at a time, in
  capitals or not, their colour, a lit word's colour, and a box behind them.
- **Colour**: brightness, contrast, colourfulness and warmth.
- **Music**: whether music with a beat plays under the voice.

`pnpm tempoloom recreate edit REFERENCE.mp4 FOOTAGE.mp4 [--transcript WORDS.json] [--plan]` makes
the automatic edit of your footage with those settings: pauses cut as tightly as the reference
cuts, punch-ins as often, as big and as long (each on the start of a word), its caption look, the
grade that takes your footage's colour toward the reference's (new `grade` operation), and music
when it has music. It reports how close it came (cut pace and colour, reference and yours).

## What it cannot do

- It reads design, not meaning: what a scene shows (a chart, an icon grid, a product shot) comes
  from the agent looking at `sheet.jpg`, and the studio's designers build your version of it.
- Text needs the media tools' text reader; without it, positions are read from the sheet.
- Footage styles it does not copy: b-roll, designed overlays and sound effects are the studio's
  own choices; an intro or outro card is noted, not rebuilt.
