import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const inPlace = args.includes("--in-place");
const outputFlag = args.indexOf("--output");
const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : undefined;

if (!inputPath || (outputFlag >= 0 && !outputPath)) {
  throw new Error("Usage: node make-editable.mjs <input.html> [--in-place | --output <output.html>]");
}

const resolvedInput = path.resolve(inputPath);
const resolvedOutput = outputPath
  ? path.resolve(outputPath)
  : inPlace
    ? resolvedInput
    : path.join(path.dirname(resolvedInput), `${path.basename(resolvedInput, path.extname(resolvedInput))}-editable.html`);
let html = fs.readFileSync(resolvedInput, "utf8");
html = html.replace(/<script\b[^>]*\bsrc=["'][^"']*editor-mode\.js[^"']*["'][^>]*>\s*<\/script>\s*/gi, "");
html = html.replace(/<link\b[^>]*\bhref=["'][^"']*editor-mode\.css[^"']*["'][^>]*>\s*/gi, "");

if (!html.includes("data-editor-runtime")) {
  const root = path.resolve(import.meta.dirname, "..");
  const css = fs.readFileSync(path.join(root, "runtime", "editor-mode.css"), "utf8");
  const js = fs.readFileSync(path.join(root, "runtime", "editor-mode.js"), "utf8");
  const style = `\n<style data-editor-runtime>\n${css}\n</style>\n`;
  const script = `\n<script data-editor-runtime>\n${js}\n</script>\n`;
  html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : `${style}${html}`;
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${script}</body>`) : `${html}${script}`;
}

fs.writeFileSync(resolvedOutput, html, "utf8");
process.stdout.write(`${resolvedOutput}\n`);
