/* Public view renderer. Reads static JSON from /data — no token needed. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const bust = (url) => url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  const ext = (name) => (String(name).split(".").pop() || "").toUpperCase().slice(0, 4) || "DOC";
  window.permalink = (id) => new URL("post.html?id=" + encodeURIComponent(id), location.href).href;
  window.medialink = (id) => new URL("post.html?media=" + encodeURIComponent(id), location.href).href;

  async function getJSON(path, fallback) {
    try {
      const r = await fetch(bust(path), { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) { console.warn("Could not load", path, e); return fallback; }
  }

  // ---- toast ----
  function toast(msg, kind) {
    let el = $("status");
    if (!el) { el = document.createElement("div"); el.id = "status"; el.className = "status"; document.body.appendChild(el); }
    el.textContent = msg; el.className = "status show " + (kind || "");
    clearTimeout(toast._t); toast._t = setTimeout(() => { el.className = "status " + (kind || ""); }, 2500);
  }
  window.copyToClip = async function (text) {
    try { await navigator.clipboard.writeText(text); toast("Link copied — paste it on LinkedIn / Instagram.", "ok"); }
    catch (e) { window.prompt("Copy this link:", text); }
  };

  // ---- shared: normalize + render attachments ----
  window.postAttachments = function (p) {
    const out = [];
    (p.attachments || []).forEach((a) => out.push(a));
    (p.media || []).forEach((m) => out.push({ name: String(m).split("/").pop(), path: m, type: "image" }));
    return out;
  };
  window.attachmentsHTML = function (atts) {
    if (!atts || !atts.length) return "";
    return `<div class="attachments">` + atts.map((a) => {
      if (a.type === "image") return `<a href="${esc(a.path)}" target="_blank" rel="noopener"><img class="att-img" src="${bust(esc(a.path))}" alt="${esc(a.name)}" loading="lazy"></a>`;
      if (a.type === "video") return `<video class="att-video" controls preload="metadata" src="${esc(a.path)}"></video>`;
      return `<a class="att-doc" href="${esc(a.path)}" target="_blank" rel="noopener"><span class="ic">${esc(ext(a.name))}</span><span class="nm">${esc(a.name)}</span><span class="dl">View / Download ↗</span></a>`;
    }).join("") + `</div>`;
  };

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
    if (s.linkedin) acts.push(`<a class="chip" href="${esc(s.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>`);
    if (s.orcid) acts.push(`<a class="chip" href="${esc(s.orcid)}" target="_blank" rel="noopener">ORCID</a>`);
    if (s.x) acts.push(`<a class="chip" href="${esc(s.x)}" target="_blank" rel="noopener">X</a>`);
    acts.push(`<a class="chip primary" href="#posts">Latest posts</a>`);
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
    list.innerHTML = posts.map((p) => {
      const url = window.permalink(p.id);
      return `<article class="card post" id="${esc(p.id)}">
        <h3><a href="post.html?id=${encodeURIComponent(p.id)}">${esc(p.title || "Untitled")}</a></h3>
        <div class="date">${esc(p.date || "")}</div>
        <div class="body">${esc(p.body)}</div>
        ${window.attachmentsHTML(window.postAttachments(p))}
        <div class="post-actions">
          <a class="mini" href="post.html?id=${encodeURIComponent(p.id)}">Open post ↗</a>
          <button class="mini copy" data-copy="${esc(url)}">🔗 Copy link to share</button>
        </div>
      </article>`;
    }).join("");
  }

  function renderLibrary(media) {
    const items = (media && media.items) || [];
    const list = $("library-list");
    if (!items.length) { list.innerHTML = '<div class="empty">No documents or media uploaded yet.</div>'; return; }
    list.innerHTML = items.map((it) => {
      const t = it.type || "document";
      const url = window.medialink(it.id);
      let preview;
      if (t === "image") preview = `<img class="thumb" src="${bust(esc(it.path))}" alt="${esc(it.name)}" loading="lazy">`;
      else if (t === "video") preview = `<video controls preload="metadata" src="${esc(it.path)}"></video>`;
      else preview = `<div class="icon">${esc(ext(it.name))}</div>`;
      return `<div class="card doc">
        ${preview}
        <div class="name">${esc(it.name)}</div>
        ${it.caption ? `<div class="cap">${esc(it.caption)}</div>` : ""}
        <div class="post-actions">
          <a class="open" href="${esc(it.path)}" target="_blank" rel="noopener">View ↗</a>
          <button class="mini copy" data-copy="${esc(url)}">🔗 Copy link</button>
        </div>
      </div>`;
    }).join("");
  }

  function wireCopy() {
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-copy]");
      if (b) { e.preventDefault(); window.copyToClip(b.getAttribute("data-copy")); }
    });
  }

  async function init() {
    const y = $("year"); if (y) y.textContent = new Date().getFullYear();
    wireCopy();
    if (!$("posts-list")) return; // not the index page (e.g. post.html handles itself)
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
