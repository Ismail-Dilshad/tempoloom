# Your library, and learning from a channel

## Your library

The logos, music, sounds, pictures and clips you use again and again, in one place, described by what
they show or sound like, found from any job, and remembered with the jobs that used them.

```sh
pnpm tempoloom library add LOGO.svg TRACK.mp3 B-ROLL/ --about "..."   # files or whole folders
pnpm tempoloom library describe ID "our cafe storefront at night" --tags cafe
pnpm tempoloom library find "upbeat music"                           # or: "vertical photo", "orange logo"
pnpm tempoloom library use ID --job JOB                              # record it, get its file
pnpm tempoloom library list [--kind music] [--used]
pnpm tempoloom library remove ID                                     # your own file stays
```

- **What it knows by itself**: the kind (a see-through picture or an SVG is a logo; a sound over 20
  seconds is music), a picture's size, shape and main colours, a track's tempo and energy (calm,
  steady, lively), a clip's shots. Search uses all of it ("calm music", "transparent logo",
  "vertical photo", "red").
- **What you or the agent add**: what it shows or sounds like (the agent looks at the sheet and
  writes it with `--agent`), and tags.
- Pictures and sounds are copied into the library, so they are there for every job; clips stay
  where they are and join the b-roll library (split into shots, each described), so an edit can
  suggest them where what is said matches.
- The page's search box finds them too ("Your library").

The studio uses it: at the brief the director looks for your own material first, the sound designer
tries your music before the stock library, and the scene designer places your logos and pictures.

## Learn from a channel

Give a creator's channel (or a folder of their videos) and their latest videos are studied as one
style: what stays the same in every video is their signature, and what changes is noted.

```sh
pnpm tempoloom look channel https://www.youtube.com/@creator/shorts --name creator
pnpm tempoloom look channel https://www.youtube.com/@creator/shorts --name creator --confirm
pnpm tempoloom look channel CREATOR-VIDEOS/ --name creator
pnpm tempoloom make SCRIPT.txt --like channel-creator
```

- A link first lists the latest videos (20 by default, `--count`); with `--confirm` the first 45
  seconds of each (`--seconds`) are downloaded for study only, measured (cut pace, shot length, first
  cut, movement, brightness, colour, shape, background, music tempo, where the frame is busy) and
  deleted. Only the numbers are kept.
- The result: a look `channel-NAME` from the median of the videos (use it with `--like`; it steers,
  it never copies), `channel.md` with "the same in every video" and "what changes", and `sheet.jpg`
  with one frame of each video for the agent to look at and save what numbers cannot say (the hook,
  the type, the framing) as lessons.
- Channels that need a login use Reach's logins (`pnpm tempoloom reach login youtube`).
