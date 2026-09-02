# Shalini Singh — Advocate & Legal Educator

Personal website with a **public view** and a token-gated **personal editor**, hosted on GitHub Pages. Content (profile, sections, posts, documents/media) is stored as files in this repository and edited directly from the browser via the GitHub API — no separate server.

## How it works

- **Public view** (`index.html`) reads static JSON in `data/` and files in `uploads/` / `docs/`. No login, fast, no rate limits.
- **Personal editor** (`admin.html`) asks for a GitHub token, then lets you edit the profile, add/reorder sections, publish posts, and upload documents & media. Every change is committed to this repo through the GitHub Contents API.

> ⚠️ **Privacy reality:** GitHub Pages on a free plan requires a **public** repo. Everything you upload or post is therefore **publicly viewable**. The login protects *who can edit*, not *who can see*. Do not upload anything confidential (client files, private documents).

## One-time setup

### 1. Create the repository
On the **advocateshaliniofficial** GitHub account, create a repo named:

```
advocateshaliniofficial.github.io
```

### 2. Push this folder
```bash
git init
git add -A
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/advocateshaliniofficial/advocateshaliniofficial.github.io.git
git push -u origin main
```
When prompted for a password, paste your **fine-grained personal access token** (below) — not your account password. Rotate/delete it afterward if you like.

### 3. Turn on Pages
Repo → **Settings → Pages → Source: Deploy from a branch → `main` / root → Save.**
The site goes live at **https://advocateshaliniofficial.github.io/** within a minute or two.

## Using the personal editor

1. Create a **fine-grained personal access token**: GitHub → Settings → Developer settings → **Fine-grained tokens** → *Generate new token*.
   - **Resource owner:** advocateshaliniofficial
   - **Repository access:** Only select repositories → `advocateshaliniofficial.github.io`
   - **Permissions → Repository → Contents:** **Read and write**
2. Go to `…github.io/admin.html`, paste the token, click **Unlock editor**.
   - The token is stored only in this browser tab (session storage) and is cleared when you close it. It is never committed.
3. Edit under the tabs:
   - **Profile** — name, title, contacts, photo, about.
   - **Sections** — add/reorder/delete sections (timeline, list, tags, bullets, free text). *Education, Membership, Interests, etc. are seeded from the résumé.*
   - **Posts** — Facebook-style posts with optional images.
   - **Documents & Media** — upload PDFs, images, videos (keep each under ~25 MB).
4. Changes appear on the public site within a moment (GitHub Pages CDN refresh).

## Files
```
index.html      Public view
admin.html      Personal editor (noindex)
css/style.css   Original academic design (Oxford-blue + gold)
js/config.js    owner / repo / branch
js/app.js       Public renderer
js/admin.js     Editor + GitHub API
data/*.json     Content, posts, media manifest
uploads/        Images & video
docs/           Documents (PDFs, etc.)
```

## Notes
- **Design** is original, inspired by an academic-publisher aesthetic. No third-party logos, trademarks, or brand assets are used.
- To change the target repo without editing code, use the editor's **Settings** tab.
- Token compromised? Delete it in GitHub settings; nothing else to clean up.
