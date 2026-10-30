/* Site editor: edits content/site.json in the browser, previews live, and publishes to GitHub. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  const DRAFT_KEY = "portfolio-draft";
  const GH_KEY = "portfolio-github";
  const FONTS = ["Inter Tight", "Inter", "Archivo", "Archivo Black", "Space Grotesk", "Manrope", "DM Sans", "Work Sans", "Syne", "Unbounded", "Bricolage Grotesque", "Familjen Grotesk", "Schibsted Grotesk", "Instrument Sans", "Hanken Grotesk", "Plus Jakarta Sans", "Sora", "Outfit", "Poppins", "Montserrat", "Anton", "Bebas Neue", "Oswald", "Instrument Serif", "Playfair Display", "DM Serif Display", "Fraunces", "EB Garamond", "Cormorant Garamond", "Libre Caslon Text", "Space Mono", "IBM Plex Mono", "JetBrains Mono", "Permanent Marker", "Rubik Dirt"];

  /* ---------- Block definitions: what fields each block type has in the editor ---------- */
  const FONT_FIELD = { key: "font", label: "Font (leave empty for default)", type: "font" };
  const ALIGN = { key: "align", label: "Align", type: "select", options: ["left", "center", "right"] };
  const BLOCKS = {
    poster: {
      name: "Homepage poster", summary: (b) => b.title,
      fields: [
        { key: "eyebrow", label: "Top line", type: "text" },
        { key: "subtitle", label: "Second line", type: "text" },
        { key: "title", label: "Big title", type: "text" },
        { key: "font", label: "Big title font (empty = Display font from Settings)", type: "font" },
        { key: "footer", label: "Lines under the title (one per line)", type: "lines" },
        { key: "tabs", label: "Tabs", type: "items", itemName: "Tab", summary: (t) => t.label,
          make: () => ({ label: "New tab", link: "work", x: 20 + Math.round(Math.random() * 60), y: 25 + Math.round(Math.random() * 50) }),
          fields: [
            { key: "label", label: "Label", type: "text" },
            { key: "link", label: "Goes to (page or URL)", type: "link" },
            { row: [
              { key: "x", label: "Left ↔ right (%)", type: "number", min: 0, max: 100 },
              { key: "y", label: "Top ↕ bottom (%)", type: "number", min: 0, max: 100 },
            ] },
          ] },
      ],
    },
    columns: {
      name: "Columns", summary: (b) => (b.columns || []).map((c) => c.sections?.[0]?.heading).filter(Boolean).join(" · "),
      make: () => ({ columns: [{ sections: [{ heading: "Heading", text: "Lorem ipsum dolor sit amet." }] }, { sections: [{ heading: "Heading", list: ["Item one", "Item two"] }] }] }),
      fields: [
        { key: "columns", label: "Columns", type: "items", itemName: "Column", summary: (c) => c.sections?.[0]?.heading,
          make: () => ({ sections: [{ heading: "Heading", text: "Lorem ipsum." }] }),
          fields: [
            { key: "align", label: "Vertical position", type: "select", options: ["top", "center", "end"] },
            { key: "sections", label: "Sections", type: "items", itemName: "Section", summary: (s) => s.heading,
              make: () => ({ heading: "Heading", text: "" }),
              fields: [
                { key: "heading", label: "Heading", type: "text" },
                { key: "size", label: "Heading size", type: "select", options: ["m", "l"], labels: ["Normal", "Large"] },
                { key: "text", label: "Paragraph", type: "textarea" },
                { key: "textSize", label: "Paragraph size", type: "select", options: ["m", "l"], labels: ["Normal", "Large"] },
                { key: "list", label: "List (one item per line)", type: "lines" },
                { key: "muted", label: "Grey text for the list", type: "check" },
                { key: "image", label: "Image (optional)", type: "image" },
              ] },
          ] },
      ],
    },
    topbar: {
      name: "Top line", summary: (b) => b.left, make: () => ({ left: "Left text", right: "Right text" }),
      fields: [{ key: "left", label: "Left", type: "text" }, { key: "right", label: "Right", type: "text" }],
    },
    display: {
      name: "Big heading", summary: (b) => b.text, make: () => ({ text: "Big heading", italic: false, weight: 300 }),
      fields: [
        { key: "text", label: "Text (Enter = new line)", type: "textarea" },
        { row: [
          { key: "weight", label: "Weight", type: "select", options: ["300", "400", "500", "600", "700", "800", "900"], number: true },
          { key: "italic", label: "Italic", type: "check" },
        ] },
        FONT_FIELD,
      ],
    },
    linklist: {
      name: "Underlined links", summary: (b) => (b.items || []).map((i) => i.label).join(", "),
      make: () => ({ items: [{ label: "Link", link: "home" }] }),
      fields: [
        { key: "items", label: "Links", type: "items", itemName: "Link", summary: (i) => i.label, make: () => ({ label: "New link", link: "home" }),
          fields: [{ key: "label", label: "Label", type: "text" }, { key: "link", label: "Goes to (page or URL)", type: "link" }] },
        FONT_FIELD,
      ],
    },
    project: {
      name: "Project intro", summary: (b) => b.title,
      make: () => ({ title: ".project name", label: "[ project 2026 ]", tags: ["branding.", "photography."], description: "Lorem ipsum dolor sit amet.", note: "" }),
      fields: [
        { key: "title", label: "Title", type: "text" },
        { key: "label", label: "Small label next to title", type: "text" },
        { key: "tags", label: "Tags (one per line, shown in two columns)", type: "lines" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "note", label: "Italic note", type: "text" },
        FONT_FIELD,
      ],
    },
    text: {
      name: "Text", summary: (b) => b.text, make: () => ({ text: "Lorem ipsum dolor sit amet.", size: "m", align: "left" }),
      fields: [
        { key: "text", label: "Text", type: "textarea" },
        { row: [
          { key: "size", label: "Size", type: "select", options: ["s", "m", "l", "xl"], labels: ["Small", "Normal", "Large", "Huge"] },
          ALIGN,
        ] },
        { key: "italic", label: "Italic", type: "check" },
        FONT_FIELD,
      ],
    },
    image: {
      name: "Image", summary: (b) => b.src || "(empty holder)", make: () => ({ src: "", alt: "Mockup", width: "full" }),
      fields: [
        { key: "src", label: "Image", type: "image" },
        { key: "alt", label: "Description (for screen readers; shown on empty holders)", type: "text" },
        { key: "caption", label: "Caption (optional)", type: "text" },
        { row: [
          { key: "width", label: "Width", type: "select", options: ["full", "wide", "half"], labels: ["Edge to edge", "Wide", "Half"] },
          { key: "ratio", label: "Empty holder shape", type: "select", options: ["16 / 9", "4 / 3", "1 / 1", "4 / 5", "3 / 2", "21 / 9"] },
        ] },
      ],
    },
    gallery: {
      name: "Image grid", summary: (b) => `${(b.images || []).length} images, ${b.columns || 2} across`,
      make: () => ({ columns: 2, images: [{ src: "", alt: "Mockup" }, { src: "", alt: "Mockup" }] }),
      fields: [
        { row: [
          { key: "columns", label: "Images across", type: "select", options: ["1", "2", "3", "4"], number: true },
          { key: "ratio", label: "Empty holder shape", type: "select", options: ["4 / 5", "1 / 1", "4 / 3", "16 / 9", "3 / 4"] },
        ] },
        { key: "fullBleed", label: "Edge to edge", type: "check", default: true },
        { key: "images", label: "Images", type: "items", itemName: "Image", summary: (i) => i.src || "(empty holder)", make: () => ({ src: "", alt: "Mockup" }),
          fields: [{ key: "src", label: "Image", type: "image" }, { key: "alt", label: "Description", type: "text" }, { key: "caption", label: "Caption", type: "text" }] },
      ],
    },
    button: {
      name: "Button", summary: (b) => b.label, make: () => ({ label: "Button", link: "home", style: "outline", align: "left" }),
      fields: [
        { key: "label", label: "Label", type: "text" },
        { key: "link", label: "Goes to (page or URL)", type: "link" },
        { row: [{ key: "style", label: "Style", type: "select", options: ["outline", "solid"] }, ALIGN] },
      ],
    },
    spacer: {
      name: "Space", summary: (b) => ({ s: "Small", m: "Medium", l: "Large" }[b.size || "m"]), make: () => ({ size: "m" }),
      fields: [{ key: "size", label: "Size", type: "select", options: ["s", "m", "l"], labels: ["Small", "Medium", "Large"] }],
    },
  };
  const ADDABLE = ["text", "image", "gallery", "button", "display", "linklist", "project", "columns", "topbar", "spacer", "poster"];

  /* ---------- State ---------- */
  let content = null;      // working copy of site.json
  let published = "";      // JSON string of what is live, to know if there are changes
  let pageSlug = "home";
  let uploads = {};        // "images/x.jpg" -> { dataUrl, base64 } waiting to be published
  const recent = {};       // images published this session, shown from memory until the live site rebuilds
  const open = new WeakSet();
  const undoStack = [];
  let gh = Object.assign({}, window.ADMIN_DEFAULTS || {}, JSON.parse(store.get(GH_KEY) || "{}"));

  const page = () => content.pages.find((p) => p.slug === pageSlug) || content.pages[0];

  /* ---------- Status / saving ---------- */
  function setStatus(msg, kind = "") { const s = $("#status"); s.textContent = msg; s.className = "status " + kind; }
  function isDirty() { return JSON.stringify(content) !== published || Object.keys(uploads).length > 0; }
  function refreshStatus() { if (isDirty()) setStatus("Unpublished changes", "dirty"); else setStatus("Everything is published", "ok"); }

  let snapTimer = null;
  function snapshot() {
    // Group rapid typing into one undo step.
    if (snapTimer) return;
    undoStack.push(JSON.stringify(content));
    if (undoStack.length > 100) undoStack.shift();
    snapTimer = setTimeout(() => (snapTimer = null), 800);
  }
  function changed({ rerender = false } = {}) {
    store.set(DRAFT_KEY, JSON.stringify({ content, uploads }));
    if (rerender) renderPanel();
    updateLinksList();
    refreshStatus();
    sendPreview();
  }
  function undo() {
    const prev = undoStack.pop();
    if (!prev) return;
    content = JSON.parse(prev);
    if (!content.pages.some((p) => p.slug === pageSlug)) pageSlug = content.pages[0].slug;
    renderPageSelect();
    changed({ rerender: true });
  }

  /* ---------- Preview ---------- */
  const iframe = $("#preview");
  let previewReady = false, previewTimer = null;
  function sendPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      if (!previewReady) return;
      const images = { ...recent };
      for (const [p, u] of Object.entries(uploads)) images[p] = u.dataUrl;
      iframe.contentWindow.postMessage({ type: "preview", content, slug: pageSlug, images }, location.origin);
    }, 120);
  }
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.data?.type !== "preview-ready") return;
    previewReady = true;
    sendPreview();
    // Follow clicks inside the preview so the editor shows the page being looked at.
    iframe.contentWindow.addEventListener("hashchange", () => {
      const slug = decodeURIComponent(iframe.contentWindow.location.hash.replace(/^#\/?/, "")) || "home";
      if (slug !== pageSlug && content.pages.some((p) => p.slug === slug)) { pageSlug = slug; renderPageSelect(); renderPanel(); }
    });
  });

  /* ---------- Form building ---------- */
  function get(obj, f) { return obj[f.key] ?? (f.default !== undefined ? f.default : ""); }

  function fieldEl(obj, f) {
    if (f.row) {
      const row = document.createElement("div");
      row.className = "row";
      f.row.forEach((sub) => row.appendChild(fieldEl(obj, sub)));
      return row;
    }
    const wrap = document.createElement("label");
    wrap.className = "field";
    const onInput = (v) => { snapshot(); if (v === "" || v === undefined) delete obj[f.key]; else obj[f.key] = v; changed(); };

    if (f.type === "check") {
      wrap.className = "field check";
      wrap.innerHTML = `<input type="checkbox"> ${esc(f.label)}`;
      const inp = wrap.querySelector("input");
      inp.checked = !!get(obj, f);
      inp.onchange = () => { snapshot(); obj[f.key] = inp.checked; changed(); };
      return wrap;
    }
    wrap.innerHTML = `<span>${esc(f.label)}</span>`;

    if (f.type === "items") return itemsEl(obj, f, wrap);
    if (f.type === "image") { wrap.appendChild(imageEl(obj, f)); return wrap; }

    let inp;
    if (f.type === "textarea" || f.type === "lines") {
      inp = document.createElement("textarea");
      inp.rows = f.type === "lines" ? Math.min(12, Math.max(3, (obj[f.key] || []).length + 1)) : 4;
      inp.value = f.type === "lines" ? (obj[f.key] || []).join("\n") : get(obj, f);
      inp.oninput = () => {
        if (f.type === "lines") { snapshot(); obj[f.key] = inp.value.split("\n"); changed(); }
        else onInput(inp.value);
      };
      if (f.type === "lines") inp.onblur = () => { obj[f.key] = (obj[f.key] || []).filter((l, i, a) => l.trim() !== "" || (i > 0 && i < a.length - 1)); };
    } else if (f.type === "select") {
      inp = document.createElement("select");
      const cur = String(get(obj, f) || f.options[0]);
      inp.innerHTML = f.options.map((o, i) => `<option value="${esc(o)}" ${o === cur ? "selected" : ""}>${esc(f.labels?.[i] || o)}</option>`).join("");
      inp.onchange = () => onInput(f.number ? +inp.value : inp.value);
    } else {
      inp = document.createElement("input");
      inp.type = f.type === "number" ? "number" : "text";
      if (f.min !== undefined) inp.min = f.min;
      if (f.max !== undefined) inp.max = f.max;
      if (f.type === "font") { inp.setAttribute("list", "fonts-list"); inp.placeholder = "Any Google Font name"; }
      if (f.type === "link") { inp.setAttribute("list", "links-list"); inp.placeholder = "page name or https://…"; }
      inp.value = get(obj, f);
      inp.oninput = () => onInput(f.type === "number" ? (inp.value === "" ? "" : +inp.value) : inp.value);
    }
    wrap.appendChild(inp);
    if (f.type === "font") wrap.insertAdjacentHTML("beforeend", `<div class="hint">Browse names at <a href="https://fonts.google.com" target="_blank" rel="noopener">fonts.google.com</a>.</div>`);
    return wrap;
  }

  function itemsEl(obj, f, wrap) {
    if (!Array.isArray(obj[f.key])) obj[f.key] = [];
    const list = obj[f.key];
    const box = document.createElement("div");
    box.className = "items";
    list.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `<div class="item-head"><span>${esc(f.itemName)} ${i + 1}${f.summary && f.summary(item) ? " · " + esc(f.summary(item)) : ""}</span>
        <span class="tools">
          <button type="button" title="Move up" data-a="up">↑</button><button type="button" title="Move down" data-a="down">↓</button>
          <button type="button" title="Duplicate" data-a="dup">⧉</button><button type="button" title="Remove" data-a="del">✕</button>
        </span></div>`;
      el.querySelector(".tools").onclick = (e) => {
        const a = e.target.dataset.a;
        if (!a) return;
        snapshot();
        if (a === "up" && i > 0) list.splice(i - 1, 0, list.splice(i, 1)[0]);
        if (a === "down" && i < list.length - 1) list.splice(i + 1, 0, list.splice(i, 1)[0]);
        if (a === "dup") list.splice(i + 1, 0, clone(item));
        if (a === "del") list.splice(i, 1);
        changed({ rerender: true });
      };
      f.fields.forEach((sub) => el.appendChild(fieldEl(item, sub)));
      box.appendChild(el);
    });
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-item";
    add.textContent = `+ Add ${f.itemName.toLowerCase()}`;
    add.onclick = () => { snapshot(); list.push(f.make()); changed({ rerender: true }); };
    box.appendChild(add);
    wrap.appendChild(box);
    return wrap;
  }

  function imageEl(obj, f) {
    const el = document.createElement("div");
    el.className = "img-field";
    const thumb = document.createElement("div");
    thumb.className = "img-thumb";
    const ctr = document.createElement("div");
    ctr.className = "img-controls";
    const path = document.createElement("input");
    path.type = "text";
    path.placeholder = "Empty = grey image holder";
    const btns = document.createElement("div");
    btns.className = "img-btns";
    const up = document.createElement("button");
    up.type = "button"; up.className = "small"; up.textContent = "Upload…";
    const clr = document.createElement("button");
    clr.type = "button"; clr.className = "small"; clr.textContent = "Clear";
    const file = document.createElement("input");
    file.type = "file"; file.accept = "image/*"; file.hidden = true;
    btns.append(up, clr, file);
    ctr.append(path, btns);
    el.append(thumb, ctr);

    const show = () => {
      const v = obj[f.key] || "";
      path.value = v;
      const url = uploads[v]?.dataUrl || recent[v] || (v ? (/^(https?:|data:)/.test(v) ? v : "../" + v) : "");
      thumb.style.backgroundImage = url ? `url("${url}")` : "";
      thumb.textContent = url ? "" : "empty";
    };
    show();
    path.oninput = () => { snapshot(); obj[f.key] = path.value.trim(); changed(); show(); };
    clr.onclick = () => { snapshot(); obj[f.key] = ""; changed(); show(); };
    up.onclick = () => file.click();
    file.onchange = async () => {
      const fl = file.files[0];
      if (!fl) return;
      up.disabled = true; up.textContent = "Adding…";
      try {
        const { dataUrl, ext } = await prepareImage(fl);
        const base = fl.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "image";
        const p = `images/${base}-${Date.now().toString(36)}.${ext}`;
        uploads[p] = { dataUrl, base64: dataUrl.split(",")[1] };
        snapshot(); obj[f.key] = p; changed(); show();
      } catch (err) {
        alert("Could not read that image: " + err.message);
      }
      up.disabled = false; up.textContent = "Upload…"; file.value = "";
    };
    return el;
  }

  // Large photos are scaled down to 2400px wide so the site stays fast. GIFs and SVGs are kept as they are.
  function prepareImage(fl) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => {
        const dataUrl = reader.result;
        const type = fl.type;
        const keepExt = { "image/gif": "gif", "image/svg+xml": "svg", "image/webp": "webp" }[type];
        if (keepExt) return resolve({ dataUrl, ext: keepExt });
        const im = new Image();
        im.onerror = () => reject(new Error("not an image"));
        im.onload = () => {
          const max = 2400;
          const png = type === "image/png";
          if (im.naturalWidth <= max && fl.size < 1.5e6) return resolve({ dataUrl, ext: png ? "png" : "jpg" });
          const scale = Math.min(1, max / im.naturalWidth);
          const c = document.createElement("canvas");
          c.width = Math.round(im.naturalWidth * scale);
          c.height = Math.round(im.naturalHeight * scale);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          resolve(png ? { dataUrl: c.toDataURL("image/png"), ext: "png" } : { dataUrl: c.toDataURL("image/jpeg", 0.88), ext: "jpg" });
        };
        im.src = dataUrl;
      };
      reader.readAsDataURL(fl);
    });
  }

  /* ---------- Panel ---------- */
  function renderPanel() {
    const panel = $("#panel");
    const p = page();
    panel.innerHTML = "";

    if (!gh.token) {
      panel.insertAdjacentHTML("beforeend", `<div class="callout">To publish, connect GitHub once in <a href="#" id="go-settings">Settings</a>. You can edit and preview without it; changes are kept in this browser until you publish.</div>`);
      $("#go-settings").onclick = (e) => { e.preventDefault(); openSettings(); };
    }

    // Page settings card
    const pc = document.createElement("div");
    pc.className = "card" + (open.has(p) ? " open" : "");
    pc.innerHTML = `<div class="card-head"><span class="chev">▸</span><span class="kind">Page settings</span><span class="sum">${esc(p.title)} · /${esc(p.slug === "home" ? "" : p.slug)}</span></div><div class="card-body"></div>`;
    pc.querySelector(".card-head").onclick = () => toggle(p, pc);
    const pb = pc.querySelector(".card-body");
    const titleF = fieldEl(p, { key: "title", label: "Page name", type: "text" });
    titleF.querySelector("input").addEventListener("change", renderPageSelect);
    pb.appendChild(titleF);
    if (p.slug !== "home") {
      const slugWrap = document.createElement("label");
      slugWrap.className = "field";
      slugWrap.innerHTML = `<span>Web address</span><input type="text" value="${esc(p.slug)}"><div class="hint">Links on other pages update automatically.</div>`;
      slugWrap.querySelector("input").onchange = (e) => renameSlug(p, e.target.value);
      pb.appendChild(slugWrap);
    }
    pb.appendChild(fieldEl(p, { key: "theme", label: "Background", type: "select", options: ["dark", "light", "white", "paper"], labels: ["Black", "Off-white", "White", "Paper texture"] }));
    if (p.slug !== "home") {
      const tools = document.createElement("div");
      tools.style.cssText = "display:flex;gap:6px;margin-top:12px";
      tools.innerHTML = `<button type="button" class="small" data-a="dup">Duplicate page</button><button type="button" class="small danger" data-a="del">Delete page</button>`;
      tools.onclick = (e) => {
        if (e.target.dataset.a === "del" && confirm(`Delete the page "${p.title}"? Tabs and links to it will stay until you remove them.`)) {
          snapshot();
          content.pages = content.pages.filter((x) => x !== p);
          pageSlug = "home";
          renderPageSelect();
          changed({ rerender: true });
        }
        if (e.target.dataset.a === "dup") {
          snapshot();
          const copy = clone(p);
          copy.title += " copy";
          copy.slug = uniqueSlug(slugify(copy.title));
          content.pages.splice(content.pages.indexOf(p) + 1, 0, copy);
          pageSlug = copy.slug;
          renderPageSelect();
          changed({ rerender: true });
        }
      };
      pb.appendChild(tools);
    }
    panel.appendChild(pc);

    panel.insertAdjacentHTML("beforeend", `<div class="section-title"><span>Blocks on this page</span></div>`);
    (p.blocks || (p.blocks = [])).forEach((b, i) => panel.appendChild(blockCard(p, b, i)));
    if (!p.blocks.length) panel.insertAdjacentHTML("beforeend", `<p style="color:var(--muted);margin:4px">This page is empty. Add a block below.</p>`);

    panel.insertAdjacentHTML("beforeend", `<div class="section-title"><span>Add a block</span></div>`);
    const add = document.createElement("div");
    add.className = "add-block";
    add.innerHTML = ADDABLE.map((t) => `<button type="button" data-t="${t}">${esc(BLOCKS[t].name)}</button>`).join("");
    add.onclick = (e) => {
      const t = e.target.dataset.t;
      if (!t) return;
      snapshot();
      const def = BLOCKS[t];
      const b = Object.assign({ type: t }, def.make ? def.make() : clone(content.pages[0].blocks.find((x) => x.type === t) || {}));
      b.type = t;
      p.blocks.push(b);
      open.add(b);
      changed({ rerender: true });
      setTimeout(() => $("#panel").lastElementChild.previousElementSibling.previousElementSibling.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
    };
    panel.appendChild(add);
  }

  function toggle(obj, el) { if (open.has(obj)) open.delete(obj); else open.add(obj); el.classList.toggle("open"); }

  function blockCard(p, b, i) {
    const def = BLOCKS[b.type] || { name: b.type, fields: [], summary: () => "" };
    const card = document.createElement("div");
    card.className = "card" + (open.has(b) ? " open" : "");
    card.innerHTML = `<div class="card-head"><span class="chev">▸</span><span class="kind">${esc(def.name)}</span><span class="sum">${esc(def.summary(b) || "")}</span>
      <span class="tools"><button type="button" title="Move up" data-a="up">↑</button><button type="button" title="Move down" data-a="down">↓</button>
      <button type="button" title="Duplicate" data-a="dup">⧉</button><button type="button" title="Delete" data-a="del">✕</button></span></div><div class="card-body"></div>`;
    card.querySelector(".card-head").onclick = (e) => {
      const a = e.target.dataset.a;
      if (!a) return toggle(b, card);
      const list = p.blocks;
      if (a === "del" && !confirm(`Delete this ${def.name.toLowerCase()} block?`)) return;
      snapshot();
      if (a === "up" && i > 0) list.splice(i - 1, 0, list.splice(i, 1)[0]);
      if (a === "down" && i < list.length - 1) list.splice(i + 1, 0, list.splice(i, 1)[0]);
      if (a === "dup") { const c = clone(b); list.splice(i + 1, 0, c); open.add(c); }
      if (a === "del") list.splice(i, 1);
      changed({ rerender: true });
    };
    const body = card.querySelector(".card-body");
    def.fields.forEach((f) => body.appendChild(fieldEl(b, f)));
    // Keep the card's one-line summary current while typing.
    body.addEventListener("input", () => { card.querySelector(".sum").textContent = def.summary(b) || ""; });
    return card;
  }

  /* ---------- Pages ---------- */
  const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
  function uniqueSlug(base) {
    let s = base, n = 2;
    while (content.pages.some((p) => p.slug === s)) s = `${base}-${n++}`;
    return s;
  }
  function renameSlug(p, value) {
    const next = uniqueSlug(slugify(value));
    if (next === p.slug) return;
    snapshot();
    const old = p.slug;
    p.slug = next;
    // Point every link that used the old address at the new one.
    (function walk(o) {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") for (const k in o) { if (k === "link" && o[k] === old) o[k] = next; else walk(o[k]); }
    })(content);
    pageSlug = next;
    renderPageSelect();
    changed({ rerender: true });
  }

  function renderPageSelect() {
    $("#page-select").innerHTML = content.pages.map((p) => `<option value="${esc(p.slug)}" ${p.slug === pageSlug ? "selected" : ""}>${esc(p.title)}${p.slug === "home" ? " (homepage)" : ""}</option>`).join("");
  }
  function updateLinksList() {
    $("#links-list").innerHTML = content.pages.map((p) => `<option value="${esc(p.slug)}">${esc(p.title)}</option>`).join("");
  }

  function newPage(form) {
    const title = form.title.value.trim();
    if (!title) return;
    snapshot();
    const slug = uniqueSlug(slugify(title));
    const tpl = form.template.value;
    let blocks = [];
    if (tpl === "project") {
      blocks = [
        Object.assign({ type: "project" }, BLOCKS.project.make(), { title: "." + title.toLowerCase() }),
        { type: "image", src: "", alt: "Hero mockup", width: "full" },
        { type: "gallery", columns: 2, images: [{ src: "", alt: "Mockup" }, { src: "", alt: "Mockup" }] },
        { type: "image", src: "", alt: "Wide mockup", width: "full" },
        { type: "gallery", columns: 3, images: [{ src: "", alt: "Detail" }, { src: "", alt: "Detail" }, { src: "", alt: "Detail" }] },
        { type: "button", label: "← Back to all work", link: "work", align: "center" },
      ];
    } else if (tpl === "text") {
      blocks = [{ type: "display", text: title, weight: 300, italic: false }, { type: "spacer", size: "m" }, { type: "text", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.", size: "l" }];
    }
    content.pages.push({ slug, title, theme: form.theme.value, blocks });
    if (form.tab.checked) {
      const poster = content.pages.find((p) => p.slug === "home")?.blocks.find((b) => b.type === "poster");
      if (poster) (poster.tabs ||= []).push({ label: title, link: slug, x: 15 + Math.round(Math.random() * 70), y: 22 + Math.round(Math.random() * 60) });
    }
    if (form.list.checked) {
      const ll = content.pages.find((p) => p.slug === "work")?.blocks.find((b) => b.type === "linklist");
      if (ll) ll.items.push({ label: title, link: slug });
    }
    pageSlug = slug;
    renderPageSelect();
    changed({ rerender: true });
    form.reset();
  }

  /* ---------- Settings ---------- */
  function openSettings() {
    const body = $("#settings-body");
    body.innerHTML = "";
    const s = content.site;
    s.fonts ||= {};
    s.nav ||= { show: true, items: [] };
    body.insertAdjacentHTML("beforeend", `<h3>Site</h3>`);
    body.appendChild(fieldEl(s, { key: "title", label: "Site name (browser tab)", type: "text" }));
    body.insertAdjacentHTML("beforeend", `<h3>Fonts</h3><p>Type any font name from <a href="https://fonts.google.com" target="_blank" rel="noopener">Google Fonts</a>. Each block can also pick its own font.</p>`);
    body.appendChild(fieldEl(s.fonts, { key: "body", label: "Body text", type: "font" }));
    body.appendChild(fieldEl(s.fonts, { key: "heading", label: "Headings", type: "font" }));
    body.appendChild(fieldEl(s.fonts, { key: "display", label: "Display (the big PORTFOLIO title)", type: "font" }));
    body.insertAdjacentHTML("beforeend", `<h3>Menu</h3><p>The small floating menu at the bottom of every page except the homepage.</p>`);
    body.appendChild(fieldEl(s.nav, { key: "show", label: "Show menu", type: "check" }));
    const navWrap = fieldEl(s.nav, { key: "items", label: "Menu links", type: "items", itemName: "Link", summary: (i) => i.label, make: () => ({ label: "Link", link: "home" }),
      fields: [{ key: "label", label: "Label", type: "text" }, { key: "link", label: "Goes to", type: "link" }] });
    body.appendChild(navWrap);
    // Items fields re-render the side panel, not this dialog, so redraw the dialog after structural edits.
    navWrap.addEventListener("click", (e) => { if (e.target.closest(".tools button, .add-item")) setTimeout(openSettings, 0); });

    body.insertAdjacentHTML("beforeend", `<h3>GitHub (for publishing)</h3>
      <p>Publishing saves your changes straight to the GitHub repo, and the live site updates about a minute later.
      You need a token once per browser: on GitHub go to <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Settings → Developer settings → Fine-grained tokens → Generate new token</a>,
      pick <b>Only select repositories</b> → <b>${esc(gh.repo || "your repo")}</b>, and under <b>Repository permissions</b> set <b>Contents</b> to <b>Read and write</b>. Paste the token below. It is only stored in this browser.</p>`);
    const ghFields = [
      { key: "owner", label: "GitHub user", type: "text" },
      { key: "repo", label: "Repository", type: "text" },
      { key: "branch", label: "Branch", type: "text" },
    ];
    const ghBox = document.createElement("div");
    ghBox.className = "row";
    ghFields.forEach((f) => {
      const l = document.createElement("label");
      l.className = "field";
      l.innerHTML = `<span>${f.label}</span><input type="text" value="${esc(gh[f.key] || "")}">`;
      l.querySelector("input").oninput = (e) => { gh[f.key] = e.target.value.trim(); saveGh(); };
      ghBox.appendChild(l);
    });
    body.appendChild(ghBox);
    const tok = document.createElement("label");
    tok.className = "field";
    tok.innerHTML = `<span>Token</span><input type="password" placeholder="github_pat_…" value="${esc(gh.token || "")}" autocomplete="off">`;
    tok.querySelector("input").oninput = (e) => { gh.token = e.target.value.trim(); saveGh(); };
    body.appendChild(tok);
    const test = document.createElement("div");
    test.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:10px";
    test.innerHTML = `<button type="button" class="small">Test connection</button><span class="status"></span>`;
    test.querySelector("button").onclick = async () => {
      const out = test.querySelector(".status");
      out.textContent = "Checking…"; out.className = "status";
      try {
        const r = await api(`/repos/${gh.owner}/${gh.repo}`);
        out.textContent = r.permissions?.push === false ? "Connected, but this token can't write." : "Connected ✓";
        out.className = "status " + (r.permissions?.push === false ? "err" : "ok");
      } catch (err) { out.textContent = err.message; out.className = "status err"; }
    };
    body.appendChild(test);

    body.insertAdjacentHTML("beforeend", `<h3>Backup</h3>`);
    const bk = document.createElement("div");
    bk.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    bk.innerHTML = `<button type="button" class="small" data-a="dl">Download content file</button><button type="button" class="small" data-a="ul">Load content file…</button><button type="button" class="small danger" data-a="reset">Discard unpublished changes</button><input type="file" accept=".json,application/json" hidden>`;
    bk.onclick = async (e) => {
      const a = e.target.dataset.a;
      if (a === "dl") {
        const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
        const u = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), { href: u, download: "site.json" }).click();
        setTimeout(() => URL.revokeObjectURL(u), 1000);
      }
      if (a === "ul") bk.querySelector("input").click();
      if (a === "reset" && confirm("Throw away everything you haven't published?")) {
        store.del(DRAFT_KEY); uploads = {};
        content = JSON.parse(published);
        pageSlug = "home"; renderPageSelect(); changed({ rerender: true });
        $("#dlg-settings").close();
      }
    };
    bk.querySelector("input").onchange = async (e) => {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!Array.isArray(data.pages)) throw new Error("missing pages");
        snapshot(); content = data; pageSlug = "home"; renderPageSelect(); changed({ rerender: true });
      } catch (err) { alert("That file isn't a valid content file (" + err.message + ")."); }
    };
    body.appendChild(bk);
    const dlg = $("#dlg-settings");
    if (!dlg.open) dlg.showModal();
  }
  function saveGh() { store.set(GH_KEY, JSON.stringify(gh)); }

  /* ---------- GitHub ---------- */
  async function api(path, opts = {}) {
    if (!gh.token) throw new Error("Add a GitHub token in Settings first.");
    const r = await fetch("https://api.github.com" + path, {
      ...opts,
      headers: { Authorization: "Bearer " + gh.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (!r.ok) {
      let msg = `GitHub said ${r.status}`;
      try { msg += ": " + (await r.json()).message; } catch {}
      if (r.status === 401) msg = "The token isn't valid any more. Make a new one in Settings.";
      if (r.status === 404) msg = "Couldn't find that repo/branch, or the token can't see it. Check Settings.";
      if (r.status === 403) msg = "The token doesn't have permission. It needs Contents: Read and write.";
      throw new Error(msg);
    }
    return r.status === 204 ? null : r.json();
  }
  const b64 = (str) => { const bytes = new TextEncoder().encode(str); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)));

  async function publish() {
    if (!gh.token) return openSettings();
    if (!isDirty()) return setStatus("Nothing new to publish", "ok");
    const btn = $("#btn-publish");
    btn.disabled = true;
    try {
      const { owner, repo, branch } = gh;
      const base = `/repos/${owner}/${repo}`;
      setStatus("Publishing…");
      const ref = await api(`${base}/git/ref/heads/${encodeURIComponent(branch)}`);
      const head = await api(`${base}/git/commits/${ref.object.sha}`);
      const tree = [];
      const files = Object.entries(uploads);
      for (let i = 0; i < files.length; i++) {
        setStatus(`Uploading image ${i + 1} of ${files.length}…`);
        const blob = await api(`${base}/git/blobs`, { method: "POST", body: JSON.stringify({ content: files[i][1].base64, encoding: "base64" }) });
        tree.push({ path: files[i][0], mode: "100644", type: "blob", sha: blob.sha });
      }
      setStatus("Saving content…");
      const json = JSON.stringify(content, null, 2) + "\n";
      const blob = await api(`${base}/git/blobs`, { method: "POST", body: JSON.stringify({ content: b64(json), encoding: "base64" }) });
      tree.push({ path: "content/site.json", mode: "100644", type: "blob", sha: blob.sha });
      const newTree = await api(`${base}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const msg = `Update site content${files.length ? ` and ${files.length} image${files.length > 1 ? "s" : ""}` : ""}`;
      const commit = await api(`${base}/git/commits`, { method: "POST", body: JSON.stringify({ message: msg, tree: newTree.sha, parents: [ref.object.sha] }) });
      await api(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
      published = JSON.stringify(content);
      for (const [p, u] of Object.entries(uploads)) recent[p] = u.dataUrl;
      uploads = {};
      store.del(DRAFT_KEY);
      setStatus("Published ✓ Live in about a minute", "ok");
    } catch (err) {
      setStatus(err.message, "err");
    }
    btn.disabled = false;
  }

  async function loadPublished() {
    // With a token, read straight from GitHub so a just-published change shows even before the site rebuilds.
    if (gh.token && gh.owner && gh.repo) {
      try {
        const f = await api(`/repos/${gh.owner}/${gh.repo}/contents/content/site.json?ref=${encodeURIComponent(gh.branch || "main")}`);
        return JSON.parse(unb64(f.content));
      } catch (err) { console.warn("Falling back to the live file:", err); }
    }
    const r = await fetch("../content/site.json", { cache: "no-cache" });
    return r.json();
  }

  /* ---------- Start ---------- */
  async function init() {
    $("#fonts-list").innerHTML = FONTS.map((f) => `<option value="${f}">`).join("");
    let live;
    try { live = await loadPublished(); }
    catch (err) { $("#panel").innerHTML = `<div class="callout err">Couldn't load content/site.json (${esc(err.message)}).</div>`; return; }
    published = JSON.stringify(live);
    content = live;
    const draft = store.get(DRAFT_KEY);
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (JSON.stringify(d.content) !== published || Object.keys(d.uploads || {}).length) {
          content = d.content; uploads = d.uploads || {};
        }
      } catch {}
    }
    const fromHash = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    if (content.pages.some((p) => p.slug === fromHash)) pageSlug = fromHash;
    renderPageSelect();
    updateLinksList();
    renderPanel();
    refreshStatus();
    sendPreview();
  }

  $("#page-select").onchange = (e) => { pageSlug = e.target.value; renderPanel(); sendPreview(); };
  $("#btn-new-page").onclick = () => $("#dlg-page").showModal();
  $("#dlg-page").addEventListener("close", () => { if ($("#dlg-page").returnValue === "create") newPage($("#new-page-form")); });
  $("#btn-settings").onclick = openSettings;
  $("#dlg-settings").addEventListener("close", () => { renderPanel(); });
  $("#btn-publish").onclick = publish;
  $("#btn-undo").onclick = undo;
  $("#btn-device").onclick = () => document.body.classList.toggle("phone");
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); publish(); }
  });
  window.addEventListener("beforeunload", (e) => { if (content && isDirty() && Object.keys(uploads).length) e.preventDefault(); });

  init();
})();
