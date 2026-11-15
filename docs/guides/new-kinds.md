# New kinds of video: charts from data, lists and countdowns, photo stories

## Charts from data

Paste numbers and they become an animated chart scene in the video's own style.

```sh
pnpm tempoloom make SCRIPT.txt --chart DRINKS.txt                  # on the sentence that mentions it
pnpm tempoloom make SCRIPT.txt --chart SALES.csv --chart-for "grew" --chart-title "Sales ($K)"
pnpm tempoloom make --chart USERS.csv --title "Our users doubled"  # a chart video on its own
```

It reads what people paste: `Label: value` lines, `Label value`, a CSV or TSV table (the first column
the labels, one column per series, a header row if there is one), or JSON. Percent signs, currency
signs, `K`/`M`/`B`, thousands separators and Arabic-Indic or Persian digits are understood.

| The numbers | The chart |
| --- | --- |
| one value | a big number counting up, with its label |
| two values | the two side by side, counting, and the change between them (+150%) |
| values over time (years, months, quarters), more than 8, or several series | a line that draws itself through its points, the last value counting up |
| categories | bars that grow one after another while their values count; the biggest (or `--highlight LABEL`) in the accent colour |

Force one with `--chart-kind bar|line|count|compare`. A chart goes on the sentence that shares
its labels or numbers, else the first sentence with a figure; `--chart-for WORDS` chooses. Charts
are kept exactly: the art director never redesigns the user's data. Bars and values stay in the
left three quarters, clear of the platforms' buttons on a vertical video.

## Lists and countdowns

A script with its items numbered on their own lines becomes a list video:

```text
Top 3 reasons to walk every day.
1. Your heart gets stronger with every step.
2. Walking clears your head.
3. It costs nothing at all.
Start with ten minutes today.
```

`pnpm tempoloom make LIST.txt` finds the list (numbered `1.`, `2)`, `#3`, `Number 4:`; at least
three, in order). Each item is spoken without its number; on screen it has the number, `2 / 3`, and
a progress bar of the whole list (one segment per item: the ones seen filled, this one growing).
Every item has the same layout and the same length (the longest item's reading time), so the
list keeps one rhythm. Numbers counting down (5, 4, 3...) or "countdown" in the title make it a
countdown. The title and closing lines are designed as usual. `--no-list` makes an ordinary video;
`--list` insists. With a voice-over, the speech sets the timing.

Keep one item a line; an item of several sentences gets its number on its first sentence.

## Photo story

```sh
pnpm tempoloom media story PHOTOS/ --title "Our spring trip" --music SONG.mp3
pnpm tempoloom media story PHOTOS/ --order look --shape 16:9 --seconds 3
pnpm tempoloom media story PHOTOS/ --about ABOUT.json            # ordered by what they show
```

- **Order**: `date` (default) uses the camera's date inside the photo, else a date in the file name
  (`IMG_20240512_...`), else the file's date (the result says which photos had to be guessed);
  `look` walks from each photo to the most alike one; `about` groups photos whose descriptions
  share words (`ABOUT.json`: `{"beach.jpg": "the beach at sunset"}`, written by you or by the agent
  after looking at them), in date order within a group; `name`.
- **Moves**: every photo zooms gently, in and out by turns, towards where the eye goes in it (the
  most detailed, colourful part). A photo of the frame's own shape fills it; another shape sits
  on a blurred copy of itself, so nothing is cut off. Photos are turned upright from the camera's
  orientation.
- **Pace**: evenly (`--seconds`, or `--length` for the whole video), or with `--music` on its
  beats: each cut moves to the strongest hit near it. The music fades in and out.
- **Title**: `--title` over the first photo.
- Shapes: `9:16` (default), `16:9`, `1:1`, `4:5`.
