# Teach: train the brain with videos

`pnpm tempoloom teach` lets you teach Tempoloom with videos you choose. A video is copied to a
study folder, measured and looked at by your agent with your prompt. Numbers and lessons go to the
[brain](brain.md). A video you upload is kept in `.tempoloom/teach-originals/`; a video from a
link is not kept. Your original file is never touched.

```bash
pnpm tempoloom teach open          # the Teach page (this computer only)
# in the agent's terminal, after you taught videos: "study the videos I taught"
pnpm tempoloom teach next          # what the agent runs
```

## The Teach page

`teach open` prints a link like `http://127.0.0.1:4747/?k=…` and opens it. The page listens on
this computer only and needs the key in the link. The same server has the
[Studio page](studio.md#the-studio-page). Teaching happens on **Learn**, beside Create (the
Create · Learn switch above the prompt box):

- **Add a video** in Learn's prompt: press + or drop a file (up to 2 GB; `TEACH_MAX_MB` changes it),
  or paste a link (needs `pnpm media:setup`; a post with several videos asks which one). The
  video shows in the prompt and a drawer opens beside the page.
- **Say what to learn** in the drawer: Motion design or Footage editing, a **good** example or
  what to avoid, the focus (pacing, transitions, motion, typography, colour, layout, hook and
  script, captions, editing), the part (whole clip, first 5 s or 10 s), and whether to study the
  sound and write down what is said (ElevenLabs).
- **Send** teaches it. Words in the prompt become the study direction; with none, one is written
  from your choices.

Teach and the [Studio](studio.md#the-studio-page) are one app ([its design](studio-page.md)): a rail
with five places, Create as the home page, a bell that always shows what to tell your agent, and a
dark interface. What you teach lives in two places:

- **Learn**: every video it learned from as a card, with one search and one filter (good or bad,
  category, not studied yet); open one (double-click, or its ••• menu) for what it learned and its
  lessons (measurements under Details), rename it, or compare it with another. Click cards (or drag
  a box) to pick them; the search row becomes a bar to **use them in Create** (one or two become the
  style of your next video), **learn one again** (its kept video or its link comes back into the
  prompt), give them **better names** (the page's model writes them; without one, the job is
  copied for your terminal agent, which uses `teach rename`), or **remove** them, keeping their
  lessons in the Brain or forgetting them too.
- **Brain, Lessons**: status chips (on trial, kept, removed), search, one card per topic with a
  confidence bar on every lesson, keep all on trial at once, write a lesson yourself (kept at
  once), and export everything as Markdown. Every lesson has Keep, Reword and Remove; a lesson
  that contradicts something known waits in a "To decide" card.
- **Patterns**: what your good examples share, one card per measurement: the range, a bar with
  each good example and the typical value, and a line saying what it means.

Everything is sorted by itself. Lessons, patterns and taught videos fall into two groups by
their topics: **motion design** (motion, typography, design, colour, and the hook, script and
captions) and **footage editing** (editing, pacing, transitions, audio); the pages start with
the same tiles to choose one. A taught video also gets style tags from its
measurements (fast or slow cuts, calm or busy motion, dark or light look, vivid or muted colour,
cut to the beat, shape), and the Library filters by them.

## What happens to a video

| Step | Where | What |
| --- | --- | --- |
| 1. Arrives | `workspace/teach/<id>/` | The upload and a small preview for the page |
| 2. Sent | same | The chosen part is cut and cropped (720 px); the upload moves to `.tempoloom/teach-originals/` (a video from a link is deleted) and the preview is deleted |
| 3. Measured | same | Numbers, a fingerprint, frame sheets for the agent |
| 4. Studied | agent's terminal | `teach next` → the agent opens the sheets → `teach learn` for each lesson |
| 5. Finished | — | `teach finish` deletes the study folder. Kept: your uploaded video in `.tempoloom/teach-originals/`, measurements and lessons in the brain (`agent/brain/videos.jsonl`), a small still in `.tempoloom/` for the page. `teach forget ID` removes the kept video too |

"Finish now" on the page does step 5 without the agent: the measurements still count.

## What is measured (FFmpeg only, nothing to install)

| Part | Numbers |
| --- | --- |
| Pacing | Hard cuts and their times, cuts per minute, typical shot length, the first cut |
| Motion | How much changes inside shots (not the cuts), share of still time, bursts, the busiest moment |
| Colour | Brightness, saturation, contrast, the main colours, background and accent |
| Layout | Fine detail, where it sits (top, middle, bottom), an 8×8 light map |
| Sound | Tempo, sound events a second, loudness, share of cuts on a beat against chance |
| Speech (optional) | Words a second, words in the first 3 seconds |

Text on screen is not measured; the agent reads it from the frame sheets.

## How learning stays clean

1. **Trial first.** A lesson from a video starts on trial. The agent tries it when it fits; two
   approved jobs make it proven (see the brain's scoring). "Keep" on the page approves it now.
2. **Noise is dropped.** Too vague ("the video looks nice"), or about a topic you did not tick:
   not saved, and listed on the page with the reason.
3. **Repeats merge.** A lesson already known (by its rare shared words) is not copied: the video
   becomes one more piece of evidence and the lesson's confidence rises. Seen in three taught
   videos, a trial lesson is approved.
4. **Opposites are flagged.** A lesson that says the opposite of something known is kept on trial
   and shown under "To decide". Against one of your own feedback rules, your rule wins.
5. **Removed stays removed.** A lesson you removed is never learned again from another video.
6. **Patterns need agreement.** For each measurement, when at least three good examples that
   were taught for that topic agree, their range becomes a pattern ("Shots last 1 to 1.1 seconds
   in your good examples"). A video far from the rest is left out; when the examples disagree
   there is no pattern. Two or more bad examples outside the range add what to stay away from.

Lessons carry their topics, so the [studio](studio.md) gives each to the role that owns the
topic. A lesson is a way of working, never the video's own words, logo, people or story.

## Videos like this one

`teach similar ID|FILE` compares fingerprints (pacing, motion, colour, sound, layout) and lists
the most alike taught videos with what they taught. The page shows the same under each video.
It compares measurements; it does not recognise objects or meaning.

## Commands

```bash
pnpm tempoloom teach open [--port 4747] [--no-browser]
pnpm tempoloom teach add clip.mp4 --topics pacing,audio --prompt "learn the cut rhythm" --start 2 --end 14 --mark "5.2:this transition"
pnpm tempoloom teach add clip.mp4 --bad --topics typography          # a bad example
pnpm tempoloom teach next                                            # the next video to study
pnpm tempoloom teach learn ID --topic pacing "Cut on the beat, about once a second at 120 BPM."
pnpm tempoloom teach finish ID
pnpm tempoloom teach list | show ID | similar ID | patterns
pnpm tempoloom teach keep LESSON | remove LESSON | forget ID
pnpm tempoloom teach rename ID "NAME"
```
