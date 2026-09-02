/* Single post / single file viewer. URL: post.html?id=<postId> or ?media=<mediaId>. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const bust = (u) => u + (u.includes("?") ? "&" : "?") + "t=" + Date.now();
  const qp = (n) => new URLSearchParams(location.search).get(n);
  async function getJSON(path, fb) {
    try { const r = await fetch(bust(path), { cache: "no-store" }); if (!r.ok) throw 0; return await r.json(); }
    catch (e) { return fb; }
  }
  const notFound = (m) => `<div class="card post single"><div class="empty">${m}</div></div>`;

  async function init() {
    const el = $("single");
    const postId = qp("id"), mediaId = qp("media");
    if (postId) {
      const posts = await getJSON("data/posts.json", []);
      const p = posts.find((x) => x.id === postId);
      if (!p) return void (el.innerHTML = notFound("This post wasn’t found — it may have been removed. <a href='index.html'>Go home</a>."));
      document.title = (p.title || "Post") + " · Shalini Singh";
      el.innerHTML = `<article class="card post single">
        <h1>${esc(p.title || "Untitled")}</h1>
        <div class="date">${esc(p.date || "")}</div>
        <div class="body">${esc(p.body)}</div>
        ${window.attachmentsHTML(window.postAttachments(p))}
        <div class="post-actions">
          <button class="mini copy" data-copy="${esc(window.permalink(p.id))}">🔗 Copy link to share</button>
        </div>
      </article>`;
    } else if (mediaId) {
      const media = await getJSON("data/media.json", { items: [] });
      const it = (media.items || []).find((x) => x.id === mediaId);
      if (!it) return void (el.innerHTML = notFound("This file wasn’t found. <a href='index.html'>Go home</a>."));
      document.title = (it.name || "File") + " · Shalini Singh";
      el.innerHTML = `<article class="card post single">
        <h1>${esc(it.name)}</h1>
        ${it.caption ? `<div class="body">${esc(it.caption)}</div>` : ""}
        ${window.attachmentsHTML([{ name: it.name, path: it.path, type: it.type || "document" }])}
        <div class="post-actions">
          <a class="mini" href="${esc(it.path)}" target="_blank" rel="noopener">View / Download ↗</a>
          <button class="mini copy" data-copy="${esc(window.medialink(it.id))}">🔗 Copy link</button>
        </div>
      </article>`;
    } else {
      el.innerHTML = notFound("No post specified. <a href='index.html'>Go home</a>.");
    }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
