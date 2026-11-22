# Changelog

## Unreleased: The Editor is tested and split into parts

- **Basic tools found missing next to CapCut, Premiere and Resolve:**
  - **Resize and rotate in the player**: the selected picture or text has corner handles (drag
    to resize) and a knob above it (drag to rotate; Shift for 15° steps).
  - **Scrubbing**: dragging the ruler plays short bursts of the sound under the playhead.
  - **Loop** (the button by Play, or Shift+L) and **play from in to out** (Ctrl+Shift+Space).
  - **Split every track** at the playhead (Ctrl+Shift+B or Shift+S).
  - **Select forward or back** from the playhead on all tracks (A, Shift+A).
  - **Nudge** the selection one frame (Alt + ←/→; with Shift, five frames).
  - **Line spacing** for text, next to letter spacing.
- **Keyframe curve editor** (as in Premiere's Effect Controls and Resolve's curves): under
  "Keyframe at the playhead", drag two handles to shape the move to the next keyframe; it can
  overshoot for a bounce. The named easings start the curve; the export follows it exactly.
- **Text templates**: Lower third, Headline, Subscribe and Quote under Text, Templates; and
  "Save style as a template" on any text clip (kept in this browser; right-click one to delete).
- **Swap clips** with the one before or after (Ctrl+Alt + ←/→, or the clip's right-click menu);
  the gap between them stays.
- **Voice changer and pitch** (Audio tab): Deep, High, Chipmunk, Robot, Radio, Phone, Megaphone,
  Echo and Monster, and a Pitch slider (±12 semitones) that keeps the speed. The pitch runs in an
  AudioWorklet (`editor-pitch.js`), the same in the player and the export.
- **Media folders and search**: right-click a file in Media to put it in a folder; folders show as
  chips over the media, and a search box finds files by name.
- **Fit to fill**: a clip's speed changes so it ends exactly where the next clip starts (right-click).
- **Dynamic zoom** in or out across a clip in one click (right-click): two scale keyframes.
- **Nested clips** (compound clips, as in Resolve and Premiere): select clips and press Alt+N (or
  right-click, Nest into one clip). They become one clip with their own tracks inside; move, trim,
  split, grade, mask or add effects to it and the whole group follows, picture and sound alike, in
  the player and the export. Alt+N again (or Break apart) puts the clips back where they play.
  Nested clips travel inside project files. **Double-click one to edit inside it** (a bar over the
  player says where you are; Back or Esc returns, and everything done inside is one undo step).
  Auto captions and scrubbing hear the clips inside too.
- **Multicam** (as in Resolve and Premiere): select clips of the same moment and choose Make multicam:
  their sound lines them up (to 10 ms). Press 1–9 to cut between angles, also live while it plays;
  choose which angle's sound is heard; double-click to nudge an angle; Break apart flattens it into
  the cut (the chosen pictures, and one sound clip).
- **Title editor**: titles made of layers (text and boxes) laid out on the frame. Six ready-made ones
  under Text, Titles (lower third, headline card, name tag, quote card, end card, subscribe button)
  or a new one; the editor shows the video under the title: click a layer, drag it, drag its corner to
  size it, and set its words, font, size, colours, rounded corners, outline, wrap width, how it comes
  in and after how long. Double-click a title clip to edit it again; its words can also be changed in
  its Title tab. The whole title moves, scales, turns and animates like any clip.
- **CapCut-style tools, all without AI:**
  - **Animations for video and photo clips** (Animation tab): zoom in or out, pop, bounce, slide in four
    directions, spin, swing, blur, shake, fade; in and out.
  - **Effects** (Effects tab): RGB split, glitch, VHS, light leak, film burn, flash, mirror,
    kaleidoscope, pixelate, zoom blur, motion blur, invert, each with an amount.
  - **Transitions**: fade to white, zoom blur, circle, whip pan, spin, flash, glitch and shake join
    the seven before (15 in all).
  - **Masks**: mirror band, heart and star.
  - **HSL** (Colour tab): pick one of eight colours and shift only its hue, saturation and lightness;
    folded into the grade, so it costs nothing extra to play.
  - **Text effects**: gradient fill, glow, 3D depth, curved text and a speech bubble.
  - **Backgrounds**: a gradient or a photo behind the video, besides a colour or a blur.
  - **Split screen** (select 2 to 4 clips, right-click): side by side, top and bottom, one big and
    two small, or four in a grid; each picture is cropped to its cell.
  - **Smooth slow motion** (Speed tab): frame blending below 1×.
  - **Detect scenes** (right-click a video): ffmpeg finds the cuts and the clip is split there.
  - **Colour match** (select two clips, right-click): the clip's red, green and blue curves are set
    so its shadows, middle and highlights match the other clip.
  - **Sound effects** (Audio): whoosh, swipe, pop, click, ding, riser, boom, camera, notification
    and glitch, made on this computer, added at the playhead.
- **Audio crossfades**: click the cut between two clips on an audio track and choose Crossfade (or
  use it on every cut). The two sounds overlap over the crossfade's length (as far as their files
  allow) with constant power, in the player and the export.
- **Multicam angle viewer**: a selected multicam clip shows every angle live in its Basic tab; the one
  on screen is outlined, and clicking one cuts to it.
- **Remove silences** (right-click a clip with sound): cuts out pauses quieter than a level you set,
  longer than a length you set, keeping a little air around speech, and closes the gaps on its track.
  Measured from the sound itself, on this computer; Undo puts everything back.
- Fixed: trimming, rolling or slipping a nested clip moved its contents; deleting or breaking apart
  a nested clip while playing left its sound playing; two editor scripts could define the same
  name and silently replace each other (now a test stops that).

- **Automatic tests for the Editor.** `tests/editor-logic.test.ts` loads the page's scripts in a
  sandbox and checks the pure parts: grading curves, `.cube` looks and the grade table, speed
  curves, words and direction in every script, SRT/WebVTT, caption line packing, project zips
  (CRC-32), WAV headers, green screen and shake. `tests/editor-page.test.ts` (`RUN_BROWSER_TESTS=1`)
  drives the real page: import through the file picker, split/undo/redo, a grade, Kurdish captions,
  panning in the mix, a marker, an MP4 export checked with ffprobe, a project file round trip and
  a reload.
- **The Editor's code is split by subject**: `editor.js` (core: saving, tracks, playback, drawing)
  plus `editor-edit`, `-nest`, `-text`, `-sound`, `-colour`, `-export`, `-captions`, `-smart`,
  `-files`, `editor-ui`, `-props`, `-input`, `-widgets` and `-dialogs` (and the `editor-pitch`
  worklet), loaded in that order; each adds its part to `Ed`. A test stops two of them from
  defining the same name. Nothing changed in what the page does.
- Fixed: an absolute `VIDEO_WORKSPACE` made exports and smart tools look in the wrong folder; a clip
  with no grade reported `undefined` instead of "not graded".

## 10.4.0: The Editor grows up: grading, smart tools, presets

- **Colour grading** (a Colour tab, as in DaVinci Resolve): colour wheels for shadows, midtones and
  highlights (a colour push and a brightness), curves (all, red, green, blue), and imported `.cube`
  looks with an intensity. Folded into one 33-point table and applied on the graphics card (WebGL),
  so the player stays fast and the export is the same. **Scopes** by the player: waveform,
  vectorscope (with the skin-tone line) and RGB histogram. Looks travel inside project files.
- **Smart tools**, on this computer, from a clip's Basic tab or its right-click menu: **Stabilise**
  (the studio's stabiliser; the steady copy replaces the clip, keeping its timing, grade and
  keyframes), **Remove background** (photos in seconds; videos frame by frame into a transparent
  WebM, with an estimate first: about 6 s a frame on the processor), **Auto reframe** (fills the
  frame and keyframes the picture to follow the face).
- **Export presets**: TikTok · Reels · Shorts, YouTube 1080p and 4K, Instagram 4:5, square, GIF, and
  sound only; a Quality choice (smaller file, high, best); GIF (looping, its own palette) and MP3 or
  WAV of the mix. A preset whose shape differs from the video says so.
- **Pro trims** (as in Premiere and Resolve): Alt + drag an edge for a ripple trim, Ctrl + drag an
  edge to roll the cut between two clips, Alt + drag a clip to slip it (another part of the file, the
  same place), Ctrl + Alt + drag to slide it between its neighbours; each stops where a file ends.
- **Labels and markers**: label colours for clips (right-click) and tracks; markers with a name,
  colour and note (double-click on the ruler), shown on the ruler and listed in Details to jump to.
- **Tracks and mixer**: rename a track (double-click its name), colour it, drag its lower edge for
  height; the **Mixer** sets each track's volume (0-200%), pan, mute and solo, in the player and export.
- **Sound effects per clip** (Audio tab): equaliser (low, mid, high), compressor and reverb, with
  presets (clear voice, radio, warm, podcast, hall), heard in the player and mixed into the export.
  **Clean voice** removes noise, mains hum and rumble (the studio's voice cleaner; the clean copy
  replaces the clip). **Beat markers** put a marker on every beat of music (bars labelled), so clips
  snap to the beat.
- **Adjustment layers** (Effects in the library): a clip on an upper track that applies its
  adjustments, grade, mask and effects to everything under it, with its own opacity and fades.
- **Effects tab** (CapCut-style): sharpen (on the graphics card), glow, film grain (changing 24 times a
  second), camera shake (repeatable, so the export matches), rounded corners, a border, and a drop
  shadow that follows a cut-out's outline.
- **Source monitor and 3-point editing**: double-click a video or sound in Media to watch it, mark in
  and out (I, O), then **Insert** (what follows moves right) or **Overwrite** at the playhead.
- **Reverse**: a clip's own part of the file, played backwards (a new file; the original stays).
- **Motion tracking**: put text, a sticker or a picture over something in the video and press Track
  motion; it follows it (OpenCV CSRT; within a few pixels on test footage) with keyframes.
- **Proxies** (Details): 720p copies of big videos for smooth editing; playback uses them, every
  export and saved frame uses the originals.
- **Paste attributes** (Ctrl+Alt+V, or the clip menu): the copied clip's transform, opacity and
  blend, colour, key and mask, speed, sound or text style onto the selected clips, by group.

## 10.3.0: A fuller Editor: exact export, room to save, timeline, sound, effects and speed tools

- **Frame-accurate export**: the Editor draws every frame at its exact time and encodes it in the
  page (WebCodecs, VP9 or VP8); nothing is dropped when the computer is busy, and it no longer has
  to play through in real time. The sound is mixed offline with the same volumes, keyframes and
  fades as the player; faster or slower clips keep their pitch. ffmpeg on this computer makes the
  MP4 (H.264/AAC) or WebM. Export has a Frames choice: Exact (the default; footage with few
  keyframes can take longer than the video) or Real time (records while it plays, as before, and
  can skip frames on a busy computer). Browsers without WebCodecs always use Real time.
- **Projects in IndexedDB**: projects, the last 50 undo steps and the media list moved from
  localStorage (about 5 MB) to IndexedDB, so big projects save. Older projects move over once on
  first open. "Saved" shows only after the browser has committed the change; a full disk is said.
- **Project files**: Export project file (a project's menu) saves the edit and the media it uses
  as one .zip; Open project file on the Editor page opens it as a new project, in this browser or
  another one.
- **Timeline tools, as in other editors**: ripple delete (Shift+Delete) and Delete gap (right-click
  an empty space) close the space; Q and W delete left or right of the playhead; J, K and L play
  back, stop and play forward, faster on each press; I and O mark in and out (Shift+I/O go there,
  Alt+X clears), shown on the ruler, and Export can make only that range; Freeze frame (Shift+F)
  holds the frame under the playhead for 2 seconds; Replace with... swaps a clip's media and keeps
  its place, length, effects and keyframes.
- **Sound tools**: Even loudness matches a clip (or every clip) to -14 LUFS, measured the
  BS.1770 way (K-weighting and gates; within 0.2 LU of ffmpeg's ebur128 in tests); clips can now
  really go above 100%. Ducking lowers music while someone speaks in the other clips (3 to 30 dB,
  default 12), easing in just before and out after. Fades are dragged straight on the clip in the
  timeline. A stereo level meter (-60 to 0 dBFS, peak line) sits by the player. Playback and export
  use the same volumes, so what you hear is what you export.
- **Effects**: Green screen (Adjust tab) removes a colour, picked with an eyedropper from the
  picture, with similarity, smoothness and spill. Sixteen blend modes (Screen, Multiply, Overlay...)
  under Opacity. A Mask tab for pictures and videos: rectangle (round corners), ellipse or linear,
  with size, position, angle, feather and invert. Keyframes ease Smooth (as before), Linear, Ease in,
  Ease out or Hold, chosen at the playhead.
- **Speed curves** (Speed tab): Montage, Hero, Bullet, Jump cut, Flash in and Flash out, or your
  own curve (drag points, click to add, double-click to remove; 0.1x to 10x). The clip keeps the
  same part of the file, split and trims keep the curve, and the sound keeps its pitch in export.
- **Groups**: Ctrl+G groups clips so they select, move and delete together (Alt+click picks one),
  Ctrl+Shift+G ungroups; Detach audio links the sound to its video. Copies get their own group.
- **Save frame** (Shift+E, or the picture button by the player): the frame under the playhead as a
  PNG, 1080 on the short side.
- **Text animations**: Zoom, Blur and Word by word (whole words, right to left for Arabic-script text).
- **Captions in any language**: Auto captions take a spoken language (detect automatically, the
  studio's languages including Kurdish, or about 80 more, listed by their own names) and keep each
  word's timing. Looks: Clean, Karaoke (the word being said lit), Word by word, Build up and Boxed,
  with a highlight colour, capitals (by the language's own rules) and "Use this look on every
  caption". Lines break at pauses, sentence ends in any script and a length that fits; Chinese,
  Japanese, Thai, Lao, Khmer and Myanmar break between dictionary words. Right-to-left lines read
  right to left with their punctuation in place, and Arabic-script captions use a font that has
  every letter. Captions import from and export to .srt (and import .vtt).
- **Captions on this computer, free**: Auto captions can listen with Meta's Omnilingual ASR
  (1,600+ languages, Kurdish Sorani included; Apache 2.0) run by sherpa-onnx: no key, no upload,
  the language found automatically. Set up once from the Captions box or `pnpm tempoloom captions
  setup` (1B: 751 MB, or a lighter 300M: 279 MB). Long audio is cut at pauses into pieces the model
  accepts; word times come from its character timestamps. On 8 Sorani test sentences (AsoSoft
  corpus) 3.9% of letters were wrong, most word differences being spelling (joined or split
  words); 40 s of audio took 9 s on an 11th-gen Core i5 CPU. ElevenLabs stays available as the
  online choice.
- **A second opinion for Kurdish Sorani**: when the speech is Sorani, the project's Sorani-trained
  Whisper (large-v3, already set up by `audio:setup`, on the graphics card when it fits) listens too
  and marks the words it heard differently: a dotted orange line in the player, a flag on the clip,
  and "Check these words" with Use and Keep in the caption's panel. It never changes words by itself:
  on 8 AsoSoft sentences letting its confidence decide made the text worse (6.9% wrong letters
  against 3.6%), while its marks found 42% of the mistakes. It can also be chosen alone in "Listen
  with" (it writes punctuation).
- **Captions that learn from your corrections**: change a word in a caption made from speech (or
  press Use) and the change is remembered for that language and fixed in the next captions at once;
  the corrected words are also given to the Sorani Whisper as words to listen for. Each corrected
  caption is kept with its audio in `workspace/datasets/captions/<language>/` (WAV plus
  metadata.jsonl) to fine-tune a model on later. "Manage" in the Captions box lists what was learned,
  with how often, to forget one or all. Nothing leaves this computer.
- **Cleaner Kurdish captions**: Arabic look-alike letters become Kurdish ones (ك→ک, ي/ى→ی, ھ→ه,
  ة→ە; Arabic keeps its own); the half letters the Sorani model sometimes wrote (shown as �) are
  repaired; words that model "heard" over silence or music (12 dB or more under the typical word)
  are dropped, which took it from 7.3% to 3.9% wrong letters on the Sorani test set; where both
  models agree, captions take its punctuation; only short disagreements (up to 4 words) are marked.
  `pnpm tempoloom captions evaluate [--show]` scores each model on the captions you corrected.

## 10.2.0: Sileo notifications

- **Notifications in the style of [Sileo](https://sileo.aaryan.design)**: a pill with a badge and a
  title at the top centre springs open into a body with the message, joined by a gooey SVG filter,
  folds back before it leaves, and stays open while you hover or focus it. Dark on the light theme,
  light on the dark one; Escape dismisses it; an error is read out at once.

## 10.1.0: A simpler page

- **Five places**: Create, Projects, Library, Tools, Brain. Looks and Scenes are tabs of Library,
  with Teach a video; old addresses open their new place.
- **A project shows what matters first**: its newest video, what waits for you and the button to
  approve. Every step, the team at work, the request and the script check are under Details.
- **Settings for a video**: shape, length, language and voice-over (captions for an edit); taste
  profile, two looks, second opinion, colours and style are under More options.
- **Brain has three tabs**: Taste, Lessons (with the patterns your good examples share) and What worked.
- The project page's header loses its duplicate "Tell the studio something": the prompt box does it.

## 10.0.1: Material Symbols and a full-screen Create

- **Icons**: the page draws every icon from Google's Material Symbols (Outlined), the set Google
  Flow uses, in one file (`src/teach/ui/icons.js`); source and Apache 2.0 licence in
  `assets/icons/material-symbols/`.
- **Create fills the screen**: the welcome or your projects take the room, every idea card shows
  above the prompt box (one swipeable row on phones), and nothing is hidden behind the box. The
  middle shows the Tempoloom clapper logo.
- The logos, mascot faces and favicon are sent fresh every time, so a recoloured logo shows at once.

## 10.0.0: The Studio page, redesigned in blue

- **Seven places instead of seventeen screens**, in Google Flow's layout: Create, Projects, Looks,
  Scenes, Library, Tools and Brain on the rail, Trash and Collapse at its foot, and one panel on
  the right for rules, settings, tools and help. Every older address opens its new place.
- **Create is the home page**: your newest projects and ideas in the middle, and the prompt box
  pinned at the bottom. + adds files for this video or from your library, the pill picks the kind
  of video and its presets, Rules and Settings open beside it, Enter sends. Drop files anywhere.
- **Projects** as a grid with Making, Waiting for you and Done; inside a project the prompt box
  says what to change. Move to trash hides a project; the Trash restores it or deletes it.
- **New places**: Looks (learned looks and taught videos, ready to use), Scenes (every scene of every
  project, locked ones marked), your Library on the page (add, find, download, remove) and Tools,
  drawn from the tool registry (`page` on a tool's entry).
- **Find anything** with Ctrl+K: places, tabs, tools and a search of everything you made; the bell
  shows what waits for you and what to tell your agent.
- **One design system**: tokens for colour, type, spacing, radius, shadow and motion in dark, light
  or the system's theme; one set of components; text at 4.5:1 or more in both themes; Inter with
  Noto Sans Arabic. See [the page's design](docs/guides/studio-page.md).
- **A blue brand**: the logo, mascot, expressions, icons, social images, favicon, brand kit and the
  default brand profile go from teal and coral to navy and blue (`scripts/recolour_brand.py`, which
  recolours SVGs by value and PNGs pixel by pixel, keeping every edge).

## 9.23.0: Library and learning (group 12 of 12)

- **Your library** (`library add | find | describe | use | list | remove`): logos, music, sounds,
  pictures and clips in one place. It measures each by itself (a see-through picture is a logo; a
  track's tempo and energy; a picture's size, shape and colours; a clip's shots) and keeps what it
  shows in your words or the agent's. Found by what it shows from any job and from the page's
  search box; each entry remembers the jobs that used it. Pictures and sounds are copied in; clips
  join the b-roll library; your own files are never changed or deleted.
- **Learn from a channel** (`look channel URL|FOLDER --name NAME`): a creator's latest videos (20 by
  default) studied as one style, what stays the same in every video and what changes, saved as a
  look for `--like`, with a sheet of one frame per video. A link lists the videos first; with
  `--confirm` the first 45 seconds of each are downloaded for study only, measured and deleted.
- The studio looks in your library first (the brief, the music, the scenes), and the researcher
  learns a channel the user names.

## 9.22.0: Control over the look (group 11 of 12)

- **Lock what you like** (Studio page, under a step's video; or `studio lock JOB 2,5`): locked
  scenes are final. Every later round keeps them exactly; a step that changed one cannot finish
  and a comment on one is refused until you unlock it. The agent is told at every step.
- **Readability check** in every preview: each text watched from start to end as a phone shows it
  (390 points wide), for its size there (12 pt or more) and how long it stays against how long its
  words take to read; counting numbers and typed text are followed as one.
- **Text that reacts to the voice**: captions whose words grow as they are said, as much as they
  are stressed, the most stressed lit and shouted ones shaking (the `loud` caption style, or
  `react` on any captions).
- **Style mixer** (`look mix A B --weight 0.7`; on the page, Mix two styles I taught, with a
  slider): two looks or taught videos blended by their shares, saved as a look for `--like`.

## 9.21.0: New kinds of video (group 10 of 12)

- **Charts from data** (`make SCRIPT --chart DATA`, or a chart video on its own with `--title`):
  pasted numbers (Label: value lines, a CSV or TSV table, JSON; %, currencies, K/M/B and
  Arabic-Indic digits understood) become an animated chart in the video's style: bars that grow
  while their values count, a line that draws itself, a big counting number, or two values with the
  change between them. It goes on the sentence that mentions the data; the art director never
  redesigns it.
- **List and countdown videos**: a numbered script ("top 5", "3 reasons") gets one scene per item
  with its big number, where it is in the list and a progress bar, the same layout and the same
  length for every item; numbers counting down make a countdown. Each item is spoken without its
  number.
- **Photo story** (`media story FOLDER`): photos ordered by when they were taken (the camera's date,
  a date in the name, or the file's), by look, or by what they show; each moves gently towards
  where the eye goes, portraits on a blurred copy of themselves, turned upright, dissolving into
  the next, paced evenly or on the music's beats, with a title.
- Scene lengths can be set per scene in a request (`sceneLengths`), and a scene visual can be kept
  from redesign (`keep`).

## 9.20.0: Your voice and footage (group 9 of 12)

- **Audio clean-up** (`media voice FILE`, the `voice` edit operation): background noise, mains
  hum, room echo between words, uneven loudness and clipping are measured; only what was found is
  fixed (FFT noise reduction, hum notches, a downward expander between words, evening out), and
  the voice is measured again: before and after in the result. The picture is copied untouched.
- **Colour matching** (`media match CLIP...`, the `match` operation): clips from different cameras
  or days get one look, the reference's average colour and contrast per channel, to a clip you
  choose or to the most typical one; the difference before and after is reported.
- **Speaker labels** (`media speakers FILE`): who speaks when, told apart by how each voice
  sounds (or from a diarized transcript), named from your list or from how people introduce
  themselves; captions that start each turn with the name, and name bars in your brand's colours
  and font when each speaker first appears (`--bars`).
- The footage analyst measures voice, colour and speakers; the finisher applies them.

## 9.19.0: Artist

- **Paintings and drawings made like an artist makes them** (New video, A painting or drawing; or
  `pnpm tempoloom paint`): pencil, charcoal, ink, watercolour, gouache, oil, acrylic and pastel,
  from words or from your photo. Real marks, not a generated image: pencils, pens and watercolour
  fills that bleed and dry with dark edges (p5.brush), and Tempoloom's own bristle brushes that run
  out of paint, skip over the paper's tooth, mix what they pick up like pigment (blue and yellow
  make green) and build up thick paint lit from one side; a palette knife, a blender, dry brush,
  watercolour strokes and glazes; brushwork that fills an area with many strokes (foliage, grass,
  water, sky).
- **Pass by pass**: drawing, block-in, colour and form, details, finish, in the medium's order
  (watercolour light to dark with the paper kept, oil dark to light and thin to thick). A picture
  after every pass to look at before the next (`paint render --upto N`), quick value studies
  (`--study`), and a **timelapse** of it being painted (`--timelapse`, in 9:16 for a short).
- **Your photo as a painting** (`paint from PHOTO --style oil|impressionist|expressionist|gouache|
  pointillist|watercolor|pencil|charcoal|ink`): big brushes first, smaller ones only where it still
  differs, strokes curving along the photo's edges.
- **A critique** (`paint check`): value range and grouping, mud, hues, paper kept or covered, the
  centre of interest, edges, likeness to the photo; each problem with what to do next. `paint lint`
  checks a plan against the medium's rules before anything is painted.
- **The art department and the `tempoloom-artist` agent**: a painting job has a concept artist
  (three value studies to pick from), the artist (paints pass by pass, looks after each, and cannot
  finish until the critique passes), the independent reviewer, and your approvals. Feedback about
  paint, brushes or drawing reaches the art roles and becomes their lessons.

## 9.18.0: Same design, your content

- **A motion video in the same design**: give a video you like (New video, Reference, Same design,
  my content; or `recreate study`). It is read scene by scene into a blueprint (timing, how each
  scene comes in, where content and text sit and how big, colour roles, motion), your script,
  logo and colours are put into the same scenes (`recreate plan`), and the made video is checked
  against it scene by scene (`recreate check`; a studio preview cannot finish until it passes).
- **Your footage edited the same way** as an edited video (Reference, Edit my footage the same way;
  or `recreate edit`): its cut pace, punch-ins (as often, as big, as long), captions (place, size,
  colours, one word or a phrase), colour grade and music, measured and applied by the automatic
  edit, with how close it came.
- Only the design or the editing style is taken, never the reference's artwork, logo, footage or
  words. New `grade` edit operation. The automatic edit can now take another edit's punch-ins,
  caption look and grade.

## 9.17.0: The page works on it, and the rest of the list

- **The page drives a job** (Settings, Who works on new videos: your terminal agent, this page, or
  ask each time; and **Run it here** on any job). Each step runs with your main or role model through
  Tempoloom's own commands, the way a terminal agent runs it. It stops at every approval and
  carries on when you approve; only you approve, choose, rate, delete or restore. Every model call
  is checked against your budgets and recorded: a job asks before spending past the "ask me"
  amount and stops at the per-video and per-day budgets. Works with Claude, OpenAI, Gemini,
  OpenRouter, xAI, Mistral, DeepSeek, Groq and model servers on your computer.
- **Search sees and hears more**: say what a video shows (Gallery, What it shows; or the agent from
  a sheet of frames: `find unseen`, `find describe`), and write the words of videos that have none
  (`find listen`, ElevenLabs, within your budgets).
- **Speed in FCPXML**: speed changes go to Final Cut Pro and Resolve as a time map.
- **CapCut kit**: the edit's parts as numbered clips cut on the exact frame, ready to add in order.
- Fixes: a job driven by the page no longer says "tell your agent"; tiny costs read "less than
  $0.01"; `find --help` shows help instead of searching for "help".

## 9.16.0: Find and tidy (group 8 of 8)

- **Search by description**: one search box (at the top of every page, and `find`) over the videos
  the studio made (by title, by what is said in them and by how they look: colours, brightness,
  shape, length), the scenes of motion videos, lessons, taught videos and your clips. Each result
  says where it was found. Kurdish, Arabic and Persian match however they were typed.
- **Duplicate finder**: the same video exported again (the same file, or the same picture in another
  size) and lessons that say the same thing are grouped with the one to keep and why; keeping one
  deletes or hides the other videos and retires the other lessons (with Undo). A lesson and its
  opposite are never grouped.
- **Storage keeper**: old previews, earlier renders, stale caches and work files, listed with their
  size and why, cleared in one confirmed step. Finals, starred and good videos, transcripts,
  voice-overs and your clips are never listed.
- The studio's first steps look for earlier work on the same subject.

## 9.15.0: Publish kit (group 7 of 8)

- **Thumbnail and title set**: `publish covers` draws the best different frames with each of your
  titles, turning through three layouts, and a sheet to compare them; `publish titles` suggests
  titles from what the video says. `media thumbnail` gains `--layout`, and a long title now shrinks
  to fit.
- **Post package**: `publish package` writes the video in each platform's shape, a cover for each,
  the captions and the words to post, checked against TikTok, Reels, Shorts and YouTube limits
  (checked 2026-11-14). Nothing is posted. On the page: **Publish it** on every gallery video.
- **Export to an editor**: `edit export` turns an edit list or an edit by text into a Premiere Pro
  and DaVinci Resolve XML, a Final Cut Pro FCPXML, a CMX 3600 EDL and SubRip captions, with what
  only the render makes listed. CapCut cannot open another editor's timeline, so it gets a cut list
  and the captions. On the page: **Open in another editor** in Edit by text.
- Studio final steps suggest the covers and, when the user will post, the package.

## 9.14.0: Footage clean-up (group 6 of 8)

- **Shaky footage fix and flag**: `media shake` measures each clip (FFmpeg's own stabiliser, no
  extra tools) and says steady, fix, or too shaky to save, with its worst seconds. `media stabilize`
  now uses it by default (zooming only as much as the shake needs; `--engine opencv` for the old
  one), and the new `steady` operation does it in an edit list. Edit by text has **Steady the picture**.
- **Sensitive detail blur, only when asked**: `media private` finds faces, number plates and phone
  numbers (in Latin, Arabic-Indic or Persian digits) on this computer; the blur follows what it
  covers and only while it is there. The speaker is kept. `media blur` writes the blurred copy; the
  new `blur` operation takes areas you draw too. Edit by text has Blur faces, plates and numbers.
- **Screen recording polish**: `media screen` finds the cursor and the clicks in the picture (or a
  recorder's log), highlights the cursor, rings the clicks, zooms where a click changed the screen
  and trims the waiting. New `cursor` and `zooms` operations.
- Footage-edit studio jobs check the shake and plan screen recordings while analysing.

## 9.13.0: Motion kit (group 5 of 8)

- **Caption styles**: one word at a time, karaoke (the spoken word lit), words building up, the key
  word lit, and fade, pop, rise or slide in; six built-in styles and your own (Edit by text, Save as
  my style; `edit captions save`). Captions follow the words' own times.
- **Transitions that match the content**: a turn wipes, an answer or a figure is revealed, the next
  step pushes on, the call to action comes forward; the storyboard says why for each scene.
- **Sound design layer**: edits get whooshes, pops and hits where something moves, pushed down
  while someone speaks (`sounds` operation); motion videos' scene sounds are kept under the voice too.
- **Perfect loops**: `media loop` crossfades the end into the start; `media loop-check` measures the seam.
- **Product photo to motion** (`media product`): cut out, depth, a soft shadow and a band of light.
- **Map and route animations** (`media map`): places by name in Kurdish, Arabic or English, the
  route drawn as it is travelled (Natural Earth coastlines and borders).
- **Device mockups** (`media mockup`): screenshots in a moving phone, tablet or laptop; tall ones scroll.

## 9.12.0: Edit by text (group 4 of 8)

- **Transcript editing** (Studio, Edit by text; `edit text`): footage becomes its words. Strike a
  sentence (or select words) and it is cut; bring it back the same way. The preview plays only what
  stays, in its order, before anything is rendered.
- **Filler and silence removal with an undo list**: fillers, long pauses and the silence at the ends
  are cut from the start, each on one list with why, and any can be kept again (one, or all of a kind).
- **Repeated takes and the best-take picker**: lines said more than once (including a restart with no
  pause) are grouped; the strongest take is kept with the reason, and another is one click away.
- **Hook finder**: the ten strongest openings, ranked with why (a question, a number, a strong claim,
  speaking to the viewer; a greeting scores low). The one you pick plays first.
- **Reframing that follows the subject**: vertical, square and 4:5 crops glide with the speaker's
  face (the media tools' face tracking): they hold near the middle and never jump. `media reframe
  --follow` and the `reframe` operation's `follow` points do the same in any edit list.
- **B-roll from your own footage**: your clips, split into shots with frame sheets and descriptions;
  for each sentence, the shot that shows it is suggested with the shared words, and covers the
  speaker when used.
- New edit operation `arrange` (parts in any order). Footage-edit studio jobs plan their cuts this way
  and link to the text edit. Fixes the sound drifting from the picture in edits with many cuts.

## 9.11.0: Versions and feedback (group 3 of 8)

- **Version history**: every time a studio step finishes, its output and the files it showed (the
  preview, the final video, pictures, the looks to pick from) are kept in the job's `versions`
  folder. A step with several versions has Compare versions: any two side by side, your rating of
  each, and the lines that changed. Bring back makes an earlier one current again (the steps built
  on it are redone). `studio versions` and `studio bring-back` from a terminal.
- **Comments on a moment**: under each video a step shows, a strip of its scenes (the project's own
  scenes, or the cuts in the picture). Comment here at any moment; the step is redone for those
  scenes only, the role is told which and what you said, and `studio done` checks the other scenes
  of a motion project did not change. Replaces "Flag this moment", which reopened the whole step.
- **Undo for everything**: a History page (and `pnpm tempoloom history`) with every change to
  lessons, rules, taught videos, taste profiles and ratings, each with Undo. Undo works field by
  field: later changes keep their values, counts give back only what that change added; an undo
  can be undone. Kept in backups.
- **Resume after a failure**: renders are made scene by scene, and a render that stopped continues
  from its last finished scene; an edit continues from its last finished step; a studio step with
  nothing heard for half an hour shows as stopped, and `studio resume JOB` says how to continue.
- Fixes: a render whose page failed waited forever for FFmpeg; editing the main taste profile
  before it was saved changed the starting profile for the rest of the session.

## 9.10.0: Checks before you look (group 2 of 8)

- **Platform safe areas**: the button and caption areas of TikTok, Instagram Reels and YouTube
  Shorts, in one table; choose where your vertical videos go in Models and keys. Vertical motion
  videos are laid out clear of them; edited captions and the watermark move out of them (with a
  note, and `"safeArea": false` to keep a position); every preview flags text under them by
  platform; the self-check adds a shaded sheet; every vertical video on the Studio page has a switch
  that shades them. This also fixes automatic edits, whose captions sat at 7% from the bottom,
  under every platform's buttons.
- **Second opinion**: a second reviewer with a different taste (another of your profiles, or a
  general viewer) watches the preview after the first review and says where it disagrees, with the
  time and the role that fixes it. On by default on the New video form; your approval waits for it,
  and the video's page shows where the two disagree.

## 9.9.0: The script desk (group 1 of 8)

- **Script doctor** (`write --doctor`, the New video form, and each video's page): every line
  scored 0-100 for its job (hook first, call to action last), clarity (filler, clauses, passive
  voice, long words) and how long it takes to say, with what to change. Weak lines get better
  versions as suggestions; you keep or decline each one, and a kept one replaces the line word
  for word. Your own script is never rewritten without you.
- **Fact check**: every figure, price, date, quotation and claim ("the best", "the first",
  "proven") is traced to the brief's facts or a source link, or flagged. A script the studio writes
  cannot be finished while a line is weak or a figure has no source.
- A job made from your own script keeps it in the job's `script.txt`; every step reads it there,
  so the lines you keep are the lines that are made. Lines can change until the storyboard starts.
- **Trend watch** (under Studio, `pnpm tempoloom trends`): up to 12 topics; each check reads the
  newest top videos through Reach and brings back formats several share, with links, marked
  rising when they grew. Accepted formats become lessons on trial for the scriptwriter. Trends
  are kept in backups.

## 9.8.0: Backup and move

- **Backup and move** (bottom of the menu, and `pnpm tempoloom backup`): everything the studio
  learned in one zip file: lessons and their scores, taught videos (measurements and lessons,
  never the videos), the brain's job records, taste profiles, feedback rules, studio jobs and
  your ratings, thumbnails, gallery stars and settings. Never your keys. Every file is
  checksummed; a damaged backup or one with files in other places is refused.
- **Restore** shows what would change before anything does, then merges (newer wins item by
  item, nothing removed, your settings and taste profiles stay, a job you deleted stays deleted)
  or replaces. A backup of what is here is always saved first, so a restore can be undone.
- A weekly backup is made by itself when the app opens (`backups/auto`, four kept). The
  `backups/` folder is never committed. Guide: docs/guides/backup.md.

## 9.7.1: One page per video, one face for the agent

- The Live studio is merged into each video's page: the team with its mascot faces and the live
  feed now sit above the steps, next to everything the page already had (ratings, picks,
  approvals, outputs). Clicking a team member or a feed line jumps to its step; the step list
  pulses on the steps being worked on. The old Live studio address opens the video's page.
- The Videos list shows the face and last line of each video being worked on now.
- One face for the agent: `studio say`, every studio step and `pnpm tempoloom status` all set
  `.tempoloom/state.json`; the sidebar shows it on every page, and the standalone mascot viewer
  keeps working. The skill, AGENTS.md and the workflow now say which to use when.
- `pnpm tempoloom mcp` is listed in the tool registry.

## 9.7.0: The Live studio, one set of tools, and Models and keys

- **Live studio** (under Studio): one job as a team at work. Every role wears the mascot in its
  own colour with the face of what it is doing now and the line it last said; the steps light
  up stage by stage; what happens streams in live; click a step for its text, pictures and
  rating; every file the job showed you sits on one shelf. You join the team when a choice is
  yours. Works for jobs your terminal agent runs, with no key.
- Every studio action writes the job's `events.jsonl`; `studio say JOB TASK "..." --face FACE`
  lets an agent say what it is doing. The skill and all sub-agents now do this.
- **`pnpm tempoloom mcp`**: the studio's tools over the Model Context Protocol, the same
  functions the commands call. Agents read only project files (never secrets) and write only
  inside their job's folder.
- **Models and keys** (bottom of the menu): connect Claude, OpenAI, Gemini, OpenRouter, xAI,
  Mistral, DeepSeek, Groq, fal, Replicate, ElevenLabs, Pexels, Pixabay, Freesound and local
  model servers (Ollama, LM Studio, llama.cpp). Each key is checked by reading the service's
  live model list, with what each model can do and its price. Keys go to the system keychain
  (or `.env` where there is none) and are never shown again. Choose a main model and one per
  role, who makes images, video, music and sound, budgets ($2 a video, $10 a day, ask above
  $0.50), and what may leave the computer. The browser studio's own agents come next.

## 9.6.0: Everything sorted by itself, and a gallery you can rate and clean

- **Gallery**: rate any video Good, Not bad or Bad from its card or its page (Bad asks why; a
  studio step with no rating yet is rated too, so its lessons are scored), and **delete the
  file** for good after a confirmation. Only files in the export folder or the workspace can be
  deleted; others can only be hidden.
- **Automatic kinds of video**: teasers and launches, explainers and tutorials, ads and promos,
  talking head and interviews, social shorts, other; read from the brief or file name, then
  from how the video was made, its length and shape. The gallery shows a section per kind.
- **Three groups for what you taught**: motion design, footage editing and storytelling. The
  Library, Lessons and Patterns pages each start with the same four tiles to choose a group.
  Taught videos also get style tags from their measurements (fast cuts, calm motion, dark look,
  vivid colour, cut to the beat, shape) that filter the Library.
- **Lessons** redesigned: status chips with counts, one card per topic, a confidence bar on
  every lesson, and a "To decide" card for lessons that contradict something known. The export
  is grouped the same way.
- **Patterns** redesigned: one card per measurement with the range in large type and a bar
  showing the range, each good example, the typical value and where the bad examples sit.

## 9.5.0: The Gallery, and one layout for every page

- **Gallery** (under Studio): every video the agent made or edited, from the studio's previews
  and finals, the jobs the brain recorded and the export folder, each file once. Search, filter
  and sort; play a video with its length, size, your rating and the agent's own check; star the
  best; compare two side by side; download; open the job's steps; hide one (files are never
  deleted); and **Teach from this**, which sends a video to the Teach page so the studio learns
  from its own work. Home shows the latest four.
- Every page now uses the Teach page's layout and behaviour: one centred workspace, a title with
  a line of explanation and the page's actions beside it, quiet cards with small section
  headings. New video uses the same choice tiles as Teach; Your taste uses the same switch rows.
  A page with nothing to show stays a single centred card.

## 9.4.0: Taste, a self-check and guesses

- **Your taste** (`pnpm tempoloom taste`, and a page in the app): one readable profile of what
  you like, built from the lessons you kept, your rules, and the ranges your good examples
  share. Switch lines off, add your own, set targets, write notes, export it; keep a separate
  profile per client or brand, based on all taught videos or only some. Every role starts from
  the lines for its topics, and a brief can choose a profile.
- **The agent watches its own video first** (`studio check JOB build VIDEO.mp4`): the preview is
  measured like a taught video and compared with your targets (matches, close, off), with what to
  change and whose step fixes it, and frame sheets to hold against your lines. The preview step
  cannot finish with something off until it is fixed and checked again, or kept with a reason
  when the brief asks otherwise. The step's card shows the result.
- **Guesses**: when a step finishes, the studio guesses your rating from how you rated that kind
  of step before, how trusted its lessons are, and its self-check. Scores counts how often the
  guesses match; once 20 are judged and 7 in 10 match, a first version you would probably reject
  is held back once for the agent to improve.

## 9.3.0: One app for Teach and Studio

- Teach and Studio are now one app: a sidebar with every section and its counts, a Home screen
  (what the brain holds, what waits for you, what happened lately), a card that always shows
  what to tell your agent with a copy button, messages that appear and fade instead of a red
  bar, proper confirm dialogs, a light and a dark theme, and a layout that works on a phone.
- Teach: drop several videos at once into a queue; a Library with search, filters and sorting;
  a page for each video with its cut strip, colours, motion and sound; compare two videos side
  by side; write your own lessons; keep all lessons on trial at once; export lessons as Markdown.
- Studio: brief presets, reuse an earlier brief, a brief that is saved as you type, a word
  count with the spoken length; in a job, a step list to jump with approved steps folded away,
  pictures that open large, downloads, copy the script, "Tell the studio something" in your own
  words, and Archive. Scores shows steps that were good the first time, video by video, and the
  lessons that are working or failing.

## 9.2.0: The Studio page: make a video and rate every step

- `pnpm tempoloom studio open` opens the Studio page (local, next to Teach). Brief a video in
  two modes: a motion graphics video from a finished script, a prompt, a topic or only a link;
  or an edit of your footage, with instructions or none. Add a logo, colours, references (a file
  or a video you taught) and other files.
- The agent works in its terminal: `studio inbox` lists new requests, tasks that are ready and
  what waits for you; `studio take` plans a request into a job.
- Every finished step is a card with what was decided and the files the role showed
  (`studio done --show`): script lines, pictures, the preview video, sound.
- Rate each step Good, Not bad or Bad (`studio rate`). A rating scores only the lessons that
  step used. Bad takes a reason (chips, flagged lines, pictures or moments in the video, a
  note), saves it as a rule for that step's role and redoes only that step.
- Two looks to pick from (`--choice`, `studio pick`): the picked look's own lessons win, the
  other's lose. The finished video takes a rating too; one job never scores a lesson twice.
- A Scores tab counts ratings by step and lists the rules they created.

## 9.1.1: Teach, saved from anywhere

- A running Teach page picks up lessons saved by another process or by a `git pull` within a
  second, so it never writes an older brain over newer lessons.

## 9.1.0: Teach the brain with videos

- `pnpm tempoloom teach open` opens the Teach page on your computer (local only, with a key in
  the link): drop a video or paste a link, choose the part to study, crop it, mark moments, tick
  what to learn, write a prompt, and say whether it is a good or a bad example.
- The video is copied to a temporary folder, measured with FFmpeg (cuts, shot length, motion,
  colour, layout, tempo, loudness, cuts on the beat), studied by the agent from frame sheets
  (`teach next`, `teach learn`), and deleted (`teach finish`). Only numbers and lessons stay.
- Learning stays clean: lessons start on trial; vague or off-topic ones are dropped with the
  reason; repeats merge and raise confidence; opposites are flagged for you to decide; a lesson
  you removed is never learned again; and what at least three good examples share becomes a
  pattern, with outliers left out and bad examples as the contrast.
- `teach similar` finds the taught videos most like another, by pacing, motion, colour, sound
  and layout. It compares measurements and needs no download.
- Every lesson can be kept, reworded or removed on the page; `teach forget` removes a video and
  what only it taught. The brain's committed copy gains `agent/brain/videos.jsonl`.

## 9.0.0: Tempoloom

- The project is now **Tempoloom**, everywhere: the package and command (`pnpm tempoloom`), the
  skill (`/tempoloom`) and its copies for Codex and Gemini CLI, the studio's sub-agents
  (`tempoloom-motion-lead`, `tempoloom-editing-lead`, `tempoloom-specialist`,
  `tempoloom-reviewer`), the status helper, the local folder (`.tempoloom/`, with the brain),
  the environment variables (`TEMPOLOOM_*`) and the repository
  (github.com/Ismail-Dilshad/tempoloom).
- The brand kit has the new wordmark, "tempo" with "loom" in coral, in Fredoka Bold like
  before: every logo, lockup and social image, SVG and PNG, at the same sizes.

## 8.1.1: Every command checked

- Help works the same on all 25 commands: `--help`, `-h` or `help` prints the usage and runs
  nothing. Nine commands crashed on `--help` (init, doctor, create, brief, answer, edit, fonts,
  assets, tools) and six treated it as an error; init, doctor, create, brief, answer, fonts,
  assets, tools and status now have usage text.
- `fonts recommend` answers first with `recommended`, the best font that covers every character
  of the text. For Kurdish text its top-level `primary` said Inter (the catalog default, which
  has no Kurdish letters) although the ranking below was right.
- `doctor` checks the skill copies and the studio's sub-agents for Claude Code, Codex and
  Gemini CLI.

## 8.1.0: The studio works with any AI agent

- The studio's four sub-agents are generated for every host from the same organisation
  (`pnpm agents:sync`): Claude Code (`.claude/agents/*.md`), Codex (`.codex/agents/*.toml`) and
  Gemini CLI (`.gemini/agents/*.md`). Their instructions name no host; where a sub-agent cannot
  start another, a lead does its department's tasks itself.
- The skill is copied to `.agents/skills/tempoloom/` (read by Codex and Gemini CLI) as well as
  `.claude/skills/`; `GEMINI.md` joins `AGENTS.md` and `CLAUDE.md` as an entry file.
- `pnpm tempoloom studio prompt JOB TASK` prints a complete brief of one task for any other AI
  or a fresh session (`codex exec "$(…)"`, `gemini -p "$(…)"`). The plan, lessons and feedback
  live in the project, so a job can start with one AI and continue with another.

## 8.0.0: The studio

Every job now runs through an organisation instead of one long playbook.

- **Roles** (`agent/studio.yaml`, one source of truth): a Director; a motion graphics lead with a
  style designer, a scene designer and a producer; a video editing lead with a footage analyst,
  an editor and a finisher; and shared roles (researcher, scriptwriter, sound designer, voice and
  captions, an independent reviewer). Each has a mission, steps, guides, commands, checks and
  the feedback topics it learns from.
- **Plan first** (`pnpm tempoloom studio`): `plan` turns a request into tasks with owners, inputs,
  outputs and the user's approvals; a task cannot start before what it needs, cannot finish
  without its output, and an approval is only the user's own yes. `next`, `start`, `done`,
  `approve`, `status` (and `workspace/studio/JOB/plan.md`).
- **Learning per role**: `start` gives a role the rules on its own topics, the lessons it wrote
  itself and the techniques of its craft; a role that was given rules must say which it used;
  `done --learned` saves a lesson for that role. `feedback` saves the user's words as a rule,
  routes it by those words to the roles responsible and reopens their tasks and what was built
  on them. `verdict` scores every lesson the job used (the last task cannot close without it);
  `retro` shows what each role did, used and learned.
- **Sub-agents** generated from the organisation (`pnpm agents:sync`, `.claude/agents/`): the two
  leads, a specialist that takes any role for a heavy or parallel task, and the reviewer, who
  never sees the work being made. Small jobs stay in the Director's own context.

## 7.10.0: Script writing from a topic, link or product page

- `pnpm tempoloom write "TOPIC"|URL [--seconds 30] [--language …]` reads the page in a headless
  browser (its own content, not menus, cookie notices or footers; pages built by scripts
  included; public links only) and writes a brief to `workspace/scripts/<name>/`: the facts a
  script may use, each with its source sentence (name, what it is, features, figures, prices,
  quotations with who said them), the beats (hook, problem, solution, proof, call to action), and
  lines and words sized with the same timing the video uses. A topic has no facts, so its
  script names no figures.
- The agent writes the script from the brief (new mode: script writing). `write --check` stops a
  script that runs too long, greets instead of hooking, has no call to action, or uses a figure,
  quotation or superlative that is not in the facts; it notes long lines and plain visuals and
  shows the visual the designer will give each line. Then `make` as usual.
- Designer fixes found while testing: a call to action stays a button when it mentions a figure
  ("Start your free 14-day trial today"), and its label is its own words; a number word inside a
  list ("payroll takes two clicks") is not the sentence's figure; a list whose last item runs on
  ("cash, bills and payroll hide in different places") is read as a list; the "after" side of a
  change drops fillers ("quiet dashboard", not "one quiet"); labels that only just overshoot stay
  whole ("for small teams").
- Fixed: with `VIDEO_WORKSPACE` set to an absolute path, makes, styles, voice-overs, sound kits,
  transcripts, downloads, research and quality reports were written inside the project folder.

## 7.9.1: Visuals read their sentences better

Found by making videos from every test script and reviewing each scene:

- No invented lists: tiles, orbits and paths only show a sentence's real list. "Track every
  project live on one dashboard" no longer becomes Track · Project live · One dashboard.
- A list's last item stops where the list does ("your roof, your battery and your car work
  together" → Roof · Battery · Car); two parts joined only by a comma are not a list.
- Labels shorten at whole words, never with "…" mid-phrase, and a shortened label never ends
  on a filler ("Book a call on", "Workspace that keeps everything in"); a long key phrase ends
  at its natural break ("Download the app on the App Store"); short clauses are kept whole.
- Filler words ("Meet", "That") are never labels on their own.
- A before→after sentence ("From chaos to clarity") is never shown as a pile of problems.
- A quotation is shown as a quote even when it mentions a figure (it was a bar chart of "10").
- The call-to-action's words stop before its arrow.
- Kurdish: "a place" (شوێن) no longer makes a sentence a map; the Arabic-script comma splits
  clauses like a comma; Kurdish digits in a counter keep their natural spacing (٤٠٪, not ٤ ٠ ٪).

## 7.9.0: The art director

- Before the preview, every designed visual is measured the way a designer would look at it:
  unreadable, sparse, crowded, off-balance (visual weight), text running into an icon or 3D
  object, the same as the scene before; a static ending and busy text are noted. Only the
  visual's own pixels count (captured with and without it).
- Weak visuals are fixed in order: their layout (moved or scaled within their space), the same
  composition drawn again, then another composition only if it shows the sentence at least 75%
  as well. A change is kept only when it measures better and adds no quality problem. Replaced
  compositions count against themselves in the brain. Once per job; on for `make` and
  `scenePieces: auto`, `"artDirector": "off"` turns it off; hand-written visuals and approved
  storyboards are never changed. `make` reports what it did.
- Fixed: the `scale`, `pop` and `spin` entrances dropped a layer's own opacity (a 10% shape was
  drawn solid).
- Fixed: text colour in visuals, and the contrast check, now see through translucent shapes to
  what is beneath them (map labels came out unreadable).

## 7.8.1: Kurdish figures and spacing

- Counting numbers use the sentence's own digits: a Kurdish line that writes ٤٠٪ counts up in
  ٠-٩ (Persian ۰-۹ likewise), with ٬ and ٫ as separators. Number layers take
  `digits: latin|arabic|persian`; the designer sets it from the sentence.
- Headlines: the space between a number or a Latin word and the next word in a right-to-left
  line (and the reverse) no longer drifts to the wrong side ("٤٠٪ زیادی" lost its space).
- 3D figures place ٪ as the headline does.

## 7.8.0: Solid 3D in scene visuals

- New `scene3d` layer: a real 3D object drawn on the GPU (three.js WebGL, one shared renderer):
  bevelled 3D text shaped with HarfBuzz from the video's fonts (Kurdish joins and reads right to
  left, figures keep the sentence's digits), any icon as rounded tubes, and shapes (orb, blob,
  gem, coin, ring, capsule, cube, knot, badge, stack, arrow). Physically based materials that
  follow the video's style (glass, frosted, chrome, brushed, gold, ceramic, candy, clay, neon,
  glossy, matte), a studio light with a reflection environment and filmic tone, soft contact
  shadows, entrances, letters rising in reading order and camera moves. Works in videos and in
  transparent clips over footage, with its own whoosh and impact sounds.
- Two new compositions, `solid-figure` and `solid-object`, learned by verdicts like the others
  and kept to one 3D moment per video.
- Chromium gets WebGL everywhere: the graphics card when there is one, its software renderer
  otherwise (`TEMPOLOOM_GL=auto|gpu|software`).
- `pnpm tempoloom pieces layers` lists the 3D kinds, shapes, materials and cameras.

## 7.7.0: Talking-head videos edited automatically

- `pnpm tempoloom edit auto FOOTAGE` edits a talking head from its speech: pauses and fillers cut,
  alternating punch-ins that hide the jump cuts, visuals designed from zero for the moments worth
  showing (figures, lists, changes, quotations, the call to action) on a panel between the face
  and the captions with their parts entering on the spoken words, compact captions from the kept
  words, music of the talk's mood ducked under the voice, and loudness. `--plan` writes the edit
  list and plan.md only; `--like` steers the visuals' style; `--brand` adds the brand layer.
- Designed visuals can now be rendered as transparent clips (renderer/piece-clip.ts).
- New edit operations: `punch` (many punch-ins in one pass) and `overlays` (many overlays in one
  pass).

## 7.6.0: Looks learn everything they can measure

- A look now also learns the headline size and stroke weight (calibrated on known font weights),
  where the text sits and how busy the frame is, shot length, the music's tempo and how busy the
  sound is, and its colours. Each part goes to one place only: the style's traits, the headline
  size, the visual's placement and size, scene pacing (only without a voice-over), the music's
  mood and tempo, and the sound kit.
- Nothing is copied unless you ask: `--copy colors` (or `"likeCopy": ["colors"]`) uses the
  video's own background, accent and text colours exactly. Fonts cannot be identified from
  frames and are never copied.
- Better measurements: the accent is the most vivid colour that covers part of the frame, tempo
  confidence compares against clearly different tempos, and `media_tools look` measures text
  lines and frame density.

## 7.5.0: Learn a look from a video you like

- `pnpm tempoloom look learn URL|FILE --name NAME` studies a video (a link is downloaded for study
  only after `--confirm`) with the existing reference measurements plus a new FFmpeg cut detector:
  brightness, background and accent colour temperature, cut rhythm, motion energy and easing. Only
  these numbers are saved (`assets/looks/NAME.json`).
- `--like NAME` (make, storyboard, or `"like"` in a request) makes the matching style traits much
  likelier (tone, motion curve, transitions) and sets the music's mood. It never copies: brand
  colours stay and every video is still generated new and different from earlier ones.
- The style generator takes weighted nudges and now weighs transitions like other traits.

## 7.4.0: Music that fits

- Every new motion video gets background music of its mood (read from the script and style):
  a track from your library (`assets/music`) cut to the video on its beats, looping on whole
  bars and fading over its last bar at the video's end; otherwise an original score composed for
  that video (free to use), with chords changing where the scenes change and a held chord at the
  end. With a voice-over the music sits lower and ducks while words are spoken; scene sound
  effects keep their level. CC BY credits go to `NAME.credits.txt`.
- `pnpm tempoloom music list|add|analyze|compose|mood|moods`; tempo and beats are measured with
  FFmpeg alone. Request fields `music` (auto, library, composed, off) and `musicMood`;
  `make --music` and `--mood`.

## 7.3.0: Captions

- Every video with a voice-over gets caption files: `NAME.srt` and `NAME.vtt` beside the video
  and each other shape. The text is the script, timed by the voice's own word timings; cues are
  two lines at most and split at sentences, commas and pauses; right-to-left cues are marked.
- `"captions": "burned"` (or `make --captions burned`) also makes `NAME_captions.mp4` with the
  captions drawn on; `"off"` skips them.
- `pnpm tempoloom media captions FILE` (footage) now writes a `.vtt` next to the `.srt`.

## 7.2.0: One command from script to finished video

- `pnpm tempoloom make SCRIPT.txt` runs the whole chain: the storyboard (a visual for every
  sentence and a new style), an ElevenLabs voice-over with word timings when you pass `--voice`,
  the video job and its preview with quality checks. It stops for you to look, then
  `pnpm tempoloom make --approve JOB` renders the final video, the other shapes (1:1 and 16:9 by
  default) and a thumbnail. `--yes` finishes on its own when the preview passes every check.
  Everything for one video is kept in `workspace/makes/<title>/` with a `make.json` record
  ([guide](docs/guides/make.md)).
- Fixed: draft and preview renders (540 and 720 pixels wide) failed with "Text does not fit";
  type sizes now scale with the render size.

## 7.1.0: Visuals follow the voice-over

- With a voice-over and word timings, each part of a scene's visual enters as its words are
  spoken: list items one by one on their words, a number landing on the spoken figure, a
  before→after tile on its word. Cards, lines and rings arrive with the part they hold; nothing
  enters too late to be seen. The layer sounds move with them, and when timings arrive later
  (`--alignment`) the sound bed is rebuilt.
- Layers carry `says` (the sentence's words they stand for); the designer fills it in.
- Fixed: a full stop could stick to the last list item when a scene's text ended with a new line.

## 7.0.1: Test cleanup

- Only the quality checks (`tests/quality.test.ts`, with its scripts in `tests/fixtures/quality`)
  and the tool registry check (`tests/agent-structure.test.ts`) remain; every other test file
  was removed.

## 7.0.0: Every video designed from zero

Breaking: the ready-made pieces, named styles and saved templates are gone.

- **Scene visuals are designed from zero.** Every sentence gets a new composition built from
  layers with only its own words and numbers, chosen by what it means: cards piling up for a
  problem, the name landing for a reveal, a counting number with bars or an arc for a figure, a
  before→after flow, parts orbiting a centre, a drawn path, a grid of tiles, the old way crossed
  out beside the new, pins on an abstract map, a quotation typing in, a call to action on a
  button, a statement card or a big symbol. Arrangement, shapes, colours, timing and loops vary
  with every video; scenes next to each other never share a composition.
- **No mock content.** No sample names, apps, task titles, chats, prices, chart data, logos or
  dates are ever invented; the storyboard only flags icons that are general marks.
- **Styles are generated from zero.** Each style is drawn trait by trait from the brief, the
  user's words for the look (`"look"` in a request, `--look` in the storyboard), their feedback
  and the traits learned from verdicts, and must differ from every earlier style. The eight
  named looks and `pieceStyle` are removed (`pieceGenome` still repeats a look when asked).
- **`video:create` designs visuals itself** when a motion request has no `sceneVisuals`
  (`"scenePieces": "auto"`), never over footage, reference styles, explainers or directors.
- **The brain keeps only its own knowledge**: general motion and editing principles, the
  user's feedback and reference styles, and what it learned. Named style examples, style
  descriptions, genre recipes and saved pieces are removed on the next sync. Verdicts now score
  each video's style traits (`pt-*`) and compositions (`pd-*`).
- Removed: the 20 ready-made piece kinds (phone, browser, dashboard, tasks, chart, counter...),
  their 30 layouts, `assets/pieces` templates, `pieces styles|templates|save|KIND`, and the
  storyboard's `--product`, `--genre`, `--device`, `--people`, `--url` and `--style`.
  New: `pieces design "SENTENCE"` and `pieces layers`; icons `x`, `quote` and `alert`.
- The quality harness's scripts are test fixtures now (`tests/fixtures/quality`); 15 videos
  (5 scripts × 3 styles) score 100 with every check passed.
- Older projects still open; a ready-made piece they used is dropped (rerun the storyboard).
- Fixed: a looping layer kept its loop pose when the preview seeked back in time.

## 6.6.0: Faster previews

- Preview frames are captured as high-quality JPEG (about twice as fast as PNG) and shared
  across several browser pages at once (one per spare CPU core, up to 4, within free memory;
  `TEMPOLOOM_PREVIEW_WORKERS` sets the number). The quality checks run across the same pages.
- The renderer's script bundle is built once per run instead of once per page.
- Measured on a 5-scene video on a 2-core machine: preview with quality checks went from 5.0 s
  to 2.7 s; on machines with more cores the extra pages add to that. The quality harness scores
  its sample videos the same way (10 videos in 15 s).

## 6.5.0: The storyboard designs new pieces itself

- When no ready-made or saved piece fits a sentence, the storyboard designs a new composed
  piece from what the sentence says: a before→after flow, parts orbiting a centre, points along
  a drawn path, a number beside rising bars, a big symbol with rings, or a statement card. Words,
  numbers and icons come from the sentence; arrangement, shapes and motion vary with the video.
- New designs appear under "Check before rendering", are written to `designed/` beside the
  storyboard, and are saved for reuse when the video is approved (`brain verdict JOB approved`).
- 13 more icons (sun, battery, car, money, water, heartbeat, book, briefcase, truck, target and
  others) and a wider icon vocabulary in English, Kurdish, Arabic and Persian.
- Text that counts up while it animates is checked against the frame too; "planet" no longer
  reads as "plan".

## 6.4.0: Layouts that change per video

- Eleven pieces have 2–3 layouts each (30 in all): dashboard as tiles, a hero number with a
  trend line, or a list; checklist as rows, a grid or staggered cards; notifications as a
  stack, a tilted pile or big pills; progress as bars, rings or columns; counter as a big
  number, a filling ring or a split; chat as bubbles or a thread; avatars as a row, grid or
  overlapping stack; quote as a card, big words or split; bar chart vertical or horizontal;
  tasks with people below, above or beside; pricing as columns or rows.
- Every layout keeps its piece's timing, so sounds stay in step, and passes the quality
  checks in every style.
- Each video picks layouts from its style's seed (never the same twice in a row for one kind),
  learned by the brain (`pt-layout-*`), shown in the storyboard; `"layout"` sets one.

## 6.3.0: Automatic quality checks

- Every preview scores each settled scene: text size, contrast against what is actually
  beneath the text, the sentence running into the piece, text cut off, clipped or covered,
  and empty frames. The result (score, pass, every issue) is in the preview and the
  `video:create` output.
- A bred style that causes hard contrast or empty-frame failures is redesigned (up to twice)
  and its colour and depth traits are marked in the brain. Final renders get a loudness,
  true-peak and effect-density check.
- `pnpm tempoloom quality`: renders sample scripts (examples/quality) in new styles, writes a
  report, lists the traits behind failures, compares with the last run and flags regressions;
  `--learn` teaches the brain, `--project ID` scores one project.
- Fixes found by the checks: text on orange and other mid-tone fills now picks dark or white by
  contrast; brand colours used as text are made readable; text drawn straight on the frame is
  checked against the frame colour; dashboard values fit narrow phone screens; trend arrows
  and the phone status bar read on every style.

## 6.2.0: The whole frame follows the video's style

- The bred style now paints the whole frame: background colour and frame-scale pattern,
  headline colour, highlight colour, headline font, weight, capitals and tracking, and the
  headline's motion. Colours are contrast-checked (text 7:1, highlights 3:1 and distinct
  from the text). Arabic-script lines keep their language's font.
- Pieces no longer draw a separate slab behind themselves when the frame is styled (glass
  keeps its colour behind it).

## 6.1.0: A new style for every video

- The named styles are examples now, not looks to reuse. Every video gets a new design
  style bred from the examples that fit its brief: traits come from the parents and are
  mutated, made coherent, and the result must differ from every style made before.
  Rendering is reproducible: the style is stored with the job.
- The brain learns style traits (`pt-<trait>`): each video records its traits, and approvals
  and rejections raise or lower them, so liked traits come back more often. Feedback such as
  "never brutal" removes that example and steers away from its signature traits.
- Saved composed pieces are varied every time: scale, timing, entrances, shapes, colours and
  idle motion. Sounds are tuned to each style (pitch and brightness).
- `pieceStyle: NAME` and `--style NAME` start from an example instead of copying it;
  `pieceGenome` keeps an exact earlier style when a user asks to repeat a look.

## 6.0.0: No fixed look: design styles, sound kits and composed pieces

- Eight whole design styles for scene pieces (soft, glass, neon, brutal, editorial, clay,
  outline, pop). Each has its own palette built from the brand, surfaces, corners, depth,
  fonts (bundled open fonts), check marks, avatars, motion character, backdrop, transitions
  and sound kit. Request field `pieceStyle` (auto by default) and a per-piece `style`.
- The style is chosen per video from the brief, the genre, the brand, the brain (stated
  preferences and each style's approval record, `ps-<style>`) and recent videos, so styles
  rotate. The storyboard shows the choice, why, and the alternatives (`--style`).
- Sound kits: `library` (CC0 recordings) and four original synthesised kits (`soft`,
  `digital`, `punchy`, `minimal`) with alternating variants; request field `soundKit`.
- Composed pieces: new visuals built from layers (cards, text, numbers, shapes, 35 icons,
  bars, lines, images, avatars) with entrances, loops and sounds, mirrored for right-to-left.
  Save good ones as templates (`pnpm tempoloom pieces save`); the brain learns them and the
  storyboard reuses them. Six starters: stat-hero, icon-trio, hero-tagline, growth-arrow,
  step-flow, badge-burst.
- The brain drops entries for references and saved pieces that were renamed or removed.

## 5.9.0: Eight new scene pieces

- `pricing` (plan cards, counting prices, features, a pressed button), `quote` (a review with
  stars), `logos` (a logo wall that lights up), `calendar` (events landing on their dates),
  `map` (pins and a route on a stylised city), `compare` (a before/after slider), `form`
  (fields typing themselves, then submitted) and `download` (store-style buttons and a rating).
- Each has its own timed sounds, mirrors itself in right-to-left languages, and keeps English
  phrases left to right inside them. Arabic-script form values appear word by word.
- The automatic storyboard picks them from the sentence (prices, customer quotes, "trusted
  by", before/after, dates, places, sign-up details, downloading the app), with example words
  in English, Kurdish, Arabic and Persian and every guess flagged for review.

## 5.8.0: Automatic sound for scene pieces

- Every animated piece plays sound effects timed to its animation: a whoosh on transitions,
  cursor clicks, pops when notifications, messages, tiles and avatars land, ticks while
  numbers count and bars grow, clicks for checked items and a chime when work is done.
- Sounds come from the CC0 library in `assets/sfx`, levelled by measured loudness, spaced at
  least 70 ms apart (14 per scene at most) and mixed into one sound bed; 6 dB quieter under a
  voice-over. On by default; `"pieceSounds": "off"` turns them off.
- Piece timing now has one source (`components/pieces/timing.ts`) shared by the animation
  speed and the sound cues.

## 5.7.0: Right-to-left scene pieces

- Every animated piece is mirrored for right-to-left languages (Kurdish, Arabic, Persian):
  dashboards, task cards and avatars, notifications, checklists, progress bars, bar and line
  charts, donuts, chat bubbles, the phone status bar, the browser bar and the cursor path.
  Numbers and web addresses stay left to right; notification times are localised.
- New piece option `direction`: `auto` (default, follows the sentence), `ltr` or `rtl`, for
  an English app shown inside a Kurdish video and the reverse.
- The automatic storyboard writes Arabic and Persian example words, reads Arabic and Persian
  keywords, and splits Arabic lists joined with و.

## 5.6.0: Automatic storyboard

- `pnpm tempoloom storyboard SCRIPT.txt --product NAME`: splits the script into one sentence
  per scene, reads what each sentence means and picks an animated piece for it
  (notifications for a problem, the product in a browser or phone, task cards flying to
  people, a dashboard, a rising chart, a counter, a chat, avatars, a checklist, the call to
  action), using the brain's recipe for the genre.
- Pieces are filled from the sentence's own numbers and lists; every guessed detail is listed
  under "Check before rendering" in `storyboard.md` for approval. Writes a valid
  `request.json` for `video:create`.
- English and Kurdish (Sorani example words, Kurdish keywords, Kurdish digits and ٪).

## 5.5.0: Finishing tools

- `pnpm tempoloom media formats FILE --to 1:1,16:9`: one master in other shapes. Narrower
  shapes crop around a focus point (the speaker's face from `media reframe`); wider ones
  fit the whole frame over a blurred copy, so no text or design is cut off.
- `pnpm tempoloom media thumbnail FILE --title "..."`: picks the sharpest, best-exposed
  settled frame, adds the title in the language's font (last word in the brand accent)
  and the brand logo; PNG and JPEG under the YouTube size limit.
- Video requests take `formats` and `thumbnail`, made automatically after the final render.
- Editor `music` operation: background music lowered automatically while someone speaks
  (sidechain ducking) and back up in the gaps, with gain, fades, loop and offset.
- `pnpm tempoloom media voiceover` and `media voices`: ElevenLabs voice-over with word
  timings saved as a voice alignment for `video:create`; cached, and only when asked.

## 5.4.0: Apache-2.0 license; only openly licensed material

- Tempoloom is licensed under the Apache License 2.0 (`LICENSE`, `NOTICE`).
- Removed everything without a license allowing redistribution: the 7 Kurdish fonts
  (NRT, Rudaw, Sirwan, UniSalar, Rabar 007/010/021), 31 sound effects, 34 third-party
  reference frames, 7 comparison images and 7 editable SVGs with an embedded font. They
  were also erased from the git history.
- Kurdish now uses open fonts that cover every Kurdish letter: Vazirmatn (default), Noto
  Sans Arabic, Noto Kufi Arabic, Noto Naskh Arabic and the newly added Amiri; saved
  projects that used a removed font render with Vazirmatn.
- Reference styles keep their written descriptions; the per-frame notes in `style.md`
  are now the anchors scenes cite. The 11 remaining sounds are CC0.

## 5.3.0: The brain: Tempoloom learns and gets better

- A knowledge database (SQLite built into Node 22, in `.tempoloom/brain.db`) committed as
  `agent/brain/knowledge.jsonl` and `jobs.jsonl`, so it rebuilds on any computer.
- Starts with about 90 curated entries on motion design and video editing (principles,
  timing and easing, transitions, 20 styles, editing techniques, platform facts, genre
  recipes, Kurdish and RTL practice, things to avoid) plus the user's 8 reference
  styles, 16 motion references, every guide, and the feedback rules.
- Learns from four sources: every finished video and edit (recorded automatically),
  the user's feedback (rules, and a verdict on the job), the user's references
  (`brain learn-reference`), and web study sessions (`brain study`, through Reach).
- Measured facts and feedback apply at once; web findings stay `trial` until two
  approved jobs prove them; items in repeatedly rejected jobs retire. The user can
  approve, reject or retire any item.
- `brain recall` before every video and edit, `brain apply` and `brain verdict` to score
  what was used, `brain report` to show whether recent work gets approved faster.

## 5.2.0: Animated scene pieces

- A library of ready-made, brand-coloured, animated scene pieces for new videos: phone
  and browser mockups (with any other piece as their screen), dashboard with counting
  stat tiles and a chart, task cards that fly to team avatars (or tick off), bar, line
  and donut charts, a big counter, progress bars, stacking notifications, a checklist,
  a chat with typing dots, avatars, and images with a slow zoom.
- A cursor that moves along a path and clicks with a ripple; designed scene transitions:
  wipe, push, zoom-through, mask-reveal, circle-reveal, fade.
- Requests take `sceneVisuals: [{match: "words of the sentence", piece: {...}}]` (or a
  scene index) and an optional `pieceTheme`; colours come from `config/brand.json`, and
  highlighted words use the same primary colour. The sentence stays on screen as the
  headline above (or below) the piece. A piece longer than its scene plays faster so it
  always finishes.
- `pnpm tempoloom pieces` lists the kinds with an example each; `pieces check REQUEST.json`
  validates a request and lists sentences without a piece.
- Workflow, policies, production design template and skill: every scene gets a piece.

## 5.1.1

- Learned rules are read correctly from `memory.md` on Windows (CRLF line endings).

## 5.1.0: Learning from your feedback

- `pnpm tempoloom feedback add`: every rejection, correction or specific praise is
  recorded at once, without waiting for approval. The user's words go to
  `agent/knowledge/feedback.jsonl`; a rule written for future videos goes to the
  "Learned from your feedback" section of `memory.md`. The same point said again is
  merged and counted, and the newest wording wins.
- `feedback lessons --for "<brief>"`: the rules to apply to a new video. A rule seen twice,
  or one from a rejected video, applies to every video; others apply when the brief
  matches their topics. `feedback list` and `feedback forget ID` manage them.
- The workflow loads the rules at intake, lists them as "Lessons applied" in the
  production design, checks them before every preview, and records feedback during
  review. The Flowly rejection is the first saved rule.

## 5.0.2: Instagram profiles and posts from the page

- When Instagram's data API refuses (HTTP 404 even when logged in), `reach instagram
  profile` and `reach instagram posts` read the profile page itself in the Tempoloom
  browser: name, follower, following and post counts from the page, and recent posts
  and reels with their captions and links. A login page gives NEED_LOGIN.

## 5.0.1: Reach fixes from the first live check

- Site errors such as HTTP 404 from a site API, "not found", page layout changes and empty
  results are treated like Agent Reach does (broken, not "not found"), so the next backend
  or the public web is tried and a missing login turns into NEED_LOGIN. Dribbble search
  falls back to web search when its page layout changes.
- X needs both `auth_token` and `ct0` to count as logged in.
- YouTube transcripts: when yt-dlp gets no subtitles, OpenCLI's transcript reader is tried
  next; the ElevenLabs step no longer hides the real error.
- `reach check` lists what each backend answered.

## 5.0.0: Reach, social platforms and the agent's browser

Agent Reach's core ported into Tempoloom (TypeScript), with its tools and Tempoloom's own
channels:

- `pnpm tempoloom reach <channel> <action>`: read-only access to YouTube (search, video,
  transcript, comments, channel), Instagram, TikTok, X, Facebook, Pinterest, Dribbble,
  Behance, Threads, Vimeo, Reddit, LinkedIn, Bluesky, Product Hunt, Google (images,
  trends, news) and GitHub; `reach read URL` routes any link by itself.
- Agent Reach's logic: ordered backends with fallback, final error codes that stop at
  once, one JSON result shape with hints, search spacing per site, browser slots (2 per
  site, 4 overall), a one-hour pause after a rate limit, short pauses for broken
  backends, public web first for sites not set up, and a public last resort.
- Agent Reach's tools: OpenCLI 2.0.2 (project dependency, read commands only, write
  commands refused), its browser extension (downloaded once, hash-checked), yt-dlp
  (installs itself into .venv at the tested version), Jina Reader, Exa search, and
  optional CloakBrowser.
- The Tempoloom browser: its own profile, hidden, closes after 10 minutes unused, a
  window only for logging in; site logins copied once from the user's Chrome (that site
  only) or made by the user in the window; saved and restored between runs.
- `reach download URL [--confirm]`: study-only reference downloads from any of these
  platforms with that site's login; `reach youtube transcript` uses subtitles first and
  ElevenLabs only with `--allow-upload`.
- `pnpm tempoloom browse`: open, read, extract, scroll and screenshot any page in the
  Tempoloom browser; eval and upload need `--confirm`.
- `reach add|login|logout|remove|doctor|check|update|uninstall`, workflow research
  stage, policies, production design template and skill updated.

## 4.4.0: Free sources and reference videos

- `pnpm tempoloom source search|get`: free 3D models, textures and HDRIs (Poly Haven),
  icons (Iconify), images (Openverse, Pexels, Pixabay), stock video (Pexels, Pixabay),
  sounds (Freesound, Openverse) and music (Openverse). Every result is classified as
  final, study or blocked; blocked licenses (NC, ND, unknown) are never downloaded, and
  each download keeps a `source.json` with its license and attribution line.
- `source render-3d`: glTF/GLB models to transparent PNG views and a transparent
  turntable with three.js in Chromium.
- `source reference URL [--confirm]`: reference videos with yt-dlp (added to the media
  tools), info first, download only when confirmed, always study only.
- `source credits`, `source list`, `source doctor`; new keys `PEXELS_API_KEY`,
  `PIXABAY_API_KEY`, `FREESOUND_API_KEY` (all free) in `.env.example`.
- Workflow, policies, production design template and skill use the free sources in the
  Research, Prepare and Deliver stages.

## 4.3.0: Research and production design before building

- Workflow now has eight stages: a **Research** stage (the product's facts and brand
  from its official site, its existing videos, and current examples of the genre on the
  web plus the local reference styles, all with sources) and a **Production design**
  stage that fills `agent/templates/production-design.md` (goal, product facts, brand,
  references, concept, script, storyboard, visual system, motion system, voice, music
  and sound, timing, assets, deliverables, risks) for approval before anything renders.
- `pnpm tempoloom media brand-scan URL [--download]`: logo candidates, theme colour,
  ranked CSS colours and fonts from a product's website.

## 4.2.0: One workflow for every request

- `agent/workflow.md`: seven stages every request follows (Intake, Brief, Plan with
  approval, Prepare, Build, Review with approval, Deliver), with a routing table for
  prompt-only, script, reference, footage, revision and resume requests, a storyboard
  format, mandatory checks before every preview and delivery, and a fast lane that
  skips approvals but never the checks. Linked from the skill, agent.yaml and AGENTS.md.

## 4.1.0: Pure reusable reference styles

- `references/` is now eight reusable styles and sixteen motion references, written as
  text with only the frames that matter: 274 files and about 158 MB became 120 files and
  20 MB. Each style has `style.md` (look, measured palette, rhythm and motion, all
  observations, the shared prompt base), `style.json`, 3–6 frames and a motion sheet in
  place of its clips. `references/catalog.json` indexes everything.
- Removed duplicates and raw material: the numbered `references/styles/style-1..7`
  copies, the style-library review evidence, every reference video (now motion sheets
  and notes) and the old prompt package (in git history).
- The engine reads the catalog: card evidence, numbered presets, reference folders and
  older saved anchors resolve to the kept frames.
- `pnpm tempoloom media style FILES --save --name NAME` adds new references the same way.

## 4.0.0: A new name

The project was renamed. The package and command, the skill, the status helper, the local
status folder and the brand kit all followed, with the wordmark redrawn in Fredoka Bold.

## 3.7.0: Transcription, captions, tightening, brand layer and style briefs

- `media transcribe`: word-timed transcripts with ElevenLabs Scribe (the chosen
  provider), cached by audio hash; Kurdish sent as `kur`.
- `media captions`: readable SRT cues; with `--script` the text is exactly the user's
  script, timed from the recognised words (lenient Kurdish matching).
- `media tighten`: an edit list that removes pauses, filler words and dead air, keeps
  breaths, retimes captions and can add the brand layer.
- Editor `brand` operation: logo watermark and an animated end card from
  `config/brand.json`.
- `media style`: reference style brief with palette roles, cut rhythm, motion energy
  and easing, plus saved frames and *by eye* sections.
- Policies: ElevenLabs-only transcription and voice-over (voice-over only on request),
  image generation only with a tool the host agent has. Doctor reports the key.

## 3.6.0: Motion and design are mandatory

- New standing rules in `agent/policies.md` (Motion and design): no static or
  text-on-blank scene, every scene shows its sentence with designed visuals, one
  consistent branded style, a visual event every 1-2 s in 2-5 s scenes (about 70-80
  words and 6-8 scenes per 30 s), eased staggered animation with designed transitions,
  a rendered MP4, and a per-scene summary on delivery.
- The skill, persona, script-to-motion mode, editing guide, rubric, memory and a new
  eval task (E11) apply the rules. Missing screenshots or logos are drawn as stand-ins,
  never replaced by text only.
- `pnpm tempoloom media pacing FILE`: fails a video with stretches that do not move
  for more than 1.5 s or plain text-on-background frames; required before delivery.

## 3.5.0: Voice separation, stabilization, quality checks, Lottie and overlays

- **Demucs** (`media separate`): split voice from music and noise, or into four stems.
  Uses the CUDA torch already in `.venv`; models download only with `--allow-download`.
- **OpenCV** (`media quality`, `media motion`, `media stabilize`): sharpness, exposure
  and noise checks; camera pan, zoom and shake; stabilization that keeps the audio.
- **lottie-web** (`media lottie`, `media lottie-info`): render Lottie animations
  frame-exactly in Chromium to transparent ProRes `.mov`, VP9 `.webm`, PNG frames or
  `.mp4`. Example: `examples/lottie/slide-box.json`.
- **Editor `overlay` operation**: place images and videos (logos, lower thirds, Lottie
  clips) over footage with position, width, timing, opacity and looping; transparency
  is kept.
- Tool registry: stabilization, overlays and noise reduction are ready; new
  `analyze-quality`, `analyze-motion` and `asset-lottie`.
- Cut-outs use the CPU ONNX Runtime shared with faster-whisper, because the GPU build
  conflicts with it.

## 3.4.0: Media tools

- **New `media_tools/`** (Python, optional, `pnpm media:setup`):
  silence detection with auto-editor, shot and rhythm detection with PySceneDetect,
  tempo and beats with librosa, face-aware reframing with MediaPipe, and background
  removal with rembg (BiRefNet). One command: `pnpm tempoloom media ...`.
- Silence and reframe results write ready `cut` and `reframe` operations for the
  footage editor (`--edl-out`). Models download only with `--allow-download`.
- Tool registry: silence removal and auto-reframe are now ready; new `media-setup`,
  `media-doctor`, `analyze-scenes`, `analyze-beats` and `asset-cutout`.
- `pnpm tempoloom doctor` reports the media tools; `pnpm test:media` runs their tests.
- Model pointers for the audio pipeline are stored relative to the cache, so models
  survive moving the project folder.

## 3.3.0: One skill, one source tree

- **One skill:** `skills/tempoloom/` is the only skill. The old code-motion-shorts,
  custom-motion-shorts, video-production and legacy skills were removed; their
  working rules live on as guides (`docs/guides/layered-assets.md`,
  `docs/guides/style-cards.md`). Codex metadata moved to `skills/tempoloom/agents/`.
- **Source:** command entry points moved from `scripts/` to `src/cli/`; the footage
  editor moved from `packages/editor/` to `src/editor/`. `scripts/` now holds only
  developer tools (checks, benchmarks, smoke tests, skill sync, status helper).
- **Config:** the brand profile is `config/brand.json`; agent strings are in
  `agent/locales/`.
- **Assets:** flat vectors and their manifest are in `assets/library/vectors/`,
  backgrounds in `assets/library/backgrounds/`; finished example scenes moved to
  `examples/scenes/`. The duplicate `assets/Rabar_021.ttf` was removed; saved
  projects that use it load the identical `assets/fonts/Rabar-021-Bold.ttf`.
- **References:** the seven styles are in `references/styles/style-1..7`; the style
  review sits inside the library at `references/style-library/review/`. The extracted
  old skill source, the one-time handoff archive and its organizer script were removed.

## 3.2.0: Leaner, scalable layout

- **Layout:** all TypeScript source in `src/`; living guides in `docs/guides/`,
  historical records in `docs/records/`; `references/` holds only reference media
  and style catalogs; memory in `agent/knowledge/memory.md`. See `docs/MIGRATION.md`.
- **Styles:** removed 11 old presets (premium-viral, word-reveal, active-word,
  text-bounce, spring, object-motion, saas, statistics, camera, clay,
  premium-transition) and the retired Citron Clay and Violet Cutout cards. `kinetic`
  (text only) is now a normal preset for new videos.
- **Assets:** kept only consistent 3D objects. Removed 2D illustrations, flat shapes,
  near-duplicates, test recolors, the origami set and per-scene copies
  (1,035 files, 283 MB to 790 files, 151 MB).
- **References:** added 20 reference videos that were only on the maintainer's
  machine. A full third-party YouTube download stays local and links to its source.
- **Scripts:** removed 29 one-off scripts for past videos, demos and migrations.
- **.env:** commands now load `.env`; `.env.example` documents every setting.

## 3.1.0: Agent foundation (English default, Kurdish first-class)

- **Agent:** new `agent/` with manifest, persona (senior motion designer and editor),
  policies, three mode playbooks (script to motion, reference match, footage edit),
  briefing questions (at most five, only what is missing), a 69-tool registry
  (8 planned), a knowledge index with source and license per entry, ten golden
  evals and a rubric. Knowledge updates are proposals that wait for approval.
- **Languages:** English is the default. Language is detected from the script
  (Kurdish letters select Sorani, Persian letters Persian, other Arabic script
  Arabic, otherwise English). `config/locales.json` maps each language to its
  direction and fonts; `locales/` holds agent strings (non-English drafts need
  native review).
- **Fonts:** Kurdish uses only the existing Kurdish fonts; other languages use six
  bundled OFL fonts chosen by style. The Latin fallback is bundled, so renders no
  longer depend on Windows or Linux system fonts. No hardcoded font in instructions.
- **Editor:** `packages/editor` edits footage from an edit decision list: trim,
  split, cut, concat, crop, reframe, zoom, speed, fades, gain, two-pass loudness,
  resize and right-to-left caption burn-in. Never modifies inputs or overwrites outputs.
- **Automatic motion:** on by default from `config/brand.json`; a request can set
  `autoMotion: false`.
- **Setup:** `tempoloom` command, `tempoloom init`, a fuller `doctor`, and the
  `hello-en` / `hello-ckb` examples.
- **Open source:** README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, templates, CI,
  THIRD_PARTY_LICENSES; license decision pending (`LICENSE.todo.md`).
- **Fixes:** 29 broken symlinked PNGs replaced with real files; sound index paths
  made relative; one skill source of truth with a synced Claude Code copy.
- Saved projects keep their language, fonts and look. See `docs/MIGRATION.md`.

## Portable motion production skill

- Consolidated the default create, review, resume and export workflow into
  `SKILL.md`. The former production skill forwards to it.
- Moved the layered scene and scene packet guides from `output/` to
  `references/` and updated the storyboard command, skills and local indexes.
- Removed three verified byte-identical duplicates: the root Pendulum fit JSON,
  the archived green-brand video and the archived Raycast video. Removed the
  duplicate archive's guide and empty folders. The canonical copies remain.
- Retired Citron Clay, Violet Cutout and new clay preset creation. New reference
  jobs require 3D object records and still require provenance and visual review.
  Saved jobs and render dependencies retain their original style data.
- Added a short-form editing guide and a searchable local memory file. The
  root skill uses both when planning new work.

### Folder tree

```text
SKILL.md          Portable agent workflow
AGENTS.md         Repository development and production invariants
README.md         Setup and command reference
CHANGELOG.md      Migration record
references/       Production guides, reference footage and evidence
memory/           Verified techniques, setup notes and preferences
assets/           Fonts, asset masters, variants, audio and provenance
scripts/          Command entry points and checks
engine/           Planning, project state and validation
renderer/         Deterministic capture, audio mix and encoding
components/       Scene and layer renderers
animations/      Registered motion behaviors
config/           Runtime configuration and reference evidence
presets/          Reusable and compatibility settings
motion-library/   Reference indexing and search
audio_pipeline/   Optional local speech analysis
skills/           Specialized workflows and compatibility entry points
templates/        Authoring templates
examples/         Sample inputs
tests/            Verification
workspace/        Local requests, jobs, pinned inputs and history
mp2/              Video exports
output/           Historical work and optional examples
```

The collection catalog and visual review now live under `references/`.
Saved evidence paths using the former catalog location still resolve to the
same checksummed anchors. The shared Claude Code and Cursor entry point lives
under `.claude/skills/`. Historical handoffs, saved media and prior exports
were preserved.
