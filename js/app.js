/* Public view renderer. Reads static JSON from /data — no token needed. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const bust = (url) => url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();

  async function getJSON(path, fallback) {
    try {
      const r = await fetch(bust(path), { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      console.warn("Could not load", path, e);
      return fallback;
    }
  }

  function iconLink(label, url) {
    return `<a class="chip" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  }

  function renderProfile(c) {
    const p = c.profile || {};
    document.title = `${p.name || "Home"} — ${p.title || ""}`.trim();
    if (p.photo) $("hero-photo").src = bust(p.photo);
    $("hero-photo").alt = p.name || "";
    $("hero-name").textContent = p.name || "";
    $("hero-title").textContent = p.title || "";
    $("hero-tagline").textContent = p.tagline || "";

    const meta = [];
    if (p.location) meta.push(`<span>📍 ${esc(p.location)}</span>`);
    if (p.email) meta.push(`<a href="mailto:${esc(p.email)}">✉ ${esc(p.email)}</a>`);
    if (p.phone) meta.push(`<a href="tel:${esc(p.phone.replace(/\s/g, ""))}">☎ ${esc(p.phone)}</a>`);
    $("hero-meta").innerHTML = meta.join("");

    const s = p.socials || {};
    const acts = [];
    if (s.linkedin) acts.push(iconLink("LinkedIn", s.linkedin));
    if (s.github) acts.push(iconLink("GitHub", s.github));
    if (s.orcid) acts.push(iconLink("ORCID", s.orcid));
    if (s.x) acts.push(iconLink("X", s.x));
    acts.push(`<a class="chip primary" href="#posts">Read posts</a>`);
    $("hero-actions").innerHTML = acts.join("");

    $("about-body").innerHTML = (c.about || "")
      .split(/\n\s*\n/).map((para) => `<p>${esc(para)}</p>`).join("") || '<p class="empty">—</p>';
  }

  function renderSection(sec) {
    const items = sec.items || [];
    let inner = "";
    if (sec.type === "timeline" || sec.type === "list") {
      inner = `<div class="card ${sec.type}">` + (items.length ? items.map((it) => `
        <div class="row">
          <div>
            <div class="heading">${esc(it.heading)}</div>
            ${it.sub ? `<div class="sub">${esc(it.sub)}</div>` : ""}
          </div>
          ${it.meta ? `<div class="meta">${esc(it.meta)}</div>` : "<div></div>"}
          ${it.detail ? `<div class="detail">${esc(it.detail)}</div>` : ""}
        </div>`).join("") : '<div class="row"><div class="empty">No entries yet.</div></div>') + `</div>`;
    } else if (sec.type === "tags") {
      inner = `<div class="tags">` + items.map((t) => `<span class="tag">${esc(t)}</span>`).join("") + `</div>`;
    } else if (sec.type === "bullets") {
      inner = `<ul class="card bullets">` + items.map((t) => `<li>${esc(t)}</li>`).join("") + `</ul>`;
    } else if (sec.type === "text") {
      inner = `<div class="card text-body">` + String(sec.body || "").split(/\n\s*\n/).map((p) => `<p>${esc(p)}</p>`).join("") + `</div>`;
    }
    return `<section class="section" id="${esc(sec.id)}">
      <div class="section-head"><h2>${esc(sec.title)}</h2></div>
      ${inner}
    </section>`;
  }

  function renderSections(c) {
    $("sections").innerHTML = (c.sections || []).map(renderSection).join("");
  }

  function renderPosts(posts) {
    const list = $("posts-list");
    if (!posts || !posts.length) { list.innerHTML = '<div class="card post"><div class="empty">No posts yet.</div></div>'; return; }
    list.innerHTML = posts.map((p) => `
      <article class="card post">
        <h3>${esc(p.title)}</h3>
        <div class="date">${esc(p.date || "")}</div>
        <div class="body">${esc(p.body)}</div>
        ${(p.media && p.media.length) ? `<div class="media">${p.media.map((m) => `<img src="${bust(esc(m))}" alt="" loading="lazy">`).join("")}</div>` : ""}
      </article>`).join("");
  }

  function fileIcon(type, name) {
    const ext = (name.split(".").pop() || "").toUpperCase().slice(0, 4);
    return `<div class="icon">${esc(ext || "DOC")}</div>`;
  }

  function renderLibrary(media) {
    const items = (media && media.items) || [];
    const list = $("library-list");
    if (!items.length) { list.innerHTML = '<div class="empty">No documents or media uploaded yet.</div>'; return; }
    list.innerHTML = items.map((it) => {
      const t = it.type || "document";
      let preview;
      if (t === "image") preview = `<img class="thumb" src="${bust(esc(it.path))}" alt="${esc(it.name)}" loading="lazy">`;
      else if (t === "video") preview = `<video controls preload="metadata" src="${esc(it.path)}"></video>`;
      else preview = fileIcon(t, it.name);
      return `<div class="card doc">
        ${preview}
        <div class="name">${esc(it.name)}</div>
        ${it.caption ? `<div class="cap">${esc(it.caption)}</div>` : ""}
        <a class="open" href="${esc(it.path)}" target="_blank" rel="noopener">Open ↗</a>
      </div>`;
    }).join("");
  }

  async function init() {
    $("year").textContent = new Date().getFullYear();
    const [content, posts, media] = await Promise.all([
      getJSON("data/content.json", { profile: {}, about: "", sections: [] }),
      getJSON("data/posts.json", []),
      getJSON("data/media.json", { items: [] }),
    ]);
    renderProfile(content);
    renderSections(content);
    renderPosts(posts);
    renderLibrary(media);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
