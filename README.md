# promptvault

A local prompt documentation manager built with React + Vite.

Features: versioned prompts, dark/light mode, groups, side-by-side diff, links, tags, and localStorage persistence.

---

## Quick Start (run locally)

```bash
npm install
npm run dev
```

Then open http://localhost:5173

---

## Push to GitHub (step by step)

### Step 1 — Create a repo on GitHub

1. Go to https://github.com/new
2. Name it `promptvault`
3. Leave it **empty** (no README, no .gitignore) — you'll push your own
4. Click **Create repository**
5. Copy the repo URL shown — it looks like:
   `https://github.com/YOUR_USERNAME/promptvault.git`

---

### Step 2 — Install Git (if not already)

**Mac:**
```bash
brew install git
```

**Windows:** Download from https://git-scm.com/download/win

**Linux:**
```bash
sudo apt install git
```

Verify it works:
```bash
git --version
```

---

### Step 3 — Configure Git (first time only)

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

### Step 4 — Initialize and push

Navigate into this folder, then run:

```bash
cd promptvault

git init
git add .
git commit -m "Initial commit — PromptVault"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/promptvault.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

### Step 5 — Authenticate with GitHub

If Git asks for a password, GitHub no longer accepts your account password. You need a **Personal Access Token (PAT)**:

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Give it a name, set expiry, and tick **repo** scope
4. Click **Generate token** and copy it
5. When Git prompts for password — paste the token instead

To avoid entering it every time:
```bash
git config --global credential.helper store
```
(This saves credentials to disk after first use.)

---

## Pushing future updates

After making changes:

```bash
git add .
git commit -m "describe what you changed"
git push
```

---

## Deploy to GitHub Pages (optional)

To make it accessible via a public URL:

1. Install the deploy package:
```bash
npm install --save-dev gh-pages
```

2. Add this to `package.json` under `"scripts"`:
```json
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"
```

3. Also add this to `vite.config.js`:
```js
export default defineConfig({
  plugins: [react()],
  base: '/promptvault/',
})
```

4. Deploy:
```bash
npm run deploy
```

Your app will be live at:
`https://YOUR_USERNAME.github.io/promptvault/`

---

## Project structure

```
promptvault/
├── src/
│   ├── App.jsx        # entire app — components, styles, logic
│   └── main.jsx       # React entry point
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
└── README.md
```
