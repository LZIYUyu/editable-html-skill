---
name: editable-html
description: Add a self-contained in-browser editing mode to an owned HTML page, presentation, slide deck, or prototype while preserving its existing design, navigation, scripts, assets, and real HTML text. Use when a user wants an existing HTML artifact to support text and link editing, image insertion, selection of nested visual groups, repositioning, resizing, deletion, and saving as a standalone editable HTML file.
---

# Editable HTML

Preserve the source HTML and create an editable copy beside it unless the user explicitly authorizes overwriting the source.

## Workflow

1. Inspect the source before changing it. Preserve its visual CSS, layout, navigation, scripts, and assets.
2. Keep authored text as real HTML. Do not claim that text embedded in images, canvas, or video can be edited directly.
3. Run the bundled injector:

   ```sh
   node scripts/make-editable.mjs <absolute-input-path> --output <absolute-output-path>
   ```

   Use `--in-place` only when the user explicitly authorizes overwriting the source.
4. Re-run the injector to upgrade an existing editable HTML. It must replace the older inlined runtime and leave exactly one runtime style and one runtime script.
5. Open the output and validate the `浏览` / `编辑` switch, navigation, the main edit interactions, saving, `放映`, and `导出`. Confirm that `Esc` and `Ctrl+Shift+E` restore the toolbar after entering presentation mode. Reopen a saved result and confirm that it is non-empty, remains editable, and creates exactly one runtime toolbar. Confirm that the exported `_演示版.html` contains no editor runtime or editor metadata and still preserves design, navigation, animation, links, inserted images, and manual placement.
6. Report the output path and explain that the first Save action must ask the user to choose the file to overwrite because a standalone local HTML cannot silently obtain write permission.

## Editing requirements

Keep the editor self-contained in the generated HTML and retain all of these capabilities:

- edit real text and partial links, paste web URLs, and insert local images;
- move inline and block elements without discarding their authored transforms;
- corner-scale, side-resize, move with arrow keys, and delete selected elements;
- click text, images, and recognized card-like containers directly;
- show a contextual selection path with at most the generic levels `文字` or `图片`, `行`, and `组`;
- skip missing hierarchy levels, stop at `组`, and never use page content as hierarchy labels;
- let clicks pass through the interior of a container selection so nested text remains selectable;
- show `选择下层` only when independent selectable elements truly overlap;
- avoid parent controls and layer-order controls in the global toolbar, and do not change z-index merely to make an element selectable;
- warn when a moved or scaled element is clipped by an overflow ancestor;
- support Save and Save as with the File System Access API when available;
- provide a visible `浏览` / `编辑` two-state switch;
- provide `放映` to leave editing, hide all editor UI, request fullscreen, briefly show `按 Esc 退出放映`, and restore the toolbar with `Esc`, fullscreen exit, or `Ctrl+Shift+E`;
- provide `导出` to create a separate `_演示版.html` without editor runtime, UI, or editor-only metadata while preserving design and playback behavior;
- exclude all runtime-only `[data-editor-ui]` elements during serialization and rebuild them on reopen;
- fall back to downloading a non-empty `.html` copy when direct file writing is unavailable or fails.

## Saving requirements

- Let Save reuse its current file handle after the first user-authorized selection.
- Make Save as request a new file handle every time.
- Write a `Blob` with `text/html;charset=utf-8`, close the writable stream, and verify that the saved file size matches the Blob before reporting success.
- Do not immediately revoke the Blob URL used by the fallback download.
- Make Export always choose a separate `_演示版.html` target or download that named copy; never overwrite the editable source.

## Resources

- `scripts/make-editable.mjs`: replace any older editor runtime and inline the bundled runtime into an HTML file.
- `runtime/editor-mode.css`: editor toolbar, contextual hierarchy, selection, movement, and resize styling.
- `runtime/editor-mode.js`: editor annotation, interaction, geometry, link, image, selection, serialization, and saving behavior.
