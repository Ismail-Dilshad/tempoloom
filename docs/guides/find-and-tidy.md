# Find and tidy

One search over everything the studio keeps, one of each thing kept, and space cleared that the
studio can make again. On the page: the search box at the top of every screen, and **Find and
tidy** under Studio.

## Search

`pnpm tempoloom find WORDS [--kind video,scene,lesson,taught,clip] [--limit 20]`

| What | Found by |
| --- | --- |
| Videos the studio made (the gallery) | Their title and file name; what is said in them (from transcripts already made and edits by text; search never runs speech to text); how they look: their main colours, dark or bright, colourful or muted, wide, tall or square, short, medium or long, the kind of video |
| Scenes of motion videos | Their words and how each is built |
| Lessons | Their title, words and tags |
| Taught videos | Their title, your notes and marks, what their frames show, their colours and pace |
| Your clips (b-roll) | What each shot shows |

Every word counts and rare words count more; the start of a word matches (`cam` finds `camera`);
the whole phrase together counts most; a result missing a word still shows, lower. Each result says
where it was found (in its title, in what it says, in how it looks, in its notes). Kurdish, Arabic
and Persian are matched however they were typed: Arabic and Persian digits, the forms of yeh, kaf
and heh, and short vowel marks are evened out.

**What a video shows** (people, places, objects, what happens) is searched once someone has said it:
on the video's page in the Gallery (**What it shows**), or by the agent, which looks at a sheet of
frames from each: `pnpm tempoloom find unseen` lists the videos nobody described, each with its
sheet, and `find describe ID "TEXT" --agent` saves it. The studio does this when it finishes a video.
The sheet stays on this computer unless an agent looks at it: then it goes to that agent's model, as
any frame it checks does (Settings, What may leave this computer).

**What a video says** comes from transcripts already made. `pnpm tempoloom find listen` says how
many videos have sound but no words and what writing them would cost (ElevenLabs, $0.20 an hour of
sound as of 2026-11-14); `find listen --go` writes them within your budgets (`--yes` when it is more
than the amount you are asked about first). On the page: **Help search see and hear** on Find.

How a video looks is worked out once per file from three small frames and remembered
(`.tempoloom/find-looks.json`), so the first search after many new videos takes a moment.

## The same thing twice

`pnpm tempoloom tidy duplicates` groups:

- **Videos** that are the same: the identical file in two places, or the same picture exported
  again (another size or encode; eight small frames compared, the length within 1%). The one to
  keep: starred, then rated good, then the final, then one a studio job knows, then the sharpest
  (most pixels, then the larger file), then the newest.
- **Lessons** that say nearly the same thing (shared rare words, 72% alike or more), in the same
  domain, and both a "do" or both a "don't": a lesson and its opposite are never grouped. The one to
  keep: approved, then proven, then trial, then the one that worked most.

`pnpm tempoloom tidy keep videos|lessons KEEP-ID OTHER-ID...` keeps one. Other videos are deleted
when they are in the export folder or workspace and hidden otherwise; a starred video or one rated
good is never removed. Other lessons are retired (no longer used), and **History** can undo it.

## Space

`pnpm tempoloom tidy storage` lists, with each size and why:

| Kind | What |
| --- | --- |
| Old previews | Previews older than a week (of a video with its final, or just old), not starred, not rated good |
| Earlier renders | A motion project's renders before the latest (whose video was exported), and failed ones |
| Render caches | Cached renders and scenes of versions that changed since; made again if needed |
| Work files | The editor's step files after two days, temporary files after one |
| B-roll copies | Shots cut from your clips for edits by text a month ago; cut again if needed |

Never listed: finals, starred videos, videos rated good, transcripts and voice-overs (they cost
money to make again), your own clips, and anything outside the export folder and workspace.

`pnpm tempoloom tidy clear --token TOKEN [--only ID,ID]` clears what the list showed, in one step.
The token is the list's: if anything changed since it was shown, nothing is removed and the list
is shown again. On the page, untick what to keep, then **Clear**. Clearing cannot be undone.
