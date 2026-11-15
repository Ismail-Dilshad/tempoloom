# Artist: paintings and drawings made like an artist makes them

Tempoloom paints and draws in pencil, charcoal, ink, watercolour, gouache, oil, acrylic and pastel.
It is not an image generator: every picture is made of real marks (pencil lines, washes that
bleed and dry with dark edges, bristle strokes that run out of paint, thick paint lit from one
side), laid down in the order a painter works, with a picture after every pass and a timelapse of
it being painted.

On the page: **New video**, then **A painting or drawing**. Say what it should show, pick a
medium (or let the studio choose), and add your own photos to paint from if you like. The studio
plans it as a painting job: a concept artist makes three value studies to choose from, the artist
paints the one you pick, an independent reviewer critiques it, and you approve it.

## How the artist works

1. **Concept.** Three small value studies of different compositions (`paint render PLAN --study`):
   the centre of interest on a third, one value family leading, the eye's path to the focus.
2. **Drawing.** Light construction lines.
3. **Block-in.** The big shapes and colours with big brushes.
4. **Colour and form.** Middle values, shape by shape.
5. **Details.** Smaller brushes, only where the eye goes.
6. **Finish.** Accents, a glaze, impasto light on thick paint.

After every pass the artist looks at the picture (`paint render PLAN --upto N`) and fixes the plan
before going on. The medium sets the rules (`paint media MEDIUM`):

| Medium | Order | Rules it keeps |
| --- | --- | --- |
| Watercolour | light to dark | the paper is the lightest light; a light cannot cover a dark; few layers |
| Oil, acrylic | dark to light, thin to thick | a toned ground; thick paint and the knife last (fat over lean) |
| Pencil | light pressure to dark | hatching follows the form; the lightest lights stay paper |
| Charcoal | mass, then line | smudge most edges, sharpen a few |
| Ink | contours, then hatching | line weight thicker in shadow and in front |

## The commands

```sh
pnpm tempoloom paint media watercolor            # the medium's order, marks and rules
pnpm tempoloom paint new "Evening lake" --medium watercolor --size 1080x1350
pnpm tempoloom paint lint PLAN.json              # the plan against how artists work
pnpm tempoloom paint render PLAN.json --study    # a quick value study (a third of the size, values only)
pnpm tempoloom paint render PLAN.json --upto 2   # paint to pass 2 and stop to look
pnpm tempoloom paint render PLAN.json --timelapse --seconds 20 --shape 9:16
pnpm tempoloom paint from PHOTO.jpg --style oil --timelapse
pnpm tempoloom paint check FOLDER [--reference PHOTO] [--job JOB]
```

`paint render` writes `painting.png`, `passes/NN-NAME.png` (the picture after each pass),
`render.json` and, with `--timelapse`, `timelapse.mp4`: the painting appearing over the seconds you
give, then held for two seconds. `--shape 9:16` (or 1:1, 16:9) puts it on a page of the paper's
colour for a short.

`paint from` paints your photo with Hertzmann's layered-brush method: big brushes first over the
whole picture, then smaller ones only where the canvas still differs from the photo, each stroke
curving along the photo's edges. Styles: `oil`, `impressionist`, `expressionist`, `gouache`,
`pointillist`, `watercolor`, `pencil`, `charcoal`, `ink`. It writes the plan too, so you can add
passes of your own (a glaze, accents) and paint it again.

## The plan

A plan is JSON: the canvas, then passes, each a list of marks. Coordinates are canvas pixels from
the top left; a point is `[x, y]` or `[x, y, pressure]`.

```json
{"title": "Evening lake", "medium": "watercolor", "seed": 11,
 "canvas": {"width": 1080, "height": 1350, "paper": "cold-press", "ground": "#f8f5ee"},
 "passes": [
  {"name": "Drawing", "kind": "drawing", "marks": [
    {"kind": "line", "tool": "2H", "color": "#8a8478", "size": 0.6, "points": [[0, 760], [1080, 760]]}]},
  {"name": "Sky wash", "kind": "block-in", "marks": [
    {"kind": "shape", "rect": [-20, -20, 1120, 790], "fill": {"color": "#f2c38b", "opacity": 0.55, "bleed": 0.5}}]},
  {"name": "Pines", "kind": "detail", "marks": [
    {"kind": "brushwork", "points": [[150, 330], [235, 760], [65, 760]], "brush": "wash",
     "colors": [["#2f4a3c", 3], "#1f3029"], "size": 22, "length": 34, "density": 2.2}]}]}
```

| Mark | What it is |
| --- | --- |
| `line` | A drawn line: `pen`, `rotring`, `2B`, `HB`, `2H`, `cpencil`, `pastel`, `crayon`, `charcoal`, `spray`, `marker` |
| `ink` | An ink line that swells and tapers with pressure |
| `shape` | An area (`points`, `ellipse` [cx, cy, rx, ry] or `rect` [x, y, w, h]) with a watercolour `fill` (bleed, texture, dried edge, pigment split), a flat `wash`, `hatch`ing and/or an `outline` |
| `paint` | One stroke of paint: `round`, `flat`, `filbert`, `fan`, `knife`, `dry`, `blender`, `soft`, `stipple`, or the watercolour `wash` and `glaze`; with `load` (runs dry), `smudge` (mixes with what is under it), `thickness` (impasto) |
| `glaze` | A transparent tint over an area or the whole picture |
| `brushwork` | Many strokes over an area from a few numbers: foliage, grass, sky, water, fur. `direction` is an angle, `flow`, `up`, `around` or `out`; wet strokes run together into one wash |
| `from-picture` | Paints or draws a picture of the plan's `pictures`, big brushes to small |
| `finish` | Impasto light on thick paint and the grain of the paper |

Papers: `smooth`, `hot-press`, `cold-press`, `rough`, `toned`, `canvas`, `panel`.

## The critique

`paint check` measures what an art teacher looks at, and says what to do in the next pass:

- **Values**: the range from the darkest dark to the lightest light, and whether one value family
  (light, middle or dark) leads.
- **Colour**: mud (greyish middle values), how many hue families compete.
- **Paper**: white paper kept in a watercolour; the ground covered in an oil.
- **Focus**: where the strongest contrast and detail are (not dead centre, not at the edge).
- **Edges**: soft and lost in places, hard at the focus.
- **Likeness** to the reference, when there is one; the painting is not blamed for what the
  subject already is (a dark, grey subject painted dark and grey is faithful).

It passes at 75 with no hard problem. In a studio job the painting step cannot finish until it
passes (`--job JOB` records it), unless the artist finishes with `--anyway` and says why.

## What it is built on

- [p5.brush](https://github.com/acamposuribe/p5.brush) (MIT): the pencils, charcoal, pens,
  markers, hatching and watercolour fills, on WebGL2.
- [spectral.js](https://github.com/rvanwijnen/spectral.js) (MIT): pigment mixing (Kubelka-Munk),
  so paint picked up from the canvas mixes like paint (blue and yellow make green).
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) (MIT): ink lines with
  pressure.
- Tempoloom's own bristle-brush engine (paint load, dry brush, smudge, impasto, watercolour
  strokes that dry with dark edges and granulate in the paper), its own reading of Hertzmann's
  1998 painterly method, and its own critique.

It runs in the same headless Chromium as the rest of Tempoloom; no model or download is needed.

## What it cannot do

- It paints what a plan says or what a photo shows; it does not invent a photo-real image. For an
  original subject, the artist composes it from shapes, brushwork and lines, which reads as a
  painting, not a photograph.
- It never copies another artist's painting. A famous painting can inspire a mood; the user's own
  photos are what it paints from.
- Watercolour is simulated per stroke and per layer (bleeding, dark edges, granulation), not as
  flowing water over minutes; large canvases take longer (a 1350 px oil from a photo takes about
  20 seconds, a pencil drawing about a minute).
