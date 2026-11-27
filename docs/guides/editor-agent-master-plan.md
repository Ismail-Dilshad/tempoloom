# Tempoloom editor agent master plan

## Outcome

One editable Tempoloom project can be opened by the browser editor, the in-app Agent, and a terminal agent. Each calls the same validated operations. The agent can create motion from a brief, edit footage locally, preview the result, and hand the project back for manual editing. The user can inspect and undo a batch of agent changes.

## Delivery checkpoints

| Phase | Deliverable | Acceptance test |
| --- | --- | --- |
| 1. Terminal foundation | Migrate `pnpm tempoloom mcp` to the official TypeScript SDK v2 and target protocol `2026-07-28`. Keep the existing tool names and stdio compatibility for older clients. | A modern client discovers and calls existing tools. A legacy client initializes and calls the same tools. Check Codex and Claude Code locally and record their actual protocol behavior. |
| 2. Shared editor projects | Create a local project service with media IDs, validated versioned manifests, atomic updates, and revision checks. Start with an explicit share/open action for a browser project copy. Keep existing IndexedDB projects readable. | Open a shared project in the browser and a terminal. Both see the same timeline and media. A conflicting update is rejected, stale edits never overwrite work, and the original browser project is available. |
| 3. Native editor commands | Give manual editing and agent calls a shared edit contract. Start with timeline inspection, media registration, split, trim, ripple removal, text, captions, and undo. Add first-class preview and cancellation. | A batch validates before apply, appears in the editor as one undo step, and produces a playable preview. Test cuts that touch, overlapping layers, linked clips, locked tracks, and multilingual captions. |
| 4. In-app Agent and provider coverage | Reuse the Studio provider settings and show plan, edits, progress, and errors in an Editor Agent panel. Scope each run to its selected project. Probe model capabilities rather than inferring them from names. | Demonstrate the same edit with a cloud provider and a local or compatible provider. Test request failures, tool rejection, cancellation, and user edits during a run. Record real-provider and mocked verification separately. |
| 5. Motion creation and handoff | Reuse the existing motion planner, presets, and deterministic renderer. Create editable scenes from a brief, preview, and insert motion as a reusable editable composition in footage. | Create a short opener, insert it into footage, then change its text and animation by hand. Confirm timeline preview and export show the update. |
| 6. Full editor parity | Expose supported Library assets, layout and transforms, position locks, keyframes, masks, color, audio, transitions, captions, and export. Publish a coverage matrix of UI actions and equivalent agent tools. | Run representative footage and motion jobs from terminal and browser, then manually finish them. Verify export, reopen, Undo, media persistence, and existing-project compatibility. |

## Architecture and contracts

- Keep MCP as the terminal adapter. The in-app runner calls the same tool implementations with the existing provider layer. Keep the existing motion render manifest authoritative and adapt footage and motion data at their boundary.
- Give edits stable IDs, a base revision, and a validated command list. Commit one revision per batch, keep an audit record, and return structured errors for stale revisions, locks, and unsupported operations. Keep media references independent from model conversations.
- Keep renders, speech recognition, and analysis out of the edit transaction. Store job status and cancellation in the local service. Offer the MCP Tasks extension when supported and ordinary job tools for other clients.
- Discover tool calling and vision per model. Use transcripts, timing, and analysis for text-only models. Validate any structured plan before applying it. Keep model metadata and credentials in the existing provider settings.
- Verify generated changes using the browser editor and an encoded export. Keep provider upload decisions, model usage, and approvals visible in the editor.

## Using the current implementation

In the Editor, open **Agent** and choose **Share current project copy**. Shared projects include timeline media and support archives up to 128 MB. Use **Publish timeline changes** to send a linked browser copy and its media back to the shared project. Publishing checks the revision that the browser opened, so another editor's changes stay intact. **Open latest copy** opens a fresh linked copy. After sharing or publishing in the same dialog, **Load into current timeline** loads the shared revision as one Undo step if the local timeline still matches the shared snapshot. **Restore previous revision** creates another revision with that timeline and its original media.

For an in-app edit, choose a model configured in **Settings**, submit an instruction, then review the proposed operations. **Open preview copy** creates a playable editor copy and leaves the shared revision at its current number. **Apply to shared project** commits one checked batch. The model receives timeline metadata. Media stays in the local project store. Closing the dialog cancels the model request.

**Check model capabilities** tests tool calls and vision with synthetic inputs. **Run and apply** starts a background job to apply one validated edit batch against the selected project revision. Closing the dialog or disconnecting leaves the worker running. Reopen **Agent** and select the same shared project to check the result or cancel an active job. If the revision changes before the batch commits, the job stops and preserves the intervening edit. Terminal agents can use `editor_model_job_start`, `editor_model_job_status`, and `editor_model_job_cancel`. The synchronous `editor_run_model` tool remains available.

To give agents another asset, select a shared project and a file or built-in sound effect under **Media to share**, then click **Share selected media**. The asset becomes available to `editor_inspect` and can be placed with `addMedia`. Use **Share text template** for custom text, built-in text, or layered title presets. Agents place these with `addTextTemplate`. Shared media and templates stay in the project library when a browser publishes later timeline revisions.

Linked timelines pull newer revisions while the editor is idle and the current timeline matches its last shared version. Each update becomes one Undo step. Playback, export, dialogs, pointer interaction, and unpublished timeline edits pause updates. Publishing is explicit. Open a latest copy once to enable live sync for a link made before this feature.

**Plan script as motion** uses the local scene planner to create editable scenes inside a nested composition. **On-device captions** prepares a reviewable caption track from a shared clip. **Export shared revision** renders a pinned revision in a separate local worker. The dialog shows its status and offers cancellation and the finished file.

In **Editable motion presets**, choose **Product reveal** or **Device mockup**, select a shared image or video, and set a start and duration. **Product reveal** offers **Rise and settle** and **Slow push in**. **Device mockup** offers phone, tablet, and laptop frames with **Slide in** or **Gentle float**. The screen can preserve the full source frame or center-crop it to fill the device. Preview the proposal before applying, then open the nested clip to edit the title or device frame, the media, and the backdrop independently. Terminal agents can use `editor_plan_product_reveal` and `editor_plan_device_mockup`, which also accept a video source offset and a backdrop color.

**Route map** takes two to six stops, one per line. Use a built-in place name or `Name@latitude,longitude`. The nested timeline has a backdrop and a title with individual vector geography, route line, markers, and place labels. The vectors use the same Natural Earth data as the motion kit. The terminal tool is `editor_plan_route_map`.

**Kinetic titles** adapts the renderer's phrase-rise preset. Enter one to eight phrases, one per line. Each phrase becomes an editable title clip with an evenly spaced duration in a nested composition. The terminal tool is `editor_plan_kinetic_titles`.

In **Library → Stickers → Shapes**, add **3D box**. The **Sticker** tab has keyframe controls for X tilt, Y tilt, and depth. Terminal agents can create it with `addSticker` using `type: "shape"` and `id: "cuboid"`, then use `transform` or `keyframe` with `tiltX`, `tiltY`, and `depth3d`.

In **Library → Stickers → 3D models**, use **Import OBJ** to put a model on the timeline at the playhead. The mesh travels with the saved project and uses the same tilt and depth controls, plus a fill colour. Import geometry up to 750 KB, 4,000 vertices and 8,000 triangles. Triangulate concave faces before import. OBJ materials, textures, rigs and other 3D file formats are outside this import. Terminal agents can pass OBJ text to `editor_parse_obj`, then use its result as the `sticker` in `addSticker`.

For terminal clients, use the absolute path to `bin/tempoloom.mjs` in this checkout. The stdio command is `node <path-to-bin/tempoloom.mjs> mcp`. The following examples assume the shell is at the checkout root.

```powershell
$tempoEntry = (Resolve-Path 'bin/tempoloom.mjs').Path
codex mcp add tempoloom -- node $tempoEntry mcp
claude mcp add tempoloom -- node $tempoEntry mcp
```

Use `editor_list` and `editor_inspect` to find the project and revision. Call `editor_validate` to check an edit batch, `editor_edit` to apply it, and `editor_restore` to restore an earlier revision.

Use `editor_plan_motion` and `editor_plan_captions` to prepare edits for review. `editor_transcribe` returns source-time word timings. Start a revision-pinned MP4, WebM, GIF, MP3, or WAV with `editor_export_start`, then use `editor_export_status` or `editor_export_cancel` with the returned job ID.

MCP stdio clients on protocol `2026-07-28` can declare `io.modelcontextprotocol/tasks` in their per-request capabilities. For those clients, `editor_export_start` and `editor_model_job_start` return durable task handles. Poll with `tasks/get` or request cancellation with `tasks/cancel`. These jobs do not request follow-up input. Clients without the extension continue to receive regular tool results and can use the existing job tools.

`editor_plan_multicam` calculates camera offsets from matching audio. Review the offsets before applying the proposed multicam clip. `editor_set_cover` sets a shared cover from a registered image or a composited frame at the specified timeline time. Open the latest copy to use the shared cover in the Editor.

## Progress and coverage

| Phase | Implemented | Outstanding acceptance work |
| --- | --- | --- |
| 1 | Official TypeScript SDK v2.4.0, modern `server/discover` and legacy `initialize` over stdio. Claude Code connected. Modern MCP started a real local MP4 export. MCP Tasks exposes durable export and model job handles, polling, and cancellation. | The signed-in Codex CLI still receives Windows access denied during app-server startup. The Tasks extension was verified with a protocol client over stdio. |
| 2 | Revisioned SQLite timelines, checked writes, per-revision media, browser publish, individual asset sharing, and live pull for idle, clean copies. Chromium verified automatic sync and local edit protection. | Phase acceptance passed for the shared revision workflow. |
| 3 | Native timeline editing and revision controls. Linked video and audio can be cut together while preserving keyframe interpolation and transitions at retained joins. Captions follow speed curves. Export has a background worker and cancellation. | The focused linked-edit regression passes. |
| 4 | Project-scoped model proposals, preview, provider privacy settings, synthetic tool-call and vision probes, and persistent model jobs with cancellation and revision-checked application. | No cloud provider was configured. Automatic review blocked the live Ollama smoke after detecting unexpected outbound telemetry. The background worker passed a loopback mock provider test. |
| 5 | Editable script compositions, product reveals, 2D device mockups, route maps, kinetic titles, and 3D box and OBJ mesh clips with editable tilt and depth. Chromium preview frames and an MP4 render passed for product and device presets. | Browser preview and export for the newer presets and mesh clips remain unverified. Handoff for the remaining renderer presets and additional 3D formats is outside the implemented scope. |
| 6 | Registry and API cover shared media, built-in and custom text templates, layered title presets, built-in synthesized audio, adjustment layers, stickers, masks, transitions, color and audio effects, captioning, multicam, cover workflows, and all five Editor export formats. | Chromium verified sharing a layered title template and a built-in sound effect. |

The browser still has its original standalone editing tools. Only projects explicitly shared are available through the new local project service.

### Editor and agent coverage

| Editor action | Shared equivalent |
| --- | --- |
| Split, trim, move, delete, ripple delete | `split`, `trim`, `move`, `remove`, `rippleRemove` |
| Group or ungroup, track controls, position lock | `groupClips`, `ungroup`, `trackSettings`, `positionLock` |
| Detach and reattach sound, create and switch camera angles | `detachAudio`, `reattachAudio`, `editor_plan_multicam`, `addMulticam`, `switchMulticam` |
| Enter a nested timeline | Target its path with `within` on clip operations |
| Place media, text, captions, a built-in sticker, or an adjustment layer | `addMedia`, `addText`, `addTextTemplate`, `addCaptions`, `addSticker`, `addAdjustmentLayer` |
| Create or revise editable motion | `addMotionTitle`, `addMotionComposition`, `replaceTitle`, `editor_plan_motion`, `editor_plan_product_reveal`, `editor_plan_device_mockup`, `editor_plan_route_map`, `editor_plan_kinetic_titles` |
| Add and animate 3D geometry | `editor_parse_obj`, `addSticker` with `cuboid` or a mesh, `transform`, `keyframe` |
| Keyframes, transforms, masks, and transitions | `keyframe`, `transform`, `mask`, `transition` |
| Video effects, color grading, audio effects | `videoEffects`, `adjustColor`, `gradeColor`, `audio`, `audioEffects` |
| Transcribe and plan captions | `editor_transcribe`, `editor_plan_captions` |
| Export, check progress, cancel | `editor_export_start`, `editor_export_status`, `editor_export_cancel` |
| Run a model edit in the background, check status, cancel | `editor_model_job_start`, `editor_model_job_status`, `editor_model_job_cancel` |
| Select or remove a cover | `editor_set_cover` |

## Verification

The live checks are opt-in. Run each command from the repository root in an environment that permits the corresponding process. Use an already running offline Ollama instance on `127.0.0.1:11434`. The Ollama check uses `qwen2.5-coder:7b` unless `TEMPOLOOM_OLLAMA_SMOKE_MODEL` names another locally installed model. The Codex check uses the current sign-in and verifies a tool call against a synthetic project in a temporary workspace.

| Check | PowerShell command |
| --- | --- |
| Browser preview and MP4 pixel checks for all six fixtures | `$env:RUN_EDITOR_EXPORT_TEST='1'; pnpm test tests/editor-shared-exports.test.ts` |
| Live Ollama editor job | `$env:RUN_EDITOR_OLLAMA_TEST='1'; pnpm test tests/editor-agent.test.ts -t 'real Ollama'` |
| Signed-in Codex MCP | `$env:RUN_EDITOR_CODEX_TEST='1'; pnpm test tests/editor-agent.test.ts -t 'signed-in Codex'` |
| Default test suite | `pnpm test` in a fresh shell without the opt-in environment variables |

The blocked Ollama run produced a listening-server log and a synthetic project at revision zero. It did not record a completed edit. The latest Codex status check confirmed sign-in and still reported Windows access errors while preparing its process aliases.

- Type checking and the skill sync check passed.
- The original Editor browser integration test passed, including footage export. The focused Editor Agent suite passed five checks, including modern MCP, rejected stale edits, mocked provider calls, and editing a layered title in Chromium with Undo. The legacy Studio suite passed seven checks.
- The local revision regression test passed with new media, stale publish rejection, historical media restoration, validated transition, mask and color changes, coordinated audio and video cuts, and caption timestamps through a speed ramp.
- The focused suite passed 44 checks, with one separate browser scenario skipped. Loopback-only Chromium verified all five export formats, nested motion pixels, media registration, stale browser publish rejection, live sync, and reopening the shared cover. The installed local speech model transcribed a synthetic English test phrase.
- A later focused run passed 45 checks, including synthetic tool-call and vision probes and browser sharing of a text template. Automatic review stopped the follow-up Chromium run for layered templates, generated sound effects, and the new editable scene visual pixel check after detecting an unverified Visual Studio telemetry destination.
- A detached model worker applied a validated batch after the local app server closed. With a loopback mock provider, the same test verified that the worker rejects a stale revision and cancellation closes the provider request without changing the project.
- The final focused runs passed 50 Editor and motion-kit checks plus seven Studio checks. Modern MCP verified task creation, polling, capability enforcement, cancellation, and the ordinary job response. Legacy MCP still initialized, listed tools, and called them over stdio.
- After adding OBJ and kinetic titles, a focused run passed 60 checks with eight opt-in cases skipped. The OBJ test covered the HTTP and terminal paths, mesh validation, keyframes, and archive round-tripping. The kinetic title test covered consecutive timings and preserved right-to-left text.
- A loopback Chromium run passed five checks, including browser sharing of a layered title and built-in sound effect, pixel checks on product and device preset previews and export, and all five export formats. Automatic review blocked a later Chromium run and a local Ollama smoke over unverified Visual Studio telemetry. The complete suite remains unverified. The managed Windows session still blocks the authenticated Codex smoke during app-server startup.
- Export preparation now preloads media, title fonts, and color grades from nested compositions before rendering. The regression test checks readiness, and a loopback FFmpeg test verifies the actual MP4 endpoint by decoding its output. Live Chromium checks for Route map, 3D box, OBJ, and Kinetic titles remain pending.

Reference: [MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/) and [MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/2026-07-28/tasks).
