# Tempoloom editor comparison

## What changed the first impression

The previous editor had the right panel order. The larger differences were the blue tint across nearly every surface, the amount of space assigned to the player, and control sizes inherited from the Studio shell. At the same screen size the library was about 34 px narrower than the reference. A timeline button actually measured 38 px square even though its editor rule requested 26 px. Editing the icon drawing alone would have left that problem in place.

## How to read the measurements

Both supplied desktop images show the same workspace. One shows an empty project. The other shows an imported video selected on the timeline. The measurements below use the 1919 × 1079 image frame as the coordinate system. Reference numbers are approximate visual bounds. Tempoloom numbers are rounded Chromium CSS pixels at the same viewport, in a fresh project with default panel sizes and reduced motion. The current font family and colors come from Tempoloom's implementation. A screenshot does not establish the reference application's font file, keyboard shortcuts, hidden menu contents, export quality or tool algorithms.

| Region | Reference x, y, width × height | Tempoloom before | Tempoloom after |
|---|---|---|---|
| Media library | 9, 36, 738 × 560 | 8, 42, 704 × 562 | 8, 36, 733 × 568 |
| Inspector | 754, 36, 645 × 560 | 718, 42, 647 × 562 | 747, 36, 647 × 568 |
| Player | 1406, 36, 505 × 1035 | 1371, 42, 540 × 1029 | 1400, 36, 511 × 1035 |
| Timeline | 9, 602, 1390 × 469 | 8, 610, 1357 × 461 | 8, 610, 1386 × 461 |
| Empty import target | 141, 90, 594 × 373 | 139, 95, 562 × 436 | 139, 89, 591 × 418 |
| First empty-state action | 141, 504, 194 × 80 | 139, 539, 183 × 54 | 139, 515, 193 × 79 |

The import area still extends about 45 px farther down because Tempoloom omits the reference's explanatory divider. Saved panel widths override these defaults. Dragging a divider changes the geometry, and double-clicking it restores its default.

## Color, type and controls

| Detail | Reference appearance | Tempoloom difference and action |
|---|---|---|
| Background hierarchy | Near-black surround, neutral charcoal panels, lighter gray headers and import target | Changed surround from #171a22 to #1c1d20, panels from #222631 to #26272a, headers from #292e3a to #303237 and fields from #191d26 to #202124. |
| Active color | Saturated cyan marks the active tool, switches, export and elapsed time. Selection handles and the playhead look white. | Changed pale blue #a7c8ff to mint #79ded1. The playhead still uses that accent. The blue video, green audio and purple text clips retain Tempoloom's track colors. |
| Edges | Dark gutters do most of the separation. Header dividers are thin. | Tempoloom outlines panels in addition to using gutters. Panels have a 6 px radius. Inspect contrast at real size before making borders more prominent. |
| Font | Small sans-serif labels. Toolbar captions look about 10–11 px. Inspector values appear about 11–12 px. | Browser reports Tempoloom UI with system fallbacks. Tabs use 10 px/600, property tabs 11 px/600, project title 12 px/500, time display 12 px/500. Match visual weight, spacing and numeric alignment. The reference family is unidentified. |
| Category icons | Distinct silhouettes above labels, roughly 15–17 px. Media has a filled active icon. | Local outline icons measure 15 × 15 inside tabs measuring at least 43 × 41. Selection adds an underline. Film, music, text, shapes, wand, transition, captions, filter, sliders and layers are the actual local glyphs. |
| Small hit targets | Small glyphs with surrounding clickable space. Click bounds cannot be measured from the image. | Timeline hit targets now measure 28 × 28 inside a 34 px strip. The underlying glyphs are smaller. Keep button and glyph sizes independently adjustable. |
| Header | Brand mark, Menu, timestamped autosave, centered title, workspace controls, upgrade, Share, Export, native window controls | Tempoloom uses a back link, text brand, save indicator, editable centered title, shortcuts, mock Share and real Export. Export measured 90 × 26 versus about 66 × 22 visually in the image. There is no desktop window chrome in the web workspace. |
| Disabled and selected states | Gray disabled operations, bright active tabs and switches, diamonds beside animatable values | Tempoloom uses pressed states and diamonds. Future controls previously looked actionable and received keyboard focus. They now use native disabled semantics and retain their coming-soon descriptions. |

## Media library

| Feature | Empty and selected reference states | Tempoloom result |
|---|---|---|
| Category strip | Media, Audio, Text, Stickers, Effects, Transitions, Captions, Filters, Adjustment, Templates, AI avatar | First ten have local entry points. AI avatars appears as an empty-state placeholder and disappears once the library has visual media. |
| Source rail | Six expandable rows for Import, Yours, Generate, Spaces, Library and Dreamina. There are chevrons and a small AI badge. | Four rows for Import, All media, Generate and Cloud library. Import opens the picker, All media clears the folder filter. The last two are placeholders. Local folders already exist through the media card menu. |
| Empty actions | Large import target, explanatory divider, then Generate, AI avatars and Record | Import and file drop work. Three secondary tiles are placeholders. Voice-over recording is a separate working audio tool. Screen recording needs its own capture flow. |
| Populated toolbar | Import, Record, search, view, sort and filter. “All” sits above the thumbnail. | Import, screen-recording placeholder, text search and an item count. The current view has no equivalent grid/list, sorting or filter menu. Folder chips appear when folders exist. |
| Media tile | Compact card, thumbnail, Added badge, duration and truncated filename | Local thumbnail cell can reach 112 px wide and uses 3:2. Added and duration are overlays. Add/remove buttons appear on hover or focus. The source clip duration, thumbnail and filename influence comparisons. |

## Inspector

| Feature | Reference | Tempoloom difference |
|---|---|---|
| Empty details | Name, path, import location, layer ordering, proxy, ratio, resolution, FPS and Modify | Local details show name, editable shape, resolution, duration, clips/tracks, background, proxies and markers. Browser projects use IndexedDB. There is no meaningful native project-directory path to display. |
| Selected video categories | Video, Audio, Speed, Animation, Adjust, AI stylize | Local video exposes Video, Adjust, Colour, Effects, Mask, Animation, Audio and Speed. Available tabs vary with clip type. AI stylize has no equivalent tab. |
| Secondary strip | Basic, Remove BG, Mask, Retouch | Local strip has Transform, Smart tools, Mask and mock Retouch. Smart tools scrolls to the section containing real background removal and stabilization. Mask also exists in the main tab row. |
| Transform | Scale rail and numeric percentage, uniform-scale toggle, separate X/Y, rotation number and dial, alignment icons, reset and keyframe navigation | Local scale, position, rotation, flip, reset and keyframe controls work. Scale is uniform. The reference's independent-axis switch, alignment strip and rotary dial have no corresponding controls here. Drag handles and inspector now both offer 10–500% scaling. Typed input validation is a separate open issue. |
| Lower property sections | Blend, Stabilize, Enhance quality and Reduce image noise appear as compact expandable rows | Local Crop sliders appear early, ahead of Smart tools and Opacity and blend. This pushes blend and stabilization down. Enhance quality and image denoise are separate feature gaps. |
| Tool entitlement and tips | Upgrade diamonds, remaining-use count and yellow layer-order tip | Tempoloom has no matching entitlement model shown here. Display only real availability and usage information. |

## Player and timeline

| Detail | Reference | Tempoloom difference |
|---|---|---|
| Player title | Player–Timeline 01 and a menu glyph | Preview, aspect ratio and an editable nesting breadcrumb when applicable. No corresponding player menu. |
| Empty canvas | A continuous dark monitor well | Local frame displays the project's actual background inside the well. A visible black rectangle can be a valid project background. |
| Selected canvas | Square composition, object near the bottom, thin white bounds, handles, rotation grip below | The source content and project ratio determine composition. Tempoloom draws the rotation grip above and supports Shift angle steps. Compare using identical media and ratio before judging the fitting algorithm. |
| Transport | Elapsed/total, stereo indicator, central Play, Full, fit, Ratio and fullscreen | Local Play started over 100 px left of center at the reference size. Corrected on wide monitors. Loop, scopes, frame capture, guides and fullscreen are working local controls. Ratio is editable in Details. |
| Time notation | Four fields, including hours and frames | Local player uses minutes, seconds and frames with a fixed 30-frame display basis. The ruler strips that to minutes and seconds. Long projects and exports at other rates need explicit timebase handling. |
| Timeline tools | Add, pointer menu, editing groups, voice, toggle group, zoom and several icon-only tools | Local toolbar contains add track, undo/redo, split, duplicate, delete, trim left/right, freeze, mixer, marker, voice-over, magnet, snap and zoom. Some advanced edits live in context menus. The screenshots alone cannot identify every reference glyph's action. |
| Ruler and lanes | Ruler shows fine tick subdivisions and ten-second labels at the captured zoom. Empty image has a broad dashed drop lane. Populated image has a cover cell and one prominent clip row. | Local ruler labels adapt to zoom. Local projects show named text, main and audio tracks even when empty. Main row measured 60 px high. Track labels start before the clip area at x125. The reference clip starts near x181 with the cover cell visible. |
| Clip drawing | Teal title strip, thumbnail sequence, waveform along bottom, white selection outline | Local video has a blue title area, thumbnail strip and selection handles. Audio tracks draw waveforms. Embedded audio has no comparable waveform strip in the video clip markup. |
| Track controls | Small lock, visibility, speaker and more controls visible near the main row | Tempoloom has per-track lock, hide/mute where applicable, rename, resize, mixer and removal on additional tracks. Buttons differ by track type. |
| Overlays | Keyboard-shortcut conflict notification in the empty image only | This is a transient notification. Reproduce the underlying conflict before adding an alert. |

## Scope of the comparison

The screenshots show two states, not a complete feature specification. Audio processing, tracking quality, offline performance, export parity and every hidden shortcut require a separate behavioral comparison. Tempoloom already has nested clips, multicam, caption correction, proxies, title layers, scopes and audio mixing. Those workflows need regression coverage whenever visible controls move.
