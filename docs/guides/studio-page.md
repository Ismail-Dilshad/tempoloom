# The Studio page's design

The page (`pnpm tempoloom studio open`) is one shell with five places. Everything starts in the
prompt box; everything else opens in one panel on the right. The engine behind it does not change:
the page is `src/teach/ui/` talking to `src/teach/server.ts`.

## The shell

| Region | Size | What it does |
| --- | --- | --- |
| Top bar | 64 px | Page name, search everything (Ctrl+K), the bell, and your menu for settings, history, and backup |
| Rail | 232 px, 72 px collapsed | Create, Projects / Library + / Tools, Brain; your agent's face, Trash, Collapse |
| Canvas | up to 1280 px of content | The place: tabs, a title, its grid or its workspace |
| Prompt box | 600 px, pinned 24 px from the bottom | On Create, starts a video; inside a project, says what to change |
| Right panel | 480 px | One at a time: rules, settings, a tool, help; pushes the canvas on wide screens, covers it below 1280 px |
| Picker | 780 × 580 px | Files for this video by kind, or from your library; search, upload, preview |

Below 1280 px the rail shows icons only; below 768 px it becomes a drawer behind the menu button,
the prompt box spans the screen and panels become full-height sheets.

## Places and old addresses

| Address | Place | Screen file |
| --- | --- | --- |
| `#/create` | Create (home) | `create.js` |
| `#/projects`, `#/projects/JOB`, `#/projects/finished` | Projects, a workspace, finished videos | `places.js`, `studio.js`, `gallery.js` |
| `#/library`, `#/library/looks`, `#/library/scenes` | Your media, Looks, Scenes | `places.js` |
| `#/library/references`, `#/library/teach`, `#/library/tidy` | Taught videos, Teach a video, Find and tidy | `teach.js`, `find.js` |
| `#/tools`, `#/tools/text`, `#/tools/trends` | Tools, Edit by text, Trend watch | `places.js`, `text.js`, `ideas.js` |
| `#/brain/taste`, `#/brain/lessons`, `#/brain/worked` | Taste, Lessons with patterns, What worked | `taste.js`, `learned.js`, `studio.js` |
| `#/settings`, `#/settings/appearance`, `/history`, `/backup` | Settings | `settings.js`, `places.js`, `history.js`, `backup.js` |
| `#/trash` | Trash | `places.js` |

Every older address (`#/home`, `#/studio/new`, `#/studio/videos/JOB`, `#/teach/lessons`, `#/find`
and the rest) is rewritten to its new place, so links in docs, messages and bookmarks keep working.
The tables are `PLACES`, `ROUTES`, `REDIRECTS` and `TABS` in `core.js`.

## Design tokens

`tokens.css` defines the colour, type, spacing, radius, shadow, motion and layer values for the dark interface.

| Token | Colour | Use |
| --- | --- | --- |
| `--bg` | #151A21 | Page and canvas |
| `--surface-1` | #1C222B | Panels |
| `--surface-2` | #1C222B | Cards, prompt box, menus |
| `--surface-3` | #29313C | Hover, selected, chips |
| `--text` / `--text-2` / `--text-3` | #EEF2FA / #A3ADC2 / #A8B1BF | Text, secondary, hints |
| `--accent` | #659EFF | Focus, selection, progress, links |
| `--accent-fill` | #2F6BE0 | Filled buttons with white text |
| `--good` / `--warn` / `--bad` | #4FD1A5 / #F2C14E / #FF7A7A | Done, waiting for you, failed |

Text and hints are at least 4.5:1 against the main surfaces (`tests/studio-shell.test.ts`).
Type is Inter (open licence, `assets/fonts/open/`), with Noto Sans Arabic for Arabic script, on a
scale of 28 / 22 / 18 / 15 / 14 / 13 / 12 px. Spacing is a 4-point scale; radii are 6, 8, 12, 16, 24
and full; motion is 120, 180 and 260 ms on one easing, and reduced motion turns slides into fades.

## Icons

Studio uses Lucide 0.562.0, the same outline icons used by the Sponsor.krd business dashboard.
The icon registry is in `src/teach/ui/icons.js`, with the upstream licence in `assets/icons/lucide/LICENSE`.
Header actions use a 16 px glyph in a 40 px button. Compact row actions use a 16 px glyph in a 32 px button.


## Notifications

Notifications follow [Sileo](https://sileo.aaryan.design) (MIT, by Aaryan): a 40 px pill with a tinted
badge and a coloured title appears at the top centre, springs open into a rounded body with the
message (the two shapes joined by an SVG "gooey" filter), closes back into the pill two seconds
before it leaves, and opens while you hover or focus it (its timer waits). Escape dismisses it.
Notifications use a light surface (`--toast-*` tokens). A confirmation lasts
6 s ("Done") and an error lasts 9 s ("Something went wrong", read out at once). The spring curve
(`--spring`) and the filter's values are Sileo's; the code is our own, with no package added
(`toast()` in `core.js`).

## Components

One of each, used everywhere (`shell.css`, `shell.js`): the top bar, the rail and its links, the
right panel (`Panel.open`), small menus (`Pop.open`), overlays (`Overlay.open`), the command menu
(`Cmd`), the prompt box (`Dock`), buttons (primary, secondary, ghost, danger; 32, 36 and 44 px),
round icon buttons, chips, badges (Making, Waiting for you, Done), progress bars, shape and length
tiles, radio cards, project cards, idea cards, tool cards, scene cards, list rows, tabs and empty
states. Each has hover, pressed, keyboard focus, selected and disabled states.

## Adding something without adding a page

- A tool: add a `page` (name, icon, group, one line, and `open` if it has a page) to its entry in
  `agent/tools/registry.json`. It then shows on Tools, in Ctrl+K and in every project's Tools panel.
- A new kind of video: an entry in `KINDS` (`create.js`).
- A new screen: a tab in an existing place (`TABS` and `ROUTES` in `core.js`), never a rail item.
- A new look: a new token or a variant of a component, never a one-off colour.

## Keyboard

Ctrl+K searches places, tools and everything you made · `/` writes in the prompt box · Enter sends
(Shift+Enter for a new line) · Esc closes the top menu, picker or panel · `[` collapses the rail ·
G then C, P, L, T, B or S goes to Create, Projects, Library, Tools, Brain or Scenes.

## Kept simple on purpose

The rail has five places; a project shows its newest video and what waits for you, with every step,
the team and the request folded under Details; the prompt box's Settings shows four choices, with
the rest under More options; Brain has three tabs. Every feature is still there, one fold or one
Ctrl+K away.
