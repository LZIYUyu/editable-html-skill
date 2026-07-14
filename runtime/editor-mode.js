(function () {
  "use strict";

  const TEXT_SELECTOR = "h1,h2,h3,p,span,div,td,th,li,a";
  const URL_RE = /^https?:\/\/[^\s]+$/i;

  const state = {
    editMode: false,
    selected: null,
    fileHandle: null,
    selectionBox: null,
    miniToolbar: null,
    status: null,
    textEditing: false,
    textRange: null
  };

  function init() {
    createToolbar();
    createSelectionBox();
    createMiniToolbar();
    annotateDeck();
    bindSelection();
    bindKeyboard();
    bindDeckGuards();
    setStatus("Preview mode");
  }

  function createToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = "editor-toolbar";
    toolbar.dataset.editorUi = "toolbar";
    toolbar.innerHTML = [
      '<button type="button" data-editor-action="toggle">Edit</button>',
      '<button type="button" data-editor-action="image">Add image</button>',
      '<button type="button" data-editor-action="save">Save</button>',
      '<button type="button" data-editor-action="saveas">Save as</button>',
      '<span class="editor-status" data-editor-ui="status"></span>'
    ].join("");
    document.body.appendChild(toolbar);
    state.status = toolbar.querySelector('[data-editor-ui="status"]');
    toolbar.addEventListener("click", onToolbarClick);
  }

  function createSelectionBox() {
    const box = document.createElement("div");
    box.className = "editor-selection";
    box.dataset.editorUi = "selection";
    box.innerHTML = [
      '<div class="editor-resize editor-resize-nw" data-resize="nw"></div>',
      '<div class="editor-resize editor-resize-ne" data-resize="ne"></div>',
      '<div class="editor-resize editor-resize-sw" data-resize="sw"></div>',
      '<div class="editor-resize editor-resize-se" data-resize="se"></div>',
      '<div class="editor-edge editor-edge-top" data-move-edge></div>',
      '<div class="editor-edge editor-edge-right" data-move-edge></div>',
      '<div class="editor-edge editor-edge-bottom" data-move-edge></div>',
      '<div class="editor-edge editor-edge-left" data-move-edge></div>',
      '<div class="editor-layout-resize editor-layout-resize-n" data-layout-resize="n"></div>',
      '<div class="editor-layout-resize editor-layout-resize-e" data-layout-resize="e"></div>',
      '<div class="editor-layout-resize editor-layout-resize-s" data-layout-resize="s"></div>',
      '<div class="editor-layout-resize editor-layout-resize-w" data-layout-resize="w"></div>'
    ].join("");
    document.body.appendChild(box);
    state.selectionBox = box;
    box.addEventListener("pointerdown", onSelectionPointerDown);
    box.addEventListener("dblclick", (event) => {
      if (!state.selected) return;
      if (state.selected.dataset.editable === "text" || state.selected.dataset.editable === "link") {
        beginTextEdit(state.selected);
        event.preventDefault();
        event.stopPropagation();
      }
    });
  }

  function createMiniToolbar() {
    const bar = document.createElement("div");
    bar.className = "editor-mini-toolbar";
    bar.dataset.editorUi = "mini-toolbar";
    bar.innerHTML = [
      '<button type="button" data-mini-action="link">Add link</button>',
      '<button type="button" data-mini-action="unlink">Remove link</button>',
      '<button type="button" data-mini-action="open">Open link</button>'
    ].join("");
    document.body.appendChild(bar);
    state.miniToolbar = bar;
    bar.addEventListener("pointerdown", (event) => event.preventDefault());
    bar.addEventListener("click", onMiniToolbarClick);
  }

  function annotateDeck() {
    getSlides().forEach((slide, slideIndex) => {
      let textCount = 0;
      slide.querySelectorAll(TEXT_SELECTOR).forEach((el) => {
        if (el.closest("[data-editor-ui]")) return;
        if (el.closest("[data-editable]")) return;
        if (!hasDirectText(el)) return;
        textCount += 1;
        el.dataset.editable = "text";
        el.dataset.editId ||= `slide-${pad(slideIndex + 1)}-text-${pad(textCount)}`;
        if (el.tagName === "A") el.dataset.editable = "link";
      });
      slide.querySelectorAll("img").forEach((img, index) => {
        img.dataset.editable = "image";
        img.dataset.editId ||= `slide-${pad(slideIndex + 1)}-image-${pad(index + 1)}`;
      });
    });
  }

  function hasDirectText(el) {
    return Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  }

  function bindSelection() {
    document.addEventListener("pointerdown", (event) => {
      if (!state.editMode) return;
      if (event.target.closest("[data-editor-ui]")) return;
      if (state.textEditing && state.selected && state.selected.contains(event.target)) return;
      const target = event.target.closest("[data-editable]");
      if (!target) {
        selectElement(null);
        return;
      }
      selectElement(target);
      event.preventDefault();
      event.stopPropagation();
    }, true);

    document.addEventListener("dblclick", (event) => {
      if (!state.editMode) return;
      const target = event.target.closest('[data-editable="text"],[data-editable="link"]');
      if (!target) return;
      beginTextEdit(target);
      event.preventDefault();
      event.stopPropagation();
    }, true);

    document.addEventListener("paste", onPaste, true);
    document.addEventListener("selectionchange", rememberTextRange);
    document.addEventListener("click", (event) => {
      if (!state.editMode || !event.target.closest("a")) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    window.addEventListener("resize", updateSelectionBox);
    window.addEventListener("scroll", updateSelectionBox, true);
  }

  function bindKeyboard() {
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setEditMode(!state.editMode);
        return;
      }
      if (!state.editMode) return;

      if (state.textEditing) {
        event.stopImmediatePropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          endTextEdit();
          updateSelectionBox();
          setStatus("Text editing finished");
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          setLinkOnSelected();
        }
        return;
      }

      const deckNavKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Home", "End"];
      if (deckNavKeys.includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }

      if (!state.selected || state.textEditing) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        const step = event.shiftKey ? 10 : 2;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        moveElementBy(state.selected, dx, dy);
        updateSelectionBox();
      }
    }, true);
  }

  function bindDeckGuards() {
    const viewport = document.getElementById("viewport");
    if (!viewport) return;
    ["pointerdown", "pointerup", "click", "dblclick"].forEach((type) => {
      viewport.addEventListener(type, (event) => {
        if (!state.editMode) return;
        if (event.target.closest("[data-editor-ui]")) return;
        event.stopPropagation();
      }, true);
    });
  }

  function onToolbarClick(event) {
    const action = event.target.dataset.editorAction;
    if (action === "toggle") setEditMode(!state.editMode);
    if (action === "image") addImage();
    if (action === "save") saveHtml();
    if (action === "saveas") saveAsHtml();
  }

  function onMiniToolbarClick(event) {
    const action = event.target.dataset.miniAction;
    if (!action || !state.selected) return;
    if (action === "link") setLinkOnSelected();
    if (action === "unlink") removeLinkFromSelected();
    if (action === "open") openSelectedLink();
  }

  function rememberTextRange() {
    if (!state.textEditing || !state.selected) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!state.selected.contains(range.commonAncestorContainer)) return;
    state.textRange = range.cloneRange();
    updateMiniToolbar();
  }

  function setEditMode(enabled) {
    state.editMode = enabled;
    document.body.classList.toggle("editor-on", enabled);
    const button = document.querySelector('[data-editor-action="toggle"]');
    button.classList.toggle("is-active", enabled);
    button.textContent = enabled ? "Preview" : "Edit";
    if (!enabled) {
      endTextEdit();
      selectElement(null);
    }
    setStatus(enabled ? "Edit mode: click to select, double-click text to edit" : "Preview mode");
  }

  function selectElement(el) {
    if (state.selected !== el) endTextEdit();
    state.selected = el;
    updateSelectionBox();
    updateMiniToolbar();
    if (el) setStatus(`${el.dataset.editId || el.tagName.toLowerCase()} selected`);
  }

  function updateSelectionBox() {
    const box = state.selectionBox;
    const el = state.selected;
    if (!state.editMode || !el || !document.body.contains(el)) {
      box.classList.remove("is-visible");
      updateMiniToolbar();
      return;
    }
    const rect = el.getBoundingClientRect();
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.classList.add("is-visible");
    updateMiniToolbar();
  }

  function updateMiniToolbar() {
    const bar = state.miniToolbar;
    const el = state.selected;
    if (!state.editMode || !state.textEditing || !el || !document.body.contains(el)) {
      bar.classList.remove("is-visible");
      return;
    }
    const textRange = getTextRange(true);
    const hasSelectedText = Boolean(textRange && !textRange.collapsed);
    const activeLink = getLinkAtRange(textRange);
    if (!hasSelectedText && !activeLink) {
      bar.classList.remove("is-visible");
      return;
    }
    const rect = el.getBoundingClientRect();
    bar.style.left = `${Math.max(8, rect.left)}px`;
    bar.style.top = `${Math.max(8, rect.top - 42)}px`;
    bar.classList.add("is-visible");
    const linkButton = bar.querySelector('[data-mini-action="link"]');
    const unlinkButton = bar.querySelector('[data-mini-action="unlink"]');
    const openButton = bar.querySelector('[data-mini-action="open"]');
    linkButton.hidden = !hasSelectedText;
    unlinkButton.hidden = !activeLink;
    openButton.hidden = !activeLink;
  }

  function onSelectionPointerDown(event) {
    if (!state.selected) return;
    const resizeDir = event.target.dataset.resize;
    if (resizeDir) {
      startResize(event, resizeDir);
      return;
    }
    const layoutResizeDir = event.target.dataset.layoutResize;
    if (layoutResizeDir) {
      startLayoutResize(event, layoutResizeDir);
      return;
    }
    if (event.target.dataset.moveEdge !== undefined || event.target === state.selectionBox) {
      startMove(event);
    }
  }

  function startMove(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.setPointerCapture?.(event.pointerId);
    const target = state.selected;
    const scale = getStageScale();
    const stageRect = getEditorStage().getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const pointerOffsetX = (event.clientX - targetRect.left) / scale;
    const pointerOffsetY = (event.clientY - targetRect.top) / scale;
    document.body.classList.add("editor-moving");
    setStatus("Moving: release mouse to place", true);
    function onMove(moveEvent) {
      if (moveEvent.buttons === 0) {
        onUp();
        return;
      }
      const nextStageX = (moveEvent.clientX - stageRect.left) / scale - pointerOffsetX;
      const nextStageY = (moveEvent.clientY - stageRect.top) / scale - pointerOffsetY;
      const baseOrigin = getElementBaseOrigin(target);
      setManualTransform(target, nextStageX - baseOrigin.x, nextStageY - baseOrigin.y, getManualScale(target));
      updateSelectionBox();
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("editor-moving");
      setStatus("Position placed");
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("pointercancel", onUp);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function startResize(event, dir) {
    event.preventDefault();
    event.stopPropagation();
    event.target.setPointerCapture?.(event.pointerId);
    const target = state.selected;
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = target.getBoundingClientRect();
    const scale = getStageScale();
    const startScale = getManualScale(target);
    const startW = Math.max(1, rect.width / scale);
    const startH = Math.max(1, rect.height / scale);
    const startManualX = Number(target.dataset.manualX || 0);
    const startManualY = Number(target.dataset.manualY || 0);
    document.body.classList.add("editor-resizing");
    setStatus("Scaling: release mouse to place", true);
    function onMove(moveEvent) {
      if (moveEvent.buttons === 0) {
        onUp();
        return;
      }
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      const widthDelta = dir.includes("w") ? -dx : dx;
      const heightDelta = dir.includes("n") ? -dy : dy;
      const baseDiagonal = Math.hypot(startW, startH);
      const nextDiagonal = Math.hypot(Math.max(1, startW + widthDelta), Math.max(1, startH + heightDelta));
      const factor = Math.max(0.15, nextDiagonal / baseDiagonal);
      const nextScale = Math.max(0.15, startScale * factor);
      const visualW = startW * factor;
      const visualH = startH * factor;
      let nextX = startManualX;
      let nextY = startManualY;
      if (dir.includes("w")) nextX = startManualX + (startW - visualW);
      if (dir.includes("n")) nextY = startManualY + (startH - visualH);
      setManualTransform(target, nextX, nextY, nextScale);
      updateSelectionBox();
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("editor-resizing");
      setStatus("Scale placed");
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("pointercancel", onUp);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function startLayoutResize(event, dir) {
    event.preventDefault();
    event.stopPropagation();
    event.target.setPointerCapture?.(event.pointerId);
    const target = state.selected;
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = target.getBoundingClientRect();
    const stageScale = getStageScale();
    const manualScale = getManualScale(target);
    const displayScale = stageScale * manualScale;
    const startWidth = Math.max(50, rect.width / displayScale);
    const startHeight = Math.max(28, rect.height / displayScale);
    const startManualX = Number(target.dataset.manualX || 0);
    const startManualY = Number(target.dataset.manualY || 0);
    document.body.classList.add("editor-layout-resizing");
    setStatus("Resizing text box: release mouse to place", true);

    function onMove(moveEvent) {
      if (moveEvent.buttons === 0) {
        onUp();
        return;
      }
      const dx = (moveEvent.clientX - startX) / displayScale;
      const dy = (moveEvent.clientY - startY) / displayScale;
      const nextWidth = Math.max(50, startWidth + (dir === "w" ? -dx : dir === "e" ? dx : 0));
      const nextHeight = Math.max(28, startHeight + (dir === "n" ? -dy : dir === "s" ? dy : 0));
      prepareForLayoutResize(target);
      if (dir === "w" || dir === "e") target.style.width = `${Math.round(nextWidth)}px`;
      if (dir === "n" || dir === "s") target.style.height = `${Math.round(nextHeight)}px`;
      const nextX = dir === "w" ? startManualX + (startWidth - nextWidth) * manualScale : startManualX;
      const nextY = dir === "n" ? startManualY + (startHeight - nextHeight) * manualScale : startManualY;
      setManualTransform(target, nextX, nextY, manualScale);
      updateSelectionBox();
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("editor-layout-resizing");
      setStatus("Text box layout placed");
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function prepareForLayoutResize(el) {
    if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
    el.style.boxSizing = "border-box";
  }

  function beginTextEdit(el) {
    selectElement(el);
    state.textEditing = true;
    el.contentEditable = "true";
    el.spellcheck = false;
    el.focus({ preventScroll: true });
    document.body.classList.add("editor-text-editing");
    rememberTextRange();
    setStatus("Editing text: click outside to finish");
  }

  function endTextEdit() {
    if (!state.textEditing) return;
    document.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
    document.body.classList.remove("editor-text-editing");
    state.textEditing = false;
    state.textRange = null;
  }

  function onPaste(event) {
    if (!state.editMode || !state.selected || !state.textEditing) return;
    const text = event.clipboardData && event.clipboardData.getData("text/plain");
    if (!text || !URL_RE.test(text.trim())) return;
    event.preventDefault();
    const link = document.createElement("a");
    link.href = text.trim();
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = text.trim();
    link.dataset.editable = "link";
    link.dataset.editId = makeId(getCurrentSlide(), "link");
    insertNodeAtSelection(link);
    rememberTextRange();
    updateSelectionBox();
    setStatus("Web link inserted");
  }

  function insertNodeAtSelection(node) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      state.selected.appendChild(node);
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function setLinkOnSelected() {
    const el = state.selected;
    const textRange = getTextRange();
    if (state.textEditing && textRange) {
      const existing = getLinkAtRange(textRange);
      const value = window.prompt("URL", existing ? existing.href : "https://");
      if (!value) return;
      const href = normalizeUrl(value);
      restoreTextRange(textRange);
      if (existing) {
        existing.href = href;
        setStatus("Link updated");
        return;
      }
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener";
      link.dataset.editable = "link";
      link.dataset.editId = makeId(getCurrentSlide(), "link");
      wrapRangeInLink(textRange, link);
      state.textRange = null;
      setStatus("Link added to selected text");
      return;
    }
    if (state.textEditing) {
      setStatus("Select the words to link first");
      return;
    }
    if (el.dataset.editable === "text") {
      setStatus("Double-click, then select the words to link");
      return;
    }
    const current = getLinkElement(el);
    const value = window.prompt("URL", current ? current.href : "https://");
    if (!value) return;
    const href = normalizeUrl(value);
    if (current) {
      current.href = href;
      setStatus("Link updated");
      return;
    }
    if (el.dataset.editable === "image") {
      const wrapper = document.createElement("a");
      wrapper.href = href;
      wrapper.target = "_blank";
      wrapper.rel = "noopener";
      wrapper.dataset.editable = "link";
      wrapper.dataset.editId = makeId(getCurrentSlide(), "link");
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);
      selectElement(wrapper);
      return;
    }
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    link.dataset.editable = "link";
    link.dataset.editId = el.dataset.editId || makeId(getCurrentSlide(), "link");
    link.className = el.className;
    link.style.cssText = el.style.cssText;
    link.innerHTML = el.innerHTML;
    el.replaceWith(link);
    selectElement(link);
    setStatus("Link set");
  }

  function removeLinkFromSelected() {
    if (state.textEditing) {
      const linkAtCaret = getLinkAtRange(getTextRange(true));
      if (!linkAtCaret) {
        setStatus("Place the cursor inside a link first");
        return;
      }
      unwrapLink(linkAtCaret);
      state.textRange = null;
      setStatus("Link removed");
      return;
    }
    const link = getLinkElement(state.selected);
    if (!link) return;
    const replacement = unwrapLink(link);
    selectElement(replacement);
    setStatus("Link removed");
  }

  function getTextRange(allowCollapsed = false) {
    if (!state.textEditing || !state.selected) return null;
    const selection = window.getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : state.textRange;
    if (!range || !state.selected.contains(range.commonAncestorContainer)) return null;
    if (!allowCollapsed && range.collapsed) return null;
    return range.cloneRange();
  }

  function restoreTextRange(range) {
    const selection = window.getSelection();
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function getLinkAtRange(range) {
    if (!range) return null;
    const node = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
    return node && node.closest ? node.closest("a") : null;
  }

  function wrapRangeInLink(range, link) {
    const fragment = range.extractContents();
    link.appendChild(fragment);
    range.insertNode(link);
    const selection = window.getSelection();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(link);
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }

  function unwrapLink(link) {
    const replacement = document.createElement("span");
    replacement.dataset.editable = "text";
    replacement.dataset.editId = link.dataset.editId || makeId(getCurrentSlide(), "text");
    replacement.className = link.className;
    replacement.style.cssText = link.style.cssText;
    while (link.firstChild) replacement.appendChild(link.firstChild);
    link.replaceWith(replacement);
    return replacement;
  }

  function openSelectedLink() {
    const link = state.textEditing ? getLinkAtRange(getTextRange(true)) : getLinkElement(state.selected);
    if (link && link.href) window.open(link.href, "_blank", "noopener");
  }

  function getLinkElement(el) {
    if (!el) return null;
    if (el.tagName === "A") return el;
    return el.closest ? el.closest("a") : null;
  }

  function addImage() {
    if (!state.editMode) setEditMode(true);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const slide = getCurrentSlide();
        const point = getSlidePoint(slide);
        const img = document.createElement("img");
        img.className = "editor-float editor-float-image";
        img.dataset.editable = "image";
        img.dataset.editId = makeId(slide, "image");
        img.src = String(reader.result);
        img.alt = "";
        img.style.width = "460px";
        img.style.height = "300px";
        placeFloat(slide, img, point.x, point.y);
        selectElement(img);
      };
      reader.readAsDataURL(file);
    });
    input.click();
  }

  function placeFloat(slide, el, x, y) {
    slide.appendChild(el);
    el.style.left = `${Math.max(40, x)}px`;
    el.style.top = `${Math.max(40, y)}px`;
  }

  function deleteSelected() {
    if (!state.selected) return;
    const el = state.selected;
    selectElement(null);
    el.remove();
    setStatus("Deleted");
  }

  function saveHtml() {
    const html = serializeHtml();
    if (!("showSaveFilePicker" in window)) {
      saveAsHtml(html);
      return;
    }
    saveWithPicker(html, false);
  }

  function saveAsHtml(html) {
    const output = html || serializeHtml();
    if ("showSaveFilePicker" in window) {
      saveWithPicker(output, true);
    } else {
      downloadHtml(output);
    }
  }

  async function saveWithPicker(html, forceNew) {
    try {
      if (forceNew || !state.fileHandle) {
        setStatus(forceNew ? "Choose a new HTML file" : "First save: choose the HTML file to write", true);
        state.fileHandle = await window.showSaveFilePicker({
          suggestedName: getSuggestedSaveName(),
          types: [{ description: "HTML", accept: { "text/html": [".html"] } }]
        });
      }
      const outputBlob = new Blob([html], { type: "text/html;charset=utf-8" });
      const writable = await state.fileHandle.createWritable();
      await writable.write(outputBlob);
      await writable.close();
      const savedFile = await state.fileHandle.getFile();
      if (savedFile.size !== outputBlob.size) {
        throw new Error("Saved file size did not match the HTML output");
      }
      setStatus(forceNew ? "Saved as new file" : "Saved");
    } catch (error) {
      if (error && error.name === "AbortError") setStatus("Save cancelled");
      else {
        setStatus("Save failed; downloaded a copy");
        downloadHtml(html);
      }
    }
  }

  function downloadHtml(html) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getSuggestedSaveName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    // A local-file browser context can start a download after the click handler
    // returns. Keep this Blob URL alive for the page lifetime to avoid empty files.
    setStatus("Downloaded copy");
  }

  function serializeHtml() {
    const selected = state.selected;
    endTextEdit();
    selectElement(null);
    document.body.classList.remove("editor-on", "editor-moving", "editor-resizing", "editor-layout-resizing");
    // Exclude transient toolbars and handles. They are rebuilt on every page load.
    const uiSlots = Array.from(document.querySelectorAll("[data-editor-ui]")).map((node) => {
      const slot = document.createComment("editor-ui");
      node.replaceWith(slot);
      return { node, slot };
    });
    const html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    uiSlots.forEach(({ node, slot }) => slot.replaceWith(node));
    if (state.editMode && selected && document.body.contains(selected)) {
      document.body.classList.add("editor-on");
      selectElement(selected);
    }
    return html;
  }

  function getCurrentSlide() {
    const slides = getSlides();
    return slides.find((slide) => slide.classList.contains("active")) || slides[0];
  }

  function getSlides() {
    const marked = Array.from(document.querySelectorAll("[data-editor-slide]"));
    if (marked.length) return marked;
    const commonSlides = Array.from(document.querySelectorAll(".slide"));
    if (commonSlides.length) return commonSlides;
    return [getEditorStage()];
  }

  function getEditorStage() {
    return document.querySelector("[data-editor-stage]")
      || document.getElementById("stage")
      || document.querySelector(".deck-stage, .stage")
      || document.body;
  }

  function getSlidePoint(slide) {
    const rect = slide.getBoundingClientRect();
    const scale = getStageScale();
    return {
      x: Math.round((window.innerWidth / 2 - rect.left) / scale - 180),
      y: Math.round((window.innerHeight / 2 - rect.top) / scale - 80)
    };
  }

  function getStageScale() {
    const stage = getEditorStage();
    if (!stage) return 1;
    const rect = stage.getBoundingClientRect();
    return rect.width / (stage.offsetWidth || rect.width || 1) || 1;
  }

  function moveElementBy(el, dx, dy) {
    const baseX = Number(el.dataset.manualX || 0);
    const baseY = Number(el.dataset.manualY || 0);
    setManualTransform(el, baseX + dx, baseY + dy, getManualScale(el));
  }

  function setManualTransform(el, x, y, scale) {
    const nextScale = scale || 1;
    el.dataset.manualX = String(Math.round(x));
    el.dataset.manualY = String(Math.round(y));
    el.dataset.manualScale = String(roundScale(nextScale));
    el.style.setProperty("transform", `translate(${Math.round(x)}px, ${Math.round(y)}px) scale(${roundScale(nextScale)})`, "important");
    el.style.transformOrigin = "0 0";
  }

  function getManualScale(el) {
    const value = Number(el.dataset.manualScale || 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function roundScale(value) {
    return Math.round(value * 1000) / 1000;
  }

  function getElementBaseOrigin(el) {
    const stageRect = getEditorStage().getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const stageScale = getStageScale();
    const manualX = Number(el.dataset.manualX || 0);
    const manualY = Number(el.dataset.manualY || 0);
    return {
      x: (rect.left - stageRect.left) / stageScale - manualX,
      y: (rect.top - stageRect.top) / stageScale - manualY
    };
  }

  function normalizeUrl(value) {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function makeId(slide, type) {
    const slideIndex = getSlides().indexOf(slide);
    const slideNo = Number.isFinite(slideIndex) && slideIndex >= 0 ? slideIndex + 1 : 1;
    const count = slide.querySelectorAll(`[data-editable="${type}"]`).length + 1;
    return `slide-${pad(slideNo)}-${type}-${pad(count)}`;
  }

  function getSuggestedSaveName() {
    const current = decodeURIComponent(location.pathname.split("/").pop() || "editable-deck.html");
    return current.endsWith(".html") ? current : "editable-deck.html";
  }

  function setStatus(text, live) {
    if (!state.status) return;
    state.status.textContent = text;
    state.status.classList.toggle("is-live", Boolean(live));
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
