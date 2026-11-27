# Editor fixes and remaining work

Read the companion editor comparison for measurements. The order below prioritizes actions users can get wrong over cosmetic differences.

## Applied in this pass

| Issue | Change | How to verify |
|---|---|---|
| Shell minimum size overrode timeline button styling | Set editor-specific minimum dimensions and padding for timeline and playback icon buttons | At desktop size the first timeline button measures 28 × 28 inside the 34 px toolbar. |
| Preview too wide and panel tops too low | Adjusted default library share and shortened header row | At 1919 × 1079 the preview begins at x1400 and panels start at y36. Previously x1371 and y42. Saved custom widths still take precedence. |
| Blue cast obscured the reference's neutral surface hierarchy | Neutral charcoal surfaces, mint active state and larger empty-state tool tiles | Open an empty project, select a category and inspect the focused field, panel edges and disabled tools. |
| Saving and saved shared the same status color | Connected the pending state to the actual save callback | Rename a project. The status should read Saving… while pending, then Saved on completion. |
| Slider and preview disagreed about scale | Unified slider endpoints for visual and text clips with preview handle limits | Drag to 400%, select the clip again, and inspect the slider and numeric field. |
| Unavailable buttons entered the keyboard tab order | Used disabled buttons with accessible coming-soon labels | Tab through Media and the header. Working actions remain reachable. |
| Play drifted left as the preview grew | Centered Play with an independent middle column at monitor widths of 480 px or more | Resize the preview and compare its midpoint with the Play button center. Small monitors use compact controls. |

## Next fixes in order

1. **Make numeric entry consistent.** The inspector reads numeric values on input. An empty string converts to zero, and the number field's HTML limits do not clamp the value assigned to the model. Allow partial typing, validate on commit, and restore the last valid value on Escape. Test empty, negative, above-limit and keyframed values. Start in `editor-props.js`.
2. **Give timeline and transport one frame clock.** Decide which rate governs editing and persist it with the project. Use the same frame conversion for stepping, ruler labels, transport and export. Test a minute boundary, one hour and 24/25/30/60 fps. Older projects need their existing timing preserved. Start in `editor.js` and `editor-export.js`.
3. **Keep unavailable features identifiable.** Short tooltips are easy to miss on touch and disabled buttons cannot receive keyboard focus. Put a visible Coming soon label on grouped mock actions. Keep planned avatars reachable in both empty and populated media states. Use real local folder and library actions where possible.
4. **Improve media navigation.** Add name/type/duration sorting, type filtering and a grid/list switch above populated media. Apply folder, search and type filters together. Retain add, drag, source preview and removal in both views. Verify with long filenames, audio-only imports and RTL names.
5. **Make Transform and Blend easier to reach.** Collapse detailed crop and smart-tool sections by default, bring Blend closer to Transform and give background removal a direct shortcut. Keep mask, keyframe, grade and clip-specific tabs reachable. Add alignment only after defining whether it aligns the rotated bounding box or its unrotated frame.
6. **Clarify selection and rotation.** Test small clips and clips filling the frame so handles remain reachable near every edge. Add an angle readout during drag and a small zero-angle snap zone. Preserve intentional fine rotation and the existing Shift step.
7. **Show audio on video clips.** Reuse available peaks and map them through trim and speed. Reserve a narrow waveform strip below thumbnails. Hide it when the stream is silent or audio has been detached. Test long clips, zoom and split boundaries before considering multicam and speed ramps.
8. **Improve timeline orientation.** Add intermediate ruler ticks that scale with zoom. Offer a compact empty-track view. Preserve track names, locks, mute, visibility, drop targets and tab access. Add a cover cell only with a real cover-selection operation behind it.
9. **Finish project-details and player controls.** Show the real storage mode and actual editable frame rate when supported. A player menu can hold fit, guides, scopes and frame capture. Keep fullscreen and Play immediately accessible. A file-system path only makes sense for a file-backed project.
10. **Audit workspace sizes after customization.** Test 1920, 1440, 1280, 1024 and 390 px widths with default and restored panel sizes. Check long RTL titles, browser zoom, focus rings, toolbar overflow and access to the final tab. Measure the hit box and visible glyph separately.

## Feature work requiring implementation

Screen recording needs capture permissions, cancellation, cleanup and import of the result. Sharing and cloud storage need a destination, access rules and a clear distinction between local files and uploaded copies. Generative media, avatars, retouch, stylization, quality enhancement and denoise each need an actual processing path, progress and failure handling before enabling their buttons. Neither screenshot proves a particular algorithm or service.

## Verification

Type checking, skill synchronization and the focused editor suite passed. The suite covered 19 logic tests and one Chromium workflow including import, editing, export and project reload. The full repository suite ran on the earlier design revision. This audit used targeted checks on the new changes. Screenshot dimensions are visual estimates; the desktop browser measurements use default panel sizes.
