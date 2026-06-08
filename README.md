# 💍 Wedding Photo Collection

**Sarah & James · June 14, 2025**

A luxury minimalist wedding photo collection web app. Guests tap a button, take a photo, and share it — limited to 5 uploads per device. Couples and their admin can view and download all submissions.

---

## ✦ Features

- **Guest flow**: Single button → camera → preview → upload
- **5-photo limit** per device (stored in localStorage)
- **Thank-you screen** when limit is reached
- **Admin dashboard** at `/admin` — password protected, masonry grid, lightbox, download all
- **Cloudinary** cloud storage — photos are safe forever
- **Mobile-first** — works perfectly on all phones

---

## ✦ Project Structure

```
wedding-photo-collection/
├── api/                   # Vercel serverless functions
│   ├── upload.js          # POST /api/upload
│   ├── photos.js          # GET  /api/photos
│   ├── download-all.js    # GET  /api/download-all
│   └── package.json       # API dependencies
├── src/
│   ├── main.jsx           # React entry + routing
│   ├── App.jsx            # Guest homepage + camera flow
│   ├── App.css
│   ├── index.css          # Global styles + design tokens
│   └── pages/
│       ├── Admin.jsx      # Admin dashboard
│       └── Admin.css
├── index.html
├── vite.config.js
├── vercel.json            # Routing config
├── package.json
└── .env.example           # ← copy to .env.local
```

---

## ✦ Setup in 4 Steps

### Step 1 — Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd wedding-photo-collection

# Install frontend deps
npm install

# Install API deps
cd api && npm install && cd ..
```

### Step 2 — Create a Cloudinary account

1. Go to [cloudinary.com](https://cloudinary.com) and sign up (free tier is plenty)
2. From your **Dashboard**, copy:
   - Cloud Name
   - API Key
   - API Secret

### Step 3 — Set environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
VITE_ADMIN_PASSWORD=your_secret_password
```

### Step 4 — Run locally

```bash
npm run dev
```

Visit `http://localhost:5173` for the guest page and `http://localhost:5173/admin` for the dashboard.

> **Note**: For local API testing you need [Vercel CLI](https://vercel.com/cli): `npm i -g vercel && vercel dev`

---

## ✦ Deploy to Vercel (via GitHub)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repository
3. Framework: **Vite** (auto-detected)
4. Click **Deploy** — Vercel handles the rest

### 3. Add environment variables in Vercel

Go to your project → **Settings** → **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `CLOUDINARY_CLOUD_NAME` | your cloud name |
| `CLOUDINARY_API_KEY` | your API key |
| `CLOUDINARY_API_SECRET` | your API secret |
| `VITE_ADMIN_PASSWORD` | your admin password |

Click **Save** → **Redeploy** (Deployments tab → ⋯ → Redeploy).

---

## ✦ Personalise the App

### Change the couple's names & date

Edit `src/App.jsx` — find and update:
```jsx
<span>Sarah</span>
<span className="ampersand">&amp;</span>
<span>James</span>
...
<p className="home-date fade-up fade-up-3">June 14, 2025</p>
```

Also update `index.html` title:
```html
<title>Sarah & James · June 14, 2025</title>
```

And the Cloudinary folder in `api/upload.js` and `api/photos.js`:
```js
folder: 'wedding-sarah-james-2025',
```

### Change the upload limit

In `src/App.jsx`:
```js
const MAX_UPLOADS = 5  // change to any number
```

### Change the admin password

In `.env.local` and Vercel environment variables:
```
VITE_ADMIN_PASSWORD=your_new_password
```

---

## ✦ Admin Dashboard

Visit `/admin` on your deployed URL.

- Login with your admin password
- View all submitted photos in a masonry grid
- Click any photo to open fullscreen lightbox
- Download individual photos or **Download All** as a zip

---

## ✦ Share with Guests

Share your Vercel URL (e.g. `your-wedding.vercel.app`) via:
- QR code on tables (generate at qr-code-generator.com)
- WhatsApp group
- Wedding website link

Guests open it on their phone, tap **Capture a Moment**, and their camera opens directly.

---

*Built with React + Vite + Vercel Serverless + Cloudinary*
