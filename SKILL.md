---
name: editable-html
description: Add an in-browser editing mode to an owned HTML page, slide deck, or prototype while preserving its existing design, navigation, and real HTML text. Use when a user wants an HTML artifact to support text editing, image insertion, repositioning, resizing, deletion, and saving as a standalone editable file.
---

# Editable HTML

Make a separate editable copy unless the user explicitly authorizes overwriting the source.

## Workflow

1. Inspect the source HTML before changing it. Preserve its visual CSS, layout, navigation, scripts, and assets.
2. Keep authored text as real HTML. Do not claim that text baked into images, canvas, or video can be edited directly.
3. Run the bundled injector:

   ```sh
   node scripts/make-editable.mjs <input.html> --output <output.html>
   ```

   Use `--in-place` only with explicit authorization.
4. Open the generated file and verify that it loads, retains its original navigation, and exposes the editor toolbar.
5. Report the output path and explain that the first Save action requires the user to choose a file location; a local HTML file cannot silently obtain overwrite permission.

## Editing requirements

The injected editor must remain self-contained in the generated HTML and provide:

- editing for real text and links;
- image insertion by URL or file selection;
- move, corner scale, side resize, and deletion for selected elements;
- Save and Save as;
- serialization that excludes runtime-only `[data-editor-ui]` controls, then rebuilds them when the saved file is reopened.

## Resources

- `scripts/make-editable.mjs`: injects the editor into an HTML file.
- `runtime/editor-mode.css` and `runtime/editor-mode.js`: bundled editor runtime. Keep these files together with the injector when distributing this skill.
