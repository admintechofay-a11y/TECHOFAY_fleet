# Vercel Deployment Guide - Technofay Fleet & Transport Platform

This guide covers deploying the **Technofay Fleet & Transport Management Platform (Haulage OS)** to **Vercel**.

---

## 🚀 Quick Deployment Options

You have two supported ways to deploy on Vercel:

### Option 1: Frontend on Vercel (Recommended for Best Performance)
Deploy the React + Vite frontend to Vercel's global Edge CDN, connecting to your Node.js backend hosted on Render, Railway, AWS, or VPS.

1. **Import Repository**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your GitHub repo: `admintechofay-a11y/TECHOFAY_fleet`.
2. **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build` (automatic)
   - **Output Directory**: `dist` (automatic)
3. **Environment Variables**:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://your-api-domain.com` | Your backend API URL (e.g. Render/Railway) |
4. Click **Deploy**. Vercel will build and deploy in ~30 seconds with automatic SSL and SPA rewrites (`apps/web/vercel.json`).

---

### Option 2: Fullstack Monorepo on Vercel (Frontend + Serverless API)
Deploy both the frontend and Express REST API directly on Vercel using the included root `vercel.json` and serverless bridge (`api/index.js`).

1. **Import Repository**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select `admintechofay-a11y/TECHOFAY_fleet`.
2. **Project Settings**:
   - **Root Directory**: `./` (Leave as root)
   - **Build Command**: `npm run build` (automatically runs `npm --prefix apps/web run build`)
   - **Output Directory**: `apps/web/dist`
3. **Environment Variables**:
   Add the following in the Vercel dashboard (**Settings → Environment Variables**):
   | Variable | Required | Example / Description |
   | :--- | :--- | :--- |
   | `MONGO_URI` | **Yes** | `mongodb+srv://user:pass@cluster.mongodb.net/fleet_prod?retryWrites=true&w=majority` |
   | `JWT_SECRET` | **Yes** | Strong 64-character secret key |
   | `JWT_REFRESH_SECRET` | **Yes** | Strong 64-character refresh secret key |
   | `CLIENT_URL` | Optional | Your Vercel deployment URL (e.g. `https://techofay-fleet.vercel.app`) |
   | `NODE_ENV` | Optional | `production` |
4. Click **Deploy**.

---

## 🛠️ Included Vercel Configuration Files

1. **`apps/web/vercel.json`**:
   Configures Single-Page Application (SPA) rewrites for client-side routing (`/login`, `/register`, `/app/*`, `/track`, etc.) and immutable caching for static assets.

2. **`vercel.json` (Root)**:
   Routes `/api/(.*)` to the serverless function handler (`/api/index.js`) and all other routes to `/apps/web/dist/index.html`.

3. **`api/index.js`**:
   Serverless adapter for the Express application that automatically manages warm MongoDB connection pooling.

4. **`apps/api/src/app.js` CORS**:
   Configured to automatically allow requests from any `*.vercel.app` preview or production deployment URL.

---

## 📋 Checklist Before Going Live

- [x] `apps/web/vercel.json` created with SPA catch-all rewrites.
- [x] Root `vercel.json` created with `/api/*` and SPA routing.
- [x] `package.json` includes `"build": "npm --prefix apps/web run build"`.
- [x] Frontend `api.ts` supports `VITE_API_BASE_URL` with fallback to `/api/v1`.
- [x] CORS in backend configured to whitelist `*.vercel.app` domains.
- [x] Verified production build exits cleanly with code 0.
