/* ============================================================
   Personal editor. Talks directly to the GitHub Contents API.
   Token lives in sessionStorage only (cleared when tab closes).
   ============================================================ */
(function () {
  "use strict";

  const API = "https://api.github.com";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const state = { content: null, posts: null, media: null };

  // ---------- config / token ----------
  function cfg() {
    const saved = JSON.parse(localStorage.getItem("site_cfg") || "null");
    return Object.assign({}, window.SITE_CONFIG, saved || {});
  }
  function setCfg(c) { localStorage.setItem("site_cfg", JSON.stringify(c)); }
  const token = () => sessionStorage.getItem("gh_token") || localStorage.getItem("gh_token") || "";

  // ---------- helpers ----------
  const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");
  const utf8ToB64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const b64ToUtf8 = (b64) => decodeURIComponent(escape(atob(String(b64).replace(/\s/g, ""))));
  const bust = (u) => u + (u.includes("?") ? "&" : "?") + "t=" + Date.now();
  const genId = (p) => (p || "id") + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function toast(msg, kind) {
    const el = $("status");
    el.textContent = msg;
    el.className = "status show " + (kind || "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = "status " + (kind || ""); }, kind === "err" ? 6000 : 3000);
  }

  const shareURL = (kind, id) => new URL("post.html?" + kind + "=" + encodeURIComponent(id), location.href).href;
  async function copyLink(url) {
    try { await navigator.clipboard.writeText(url); toast("Link copied — paste it on LinkedIn / Instagram.", "ok"); }
    catch (e) { window.prompt("Copy this link:", url); }
  }

  function fileToB64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  function safeName(name) {
    const dot = name.lastIndexOf(".");
    const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "file";
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    return base + "-" + Date.now().toString(36) + (ext ? "." + ext : "");
  }
  function mediaType(file) {
    if ((file.type || "").startsWith("image/")) return "image";
    if ((file.type || "").startsWith("video/")) return "video";
    return "document";
  }

  // ---------- GitHub API ----------
  async function gh(path, opts = {}) {
    return fetch(API + path, Object.assign({}, opts, {
      headers: Object.assign({
        Authorization: "Bearer " + token(),
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      }, opts.headers || {}),
    }));
  }
  async function getFile(pathInRepo) {
    const c = cfg();
    const r = await gh(`/repos/${c.owner}/${c.repo}/contents/${encPath(pathInRepo)}?ref=${c.branch}`);
    if (r.status === 404) return { sha: null, content: null };
    if (!r.ok) throw new Error("GET " + pathInRepo + " → " + r.status + " " + (await r.text()));
    return r.json();
  }
  async function putContent(pathInRepo, b64, message) {
    const c = cfg();
    const cur = await getFile(pathInRepo);
    const body = { message: message || "Update " + pathInRepo, content: b64, branch: c.branch };
    if (cur && cur.sha) body.sha = cur.sha;
    const r = await gh(`/repos/${c.owner}/${c.repo}/contents/${encPath(pathInRepo)}`, {
      method: "PUT", body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("PUT " + pathInRepo + " → " + r.status + " " + (await r.text()));
    return r.json();
  }
  const putJSON = (p, obj, msg) => putContent(p, utf8ToB64(JSON.stringify(obj, null, 2) + "\n"), msg);
  async function deleteFile(pathInRepo, message) {
    const c = cfg();
    const cur = await getFile(pathInRepo);
    if (!cur || !cur.sha) return;
    const r = await gh(`/repos/${c.owner}/${c.repo}/contents/${encPath(pathInRepo)}`, {
      method: "DELETE",
      body: JSON.stringify({ message: message || "Delete " + pathInRepo, sha: cur.sha, branch: c.branch }),
    });
    if (!r.ok) throw new Error("DELETE " + pathInRepo + " → " + r.status);
  }
  async function loadJSON(pathInRepo, fallback) {
    const f = await getFile(pathInRepo);
    if (!f || !f.content) return fallback;
    try { return JSON.parse(b64ToUtf8(f.content)); } catch (e) { return fallback; }
  }

  // ---------- auth ----------
  async function verify() {
    const c = cfg();
    const r = await gh(`/repos/${c.owner}/${c.repo}`);
    if (r.status === 401) throw new Error("Token rejected (401). Check that it is valid.");
    if (r.status === 404) throw new Error(`Repo ${c.owner}/${c.repo} not found or the token lacks access to it.`);
    if (!r.ok) throw new Error("Verification failed (" + r.status + ").");
    const j = await r.json();
    if (j.permissions && !(j.permissions.push || j.permissions.admin)) {
      throw new Error("Token can read but not write this repo. Grant Contents: Read and write.");
    }
    return j;
  }

  async function unlock() {
    const t = $("tok").value.trim();
    if (!t) return toast("Enter a token.", "err");
    sessionStorage.setItem("gh_token", t);
    toast("Verifying…");
    try {
      await verify();
      const remember = $("remember") && $("remember").checked;
      if (remember) localStorage.setItem("gh_token", t);
      else localStorage.removeItem("gh_token");
      state.content = await loadJSON("data/content.json", { profile: { socials: {} }, about: "", sections: [] });
      state.posts = await loadJSON("data/posts.json", []);
      state.media = await loadJSON("data/media.json", { items: [] });
      if (!state.content.profile) state.content.profile = { socials: {} };
      if (!state.content.profile.socials) state.content.profile.socials = {};
      if (!Array.isArray(state.content.sections)) state.content.sections = [];
      $("gate").style.display = "none";
      $("app").style.display = "block";
      $("signout").style.display = "inline-block";
      renderAll();
      toast("Editor unlocked.", "ok");
    } catch (e) {
      sessionStorage.removeItem("gh_token");
      toast(e.message, "err");
    }
  }
  function signout() {
    sessionStorage.removeItem("gh_token");
    localStorage.removeItem("gh_token");
    location.reload();
  }

  // ---------- rendering: PROFILE ----------
  function renderProfile() {
    const p = state.content.profile;
    const s = p.socials;
    $("pane-profile").innerHTML = `
      <div class="panel">
        <h2>Profile</h2>
        <div class="grid-2">
          <div><label>Name</label><input type="text" id="p-name"></div>
          <div><label>Title</label><input type="text" id="p-title"></div>
        </div>
        <label>Tagline</label><input type="text" id="p-tagline">
        <div class="grid-2">
          <div><label>Location</label><input type="text" id="p-location"></div>
          <div><label>Email</label><input type="email" id="p-email"></div>
        </div>
        <div class="grid-2">
          <div><label>Phone</label><input type="tel" id="p-phone"></div>
          <div><label>Photo</label><input type="file" id="p-photo" accept="image/*"></div>
        </div>
        <div class="grid-2">
          <div><label>LinkedIn URL</label><input type="url" id="p-linkedin"></div>
          <div><label>GitHub URL</label><input type="url" id="p-github"></div>
        </div>
        <div class="grid-2">
          <div><label>ORCID URL</label><input type="url" id="p-orcid"></div>
          <div><label>X / Twitter URL</label><input type="url" id="p-x"></div>
        </div>
        <label>About</label><textarea id="p-about"></textarea>
        <div style="margin-top:16px"><button class="btn" id="save-content">Save profile</button></div>
      </div>`;
    const bind = (id, obj, key) => { const el = $(id); el.value = obj[key] || ""; el.addEventListener("input", () => obj[key] = el.value); };
    bind("p-name", p, "name"); bind("p-title", p, "title"); bind("p-tagline", p, "tagline");
    bind("p-location", p, "location"); bind("p-email", p, "email"); bind("p-phone", p, "phone");
    bind("p-linkedin", s, "linkedin"); bind("p-github", s, "github"); bind("p-orcid", s, "orcid"); bind("p-x", s, "x");
    bind("p-about", state.content, "about");
    $("p-photo").addEventListener("change", onPhoto);
    $("save-content").addEventListener("click", saveContent);
  }
  async function onPhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    try {
      toast("Uploading photo…");
      const path = "uploads/" + safeName(file.name);
      await putContent(path, await fileToB64(file), "Update profile photo");
      state.content.profile.photo = path;
      await saveContent(true);
      toast("Photo updated.", "ok");
    } catch (err) { toast(err.message, "err"); }
  }

  // ---------- rendering: SECTIONS ----------
  const TYPES = [["timeline", "Timeline (heading, sub, date, detail)"], ["list", "List (heading, sub, note)"], ["tags", "Tags / pills"], ["bullets", "Bullet points"], ["text", "Free text"]];
  function renderSections() {
    const secs = state.content.sections;
    $("pane-sections").innerHTML = `
      <div class="panel">
        <h2>Sections</h2>
        <p class="hint">Build any sections you like — education, publications, cases, notes… Drag order with the ▲▼ buttons.</p>
        <div id="sec-list">${secs.map(sectionHTML).join("") || '<div class="empty">No sections yet.</div>'}</div>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn secondary" id="add-sec">+ Add section</button>
          <button class="btn" id="save-content2">Save sections</button>
        </div>
      </div>`;
    secs.forEach(wireSection);
    $("add-sec").addEventListener("click", () => {
      secs.push({ id: genId("sec"), type: "text", title: "New section", body: "", items: [] });
      renderSections();
    });
    $("save-content2").addEventListener("click", saveContent);
  }
  function sectionHTML(sec, i) {
    let editor = "";
    if (sec.type === "tags" || sec.type === "bullets") {
      editor = `<label>Items (one per line)</label><textarea data-si="${i}" data-role="lines">${esc((sec.items || []).join("\n"))}</textarea>`;
    } else if (sec.type === "text") {
      editor = `<label>Text</label><textarea data-si="${i}" data-role="body">${esc(sec.body || "")}</textarea>`;
    } else {
      editor = `<div data-items="${i}">${(sec.items || []).map((it, j) => itemHTML(i, j, it)).join("")}</div>
        <button class="btn ghost" data-additem="${i}">+ add entry</button>`;
    }
    return `<div class="item-row" data-sec="${i}">
      <div class="top">
        <input type="text" data-si="${i}" data-role="title" value="${esc(sec.title || "")}" style="max-width:60%">
        <div class="row-actions">
          <button class="btn ghost" data-move="${i}" data-dir="-1">▲</button>
          <button class="btn ghost" data-move="${i}" data-dir="1">▼</button>
          <button class="btn danger" data-delsec="${i}">Delete</button>
        </div>
      </div>
      <label>Type</label>
      <select data-si="${i}" data-role="type">${TYPES.map(([v, l]) => `<option value="${v}" ${sec.type === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      ${editor}
    </div>`;
  }
  function itemHTML(i, j, it) {
    return `<div class="grid-2" data-item="${i}-${j}" style="margin-bottom:8px">
      <input type="text" placeholder="Heading" data-ii="${i}-${j}" data-k="heading" value="${esc(it.heading || "")}">
      <input type="text" placeholder="Subtitle" data-ii="${i}-${j}" data-k="sub" value="${esc(it.sub || "")}">
      <input type="text" placeholder="Date / meta" data-ii="${i}-${j}" data-k="meta" value="${esc(it.meta || "")}">
      <div style="display:flex;gap:8px"><input type="text" placeholder="Detail" data-ii="${i}-${j}" data-k="detail" value="${esc(it.detail || "")}" style="flex:1">
      <button class="btn danger" data-delitem="${i}-${j}">✕</button></div>
    </div>`;
  }
  function wireSection(sec, i) {
    const root = $("pane-sections");
    root.querySelectorAll(`[data-si="${i}"]`).forEach((el) => {
      const role = el.getAttribute("data-role");
      el.addEventListener("input", () => {
        if (role === "title") sec.title = el.value;
        else if (role === "body") sec.body = el.value;
        else if (role === "lines") sec.items = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
      });
      if (role === "type") el.addEventListener("change", () => {
        sec.type = el.value;
        if (sec.type === "tags" || sec.type === "bullets") { if (!Array.isArray(sec.items) || typeof sec.items[0] === "object") sec.items = []; }
        else if (sec.type === "text") { sec.body = sec.body || ""; }
        else { if (!Array.isArray(sec.items) || typeof sec.items[0] === "string") sec.items = []; }
        renderSections();
      });
    });
    root.querySelectorAll(`[data-ii^="${i}-"]`).forEach((el) => {
      const [si, ji] = el.getAttribute("data-ii").split("-").map(Number);
      const k = el.getAttribute("data-k");
      el.addEventListener("input", () => { state.content.sections[si].items[ji][k] = el.value; });
    });
    const add = root.querySelector(`[data-additem="${i}"]`);
    if (add) add.addEventListener("click", () => { sec.items = sec.items || []; sec.items.push({ heading: "", sub: "", meta: "", detail: "" }); renderSections(); });
    root.querySelectorAll(`[data-delitem^="${i}-"]`).forEach((b) => b.addEventListener("click", () => {
      const [si, ji] = b.getAttribute("data-delitem").split("-").map(Number);
      state.content.sections[si].items.splice(ji, 1); renderSections();
    }));
    const del = root.querySelector(`[data-delsec="${i}"]`);
    if (del) del.addEventListener("click", () => { if (confirm("Delete this section?")) { state.content.sections.splice(i, 1); renderSections(); } });
    root.querySelectorAll(`[data-move="${i}"]`).forEach((b) => b.addEventListener("click", () => {
      const dir = Number(b.getAttribute("data-dir")); const to = i + dir; const s = state.content.sections;
      if (to < 0 || to >= s.length) return; [s[i], s[to]] = [s[to], s[i]]; renderSections();
    }));
  }

  async function saveContent(silent) {
    try {
      if (silent !== true) toast("Saving…");
      await putJSON("data/content.json", state.content, "Update site content");
      if (silent !== true) toast("Saved. The public site updates in a moment.", "ok");
    } catch (e) { toast(e.message, "err"); }
  }

  // ---------- rendering: POSTS ----------
  function renderPosts() {
    const posts = state.posts || [];
    $("pane-posts").innerHTML = `
      <div class="panel">
        <h2>Create a post</h2>
        <p class="hint">Share a note, announcement, or teaching material — attach photos, videos, or documents (PDF, slides). After publishing, use <strong>Copy share link</strong> to post it on LinkedIn or Instagram.</p>
        <label>Title</label><input type="text" id="post-title" placeholder="e.g. New lecture notes: Fundamental Rights">
        <label>Caption</label><textarea id="post-body" style="min-height:120px" placeholder="Write your caption here…"></textarea>
        <label>Attachments — photos, videos, PDFs, slides (optional, select several)</label>
        <input type="file" id="post-files" multiple>
        <div style="margin-top:14px"><button class="btn" id="publish">Publish post</button></div>
      </div>
      <div class="panel">
        <h3>Published posts</h3>
        ${posts.length ? posts.map((p, i) => `
          <div class="item-row"><div class="top">
            <strong>${esc(p.title || "Untitled")}</strong>
            <div class="row-actions">
              <button class="btn secondary" data-copypost="${esc(p.id)}">🔗 Copy share link</button>
              <a class="btn ghost" href="${esc(shareURL("id", p.id))}" target="_blank" rel="noopener">Open ↗</a>
              <button class="btn danger" data-delpost="${i}">Delete</button>
            </div>
          </div><div class="hint">${esc(p.date || "")}${(window.postAttachments ? window.postAttachments(p).length : (p.attachments || p.media || []).length) ? " · " + ((p.attachments || []).length + (p.media || []).length) + " attachment(s)" : ""}</div></div>`).join("") : '<div class="empty">No posts yet.</div>'}
      </div>`;
    $("publish").addEventListener("click", publishPost);
    $("pane-posts").querySelectorAll("[data-delpost]").forEach((b) =>
      b.addEventListener("click", () => deletePost(Number(b.getAttribute("data-delpost")))));
    $("pane-posts").querySelectorAll("[data-copypost]").forEach((b) =>
      b.addEventListener("click", () => copyLink(shareURL("id", b.getAttribute("data-copypost")))));
  }
  async function publishPost() {
    const title = $("post-title").value.trim();
    const body = $("post-body").value.trim();
    const files = Array.from($("post-files").files || []);
    if (!title && !body && !files.length) return toast("Add a title, caption, or attachment.", "err");
    try {
      toast("Publishing…");
      const attachments = [];
      for (const f of files) {
        const type = mediaType(f);
        const dir = type === "document" ? "docs/" : "uploads/";
        const path = dir + safeName(f.name);
        await putContent(path, await fileToB64(f), "Add attachment: " + f.name);
        attachments.push({ name: f.name, path, type });
      }
      const post = { id: genId("post"), title, body, date: new Date().toISOString().slice(0, 10), attachments };
      state.posts.unshift(post);
      await putJSON("data/posts.json", state.posts, "Add post: " + (title || "untitled"));
      renderPosts();
      toast("Post published — click ‘Copy share link’ to share it.", "ok");
    } catch (e) { toast(e.message, "err"); }
  }
  async function deletePost(i) {
    if (!confirm("Delete this post?")) return;
    try {
      toast("Deleting…");
      state.posts.splice(i, 1);
      await putJSON("data/posts.json", state.posts, "Delete post");
      renderPosts();
      toast("Post deleted.", "ok");
    } catch (e) { toast(e.message, "err"); }
  }

  // ---------- rendering: MEDIA ----------
  function renderMedia() {
    const items = (state.media && state.media.items) || [];
    $("pane-media").innerHTML = `
      <div class="panel">
        <h2>Upload documents &amp; media</h2>
        <p class="hint">PDFs, images, videos, slides… Keep files under ~25&nbsp;MB each (GitHub API limit). Uploaded files are public.</p>
        <label>File(s)</label><input type="file" id="m-files" multiple>
        <label>Caption (optional, applies to all in this batch)</label><input type="text" id="m-cap">
        <div style="margin-top:14px"><button class="btn" id="upload">Upload</button></div>
      </div>
      <div class="panel">
        <h3>Library</h3>
        ${items.length ? items.map((it, i) => `
          <div class="item-row"><div class="top">
            <strong>${esc(it.name)} <span class="hint">(${esc(it.type)})</span></strong>
            <div class="row-actions">
              <button class="btn secondary" data-copymedia="${esc(it.id)}">🔗 Copy share link</button>
              <a class="btn ghost" href="${esc(it.path)}" target="_blank" rel="noopener">Open ↗</a>
              <button class="btn danger" data-delmedia="${i}">Delete</button>
            </div></div>
            ${it.caption ? `<div class="hint">${esc(it.caption)}</div>` : ""}
          </div>`).join("") : '<div class="empty">Nothing uploaded yet.</div>'}
      </div>`;
    $("upload").addEventListener("click", uploadMedia);
    $("pane-media").querySelectorAll("[data-delmedia]").forEach((b) =>
      b.addEventListener("click", () => deleteMedia(Number(b.getAttribute("data-delmedia")))));
    $("pane-media").querySelectorAll("[data-copymedia]").forEach((b) =>
      b.addEventListener("click", () => copyLink(shareURL("media", b.getAttribute("data-copymedia")))));
  }
  async function uploadMedia() {
    const files = Array.from($("m-files").files || []);
    if (!files.length) return toast("Choose at least one file.", "err");
    const caption = $("m-cap").value.trim();
    try {
      for (const f of files) {
        toast("Uploading " + f.name + "…");
        const type = mediaType(f);
        const dir = type === "document" ? "docs/" : "uploads/";
        const path = dir + safeName(f.name);
        await putContent(path, await fileToB64(f), "Add file: " + f.name);
        state.media.items.unshift({ id: genId("m"), name: f.name, path, type, caption, date: new Date().toISOString().slice(0, 10) });
      }
      await putJSON("data/media.json", state.media, "Update media library");
      renderMedia();
      toast("Upload complete.", "ok");
    } catch (e) { toast(e.message, "err"); }
  }
  async function deleteMedia(i) {
    const it = state.media.items[i];
    if (!confirm("Delete " + it.name + "? This removes the file from the repo.")) return;
    try {
      toast("Deleting…");
      await deleteFile(it.path, "Delete file: " + it.name);
      state.media.items.splice(i, 1);
      await putJSON("data/media.json", state.media, "Update media library");
      renderMedia();
      toast("Deleted.", "ok");
    } catch (e) { toast(e.message, "err"); }
  }

  // ---------- rendering: SETTINGS ----------
  function renderSettings() {
    const c = cfg();
    $("pane-settings").innerHTML = `
      <div class="panel">
        <h2>Settings</h2>
        <p class="hint">Which repository this editor writes to. Change only if you renamed or moved the repo.</p>
        <div class="grid-2">
          <div><label>Owner</label><input type="text" id="c-owner" value="${esc(c.owner)}"></div>
          <div><label>Repository</label><input type="text" id="c-repo" value="${esc(c.repo)}"></div>
        </div>
        <label>Branch</label><input type="text" id="c-branch" value="${esc(c.branch)}">
        <div class="row-actions" style="margin-top:14px">
          <button class="btn" id="save-cfg">Save settings</button>
          <button class="btn danger" id="signout2">Sign out</button>
        </div>
      </div>`;
    $("save-cfg").addEventListener("click", () => {
      setCfg({ owner: $("c-owner").value.trim(), repo: $("c-repo").value.trim(), branch: $("c-branch").value.trim() || "main" });
      toast("Settings saved.", "ok");
    });
    $("signout2").addEventListener("click", signout);
  }

  function renderAll() { renderProfile(); renderSections(); renderPosts(); renderMedia(); renderSettings(); }

  // ---------- tabs / boot ----------
  function initTabs() {
    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".tabpane").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      $("pane-" + t.getAttribute("data-tab")).classList.add("active");
    }));
  }
  document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    $("login").addEventListener("click", unlock);
    $("tok").addEventListener("keydown", (e) => { if (e.key === "Enter") unlock(); });
    $("signout").addEventListener("click", (e) => { e.preventDefault(); signout(); });
    // If a token was remembered on this device, sign in automatically.
    const saved = localStorage.getItem("gh_token");
    if (saved) { $("tok").value = saved; if ($("remember")) $("remember").checked = true; unlock(); }
  });
})();
