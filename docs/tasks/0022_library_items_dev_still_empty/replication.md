# Replication: 0022 library_items_dev_still_empty

## Preconditions

- Logged in at `https://napkin.dev.sdfles.com`.
- `develop` at `7a717e3` (merge of #34) or later deployed on dev.
- `APP_PASSWORD` for dev and the e2e token from the om-manager.

## Steps

1. Create a library and add two items to it from a diagram, as the e2e helpers do; open the library after the items are added.
2. Open a diagram, link the library, open the editor's Libraries panel.
3. Separately, import a `.excalidrawlib` file from the Libraries section.

## Expected

The panel section for the library shows two items; the imported library opens as a canvas with one frame per item.

## Observed

The panel section is there with 0 items; the imported library canvas shows the empty state (`empty-library-canvas`).

## Environment

- App version or commit: `7a717e3` on dev
- Platform, browser or device: chromium in GitHub Actions, `e2e-dev` job
- Environment: dev

## Evidence

- https://github.com/sebasfles/my-napkin/actions/runs/38497207353: `library-import.spec.ts:30`, `library-insert.spec.ts:29`, `library-insert.spec.ts:73`, `library-panel.spec.ts:27` red, each `Expected: 2, Received: 0`.
- 0020's run 35630985274 with the same failures before #34.
- PR #34's forensics on the bucket versions of 0020's run.

## om-developer confirmation

- 2026-10-13, `develop` at `7a717e3` deployed on dev, chromium from Sebastian's machine with `BASE_URL=https://napkin.dev.sdfles.com --trace on`: reproduced.
  `library-import.spec.ts:30` shows `empty-library-canvas`; `library-panel.spec.ts:27` gets 0 of 2 panel items.
  Traces in `.workspaces/0022_library_items_dev_still_empty/evidence/replication-plain/`.
- The deployed bundle carries #34's gate: chunk `07xiu8cxvz4yr.js` renders the saver behind `null===B||z!==B||G` and sets `painted` in `requestAnimationFrame(()=>W(B))`.
- Bytes, from the trace of `library-import.spec.ts:30` (library `6d88eb87`): the import PUTs `scene.json` 2241 and `items.json` 2753 at 26.4; the canvas opens at 26.8 and its scene GET ends at 27.16; at 28.93 and 29.16 the saver PUTs `{"elements":[],"appState":{"viewBackgroundColor":"#ffffff","gridSize":20,"zoom":{"value":1},"scrollX":0,"scrollY":0},"files":{}}` (128) and `"libraryItems": []` (112), then PATCHes `itemCount: 0`.
- S3 versions: `6d88eb87` goes 40, 2241/2753, 128/112, the same signature as run 38497207353's `5173dbfe` (2243/2755), `b6d44f15` and `ed67f514` (2242/2754), each then 128/112.
- Order, from the same trace: the package's `en` locale chunk (`1k1sx753idt_k.js`), which the package's `InitializeApp` awaits before it mounts the editor, is only requested at 27.154, after the scene GET, and the next chunk lands at 27.68.
  So the scene is in hand before the editor exists; the swap lands on the new instance before its own `initializeScene` ends with `restore(null)`, and the first report after that is the empty scene the saver writes.

## om-reviewer verification

2026-10-14, on `32bcc97` (app code identical to `b334ae4`, rebased on `bc5ba67`).
The steps cannot pass against dev before the merge, since no branch deploys there; they are proven by `e2e-dev` on the merge commit (Acceptance 2).
What I checked instead, from the artefacts rather than the notes:

- Before the fix, against dev: the 128/112 empty overwrite is in the bucket for `5173dbfe`, `b6d44f15` and `ed67f514` of run 38497207353, read by me in consolidation, and in the om-developer's own run (`6d88eb87`).
- The probe delays one chunk only: both `proxy.log` files list `1k1sx753idt_k.js`, the editor's `en` locale, and nothing else.
- On `develop`'s build, the cold-session diagram probe logs a PUT of `{"elements":[],"appState":{"viewBackgroundColor":"#ffffff","gridSize":20,...}` to `scenes/fce1cbf5...json`, the same writer and signature as on dev; `library-import.spec.ts:30` and `library-panel.spec.ts:27` are red.
- On the fix's build, the same three are green and the cold open logs no PUT at all.
- The probed sources in `evidence/probe/fix/` match `b334ae4` except for 0021's `isInEditor` and `data-editor-region`, so the build that went green is the code under review.
- In the package (0.18.1), the constructor sets `isLoading: true`, `initializeScene` lifts it, and `componentDidUpdate` emits `onChange` whenever loading is over, with no early return. So `whenEditorReady` fires exactly once, at the first report after initialisation, and the swap can no longer land before `restore(null)`.
