/* Portfolio renderer: reads content/site.json and draws the page in the URL hash (#/slug or #/slug/section). */
(function () {
  const app = document.getElementById("app");
  const nav = document.getElementById("site-nav");
  const isPreview = new URLSearchParams(location.search).has("preview");
  let content = null;
  let imageOverrides = {}; // admin preview: unpublished uploads, path -> data URL

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Links are a page ("branding"), a section of a page ("home#works"), a section of this page ("#top"), or a URL.
  function href(link) {
    if (!link) return "#/";
    if (/^(https?:|mailto:|tel:|#\/)/.test(link)) return link;
    let [page, section] = link.split("#");
    page = page || currentSlug();
    return "#/" + page + (section ? "/" + section : "");
  }
  const isExternal = (link) => /^https?:/.test(link || "");
  const linkAttrs = (link) => `href="${esc(href(link))}"` + (isExternal(link) ? ' target="_blank" rel="noopener"' : "");

  function src(path) { return imageOverrides[path] || path; }

  // A block's optional "font" is "body", "heading", "display", or any Google Font name.
  function fontStyle(font) {
    if (!font) return "";
    if (["body", "heading", "display"].includes(font)) return `font-family: var(--font-${font});`;
    return `font-family: "${esc(font)}", var(--font-body);`;
  }

  function img(image, ratio) {
    if (!image || !image.src) {
      return `<div class="ph" ${ratio ? `style="--ratio:${esc(ratio)}"` : ""}>${esc(image?.alt || "Image")}</div>`;
    }
    return `<img src="${esc(src(image.src))}" alt="${esc(image.alt)}" loading="lazy">`;
  }

  const blocks = {
    poster(b) {
      const tabs = (b.tabs || []).map((t) =>
        `<a class="tab" ${linkAttrs(t.link)} style="left:${+t.x || 50}%;top:${+t.y || 50}%">${esc(t.label)}</a>`).join("");
      const footer = (b.footer || []).map((l) => `<p>${esc(l)}</p>`).join("");
      return `<section class="poster" data-poster>
        <div class="poster-tabs">${tabs}</div>
        <p class="poster-eyebrow">${esc(b.eyebrow)}</p>
        <p class="poster-subtitle">${esc(b.subtitle)}</p>
        <h1 class="poster-title" style="${fontStyle(b.font)}">${esc(b.title)}</h1>
        <div class="poster-footer">${footer}</div>
        ${b.scrollCue ? `<a class="poster-cue" ${linkAttrs(b.scrollCueLink || "")}>${esc(b.scrollCue)}</a>` : ""}
      </section>`;
    },
    columns(b) {
      const cols = (b.columns || []).map((c) => {
        const secs = (c.sections || []).map((s) => {
          const cls = ["sec", s.size === "l" && "size-l", s.textSize === "l" && "text-l", s.muted && "muted"].filter(Boolean).join(" ");
          return `<div class="${cls}">
            ${s.image || s.imageHolder ? `<div class="sec-img">${img({ src: s.image, alt: s.imageAlt || "Photo" }, "4 / 5")}</div>` : ""}
            ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
            ${s.text ? `<p>${esc(s.text)}</p>` : ""}
            ${s.list && s.list.length ? `<ul>${s.list.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
          </div>`;
        }).join("");
        return `<div class="col ${c.align ? "valign-" + esc(c.align) : ""}">${secs}</div>`;
      }).join("");
      return `<section class="block columns" style="--cols:${(b.columns || []).length || 1}">${cols}</section>`;
    },
    topbar: (b) => `<header class="block topbar"><span>${esc(b.left)}</span><span>${esc(b.right)}</span></header>`,
    display: (b) => `<h1 class="block display ${b.italic ? "italic" : ""}" style="font-weight:${+b.weight || 300};${fontStyle(b.font)}">${esc(b.text)}</h1>`,
    linklist: (b) => `<ul class="block linklist" style="${fontStyle(b.font)}">${(b.items || []).map((i) =>
      `<li><a ${linkAttrs(i.link)}>${esc(i.label)}</a></li>`).join("")}</ul>`,
    project(b) {
      return `<header class="block project" style="${fontStyle(b.font)}">
        <div class="project-title-row"><h1>${esc(b.title)}</h1>${b.label ? `<span class="project-label">${esc(b.label)}</span>` : ""}</div>
        ${b.tags && b.tags.length ? `<ul class="project-tags">${b.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        ${b.description ? `<p class="project-desc">${esc(b.description)}</p>` : ""}
        ${b.note ? `<p class="project-note">${esc(b.note)}</p>` : ""}
      </header>`;
    },
    text: (b) => `<div class="block text size-${esc(b.size || "m")} ${b.italic ? "italic" : ""} align-${esc(b.align || "left")}" style="${fontStyle(b.font)}">${esc(b.text)}</div>`,
    button: (b) => `<div class="block btn-wrap align-${esc(b.align || "left")}"><a class="btn ${b.style === "solid" ? "solid" : ""}" ${linkAttrs(b.link)}>${esc(b.label)}</a></div>`,
    image(b) {
      const w = b.width || "full";
      return `<div class="block image width-${esc(w)} ${w === "full" ? "full-bleed" : ""}"><figure>${img(b, b.ratio)}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure></div>`;
    },
    gallery(b) {
      const items = (b.images || []).map((i) => `<figure>${img(i, b.ratio)}${i.caption ? `<figcaption>${esc(i.caption)}</figcaption>` : ""}</figure>`).join("");
      return `<div class="block gallery ${b.fullBleed === false ? "" : "full-bleed"}" style="--cols:${+b.columns || 2}">${items}</div>`;
    },
    spacer: (b) => `<div class="spacer size-${esc(b.size || "m")}"></div>`,
  };

  function loadFonts() {
    const f = content.site.fonts || {};
    const root = document.documentElement.style;
    root.setProperty("--font-body", `"${f.body || "Inter Tight"}", system-ui, sans-serif`);
    root.setProperty("--font-heading", `"${f.heading || f.body || "Inter Tight"}", system-ui, sans-serif`);
    root.setProperty("--font-display", `"${f.display || "Archivo Black"}", sans-serif`);
    const names = new Set([f.body, f.heading, f.display].filter(Boolean));
    content.pages.forEach((p) => (p.blocks || []).forEach((b) => {
      if (b.font && !["body", "heading", "display"].includes(b.font)) names.add(b.font);
    }));
    // One stylesheet per family, so a font missing some weights only falls back on its own.
    const head = document.head;
    head.querySelectorAll("link[data-font]").forEach((l) => { if (!names.has(l.dataset.font)) l.remove(); });
    names.forEach((n) => {
      if (head.querySelector(`link[data-font="${CSS.escape(n)}"]`)) return;
      const fam = "family=" + encodeURIComponent(n).replace(/%20/g, "+");
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.dataset.font = n;
      link.onerror = () => { link.onerror = null; link.href = `https://fonts.googleapis.com/css2?${fam}&display=swap`; };
      link.href = `https://fonts.googleapis.com/css2?${fam}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500&display=swap`;
      head.appendChild(link);
    });
  }

  function currentSlug() {
    return route().slug;
  }
  function route() {
    const [slug, section] = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split(/[?#]/)[0].split("/");
    return { slug: slug || "home", section: section || "" };
  }

  function scrollToSection(section, smooth) {
    const behavior = smooth ? "smooth" : "auto";
    if (!section || section === "top") return window.scrollTo({ top: 0, behavior });
    const el = document.getElementById(section);
    if (el) el.scrollIntoView({ behavior, block: "start" });
  }

  function render() {
    if (!content) return;
    const slug = currentSlug();
    rendered = slug;
    const page = content.pages.find((p) => p.slug === slug);
    document.body.className = "theme-" + (page?.theme || "light");
    if (!page) {
      app.innerHTML = `<div class="notfound"><h1>Page not found</h1><p><a href="#/">Back home</a></p></div>`;
    } else {
      app.innerHTML = `<div class="page">${(page.blocks || []).map((b) =>
        (b.anchor ? `<div class="anchor" id="${esc(b.anchor)}"></div>` : "") + (blocks[b.type] ? blocks[b.type](b) : "")).join("")}</div>`;
      document.title = page.slug === "home" ? content.site.title : `${page.title} — ${content.site.title}`;
    }
    const n = content.site.nav || {};
    nav.hidden = !n.show;
    nav.innerHTML = (n.items || []).map((i) => `<a ${linkAttrs(i.link)}>${esc(i.label)}</a>`).join("");
    updateNav();
  }

  // On a page that opens with the poster, the menu fades in once the poster has scrolled away.
  function updateNav() {
    const poster = app.querySelector("[data-poster]");
    const past = !poster || window.scrollY > poster.offsetHeight * 0.6;
    nav.classList.toggle("show", past);
  }
  window.addEventListener("scroll", updateNav, { passive: true });

  let rendered = null;
  window.addEventListener("hashchange", () => {
    const { slug, section } = route();
    if (slug === rendered) return scrollToSection(section, true);
    render();
    requestAnimationFrame(() => scrollToSection(section, false));
  });

  if (isPreview) {
    window.addEventListener("message", (e) => {
      if (e.origin !== location.origin || !e.data || e.data.type !== "preview") return;
      content = e.data.content;
      imageOverrides = e.data.images || {};
      if (e.data.slug && route().slug !== e.data.slug) history.replaceState(null, "", "#/" + e.data.slug);
      loadFonts();
      render();
    });
    window.parent.postMessage({ type: "preview-ready" }, location.origin);
  } else {
    fetch("content/site.json", { cache: "no-cache" })
      .then((r) => r.json())
      .then((data) => { content = data; loadFonts(); render(); requestAnimationFrame(() => route().section && scrollToSection(route().section, false)); })
      .catch(() => { app.innerHTML = '<div class="notfound"><h1>Could not load content/site.json</h1></div>'; });
  }
})();
