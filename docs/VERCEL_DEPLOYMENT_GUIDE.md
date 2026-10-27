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

### Option 2: Fullstack Multi-Service Monorepo on Vercel (Recommended)
Deploy both the React frontend and Express REST API as a multi-service project within a single Vercel deployment using `vercel.json` services and internal bindings.

1. **Import Repository**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select `admintechofay-a11y/TECHOFAY_fleet`.
2. **Project Settings**:
   - **Root Directory**: `./` (Leave as repository root so Vercel reads `vercel.json` services)
3. **Environment Variables**:
   Add the following in the Vercel dashboard (**Settings → Environment Variables**):
   | Variable | Required | Example / Description |
   | :--- | :--- | :--- |
   | `MONGODB_URI` | **Yes** | `mongodb+srv://user:pass@cluster.mongodb.net/fleet_prod?retryWrites=true&w=majority` |
   | `JWT_SECRET` | **Yes** | Strong 64-character secret key |
   | `JWT_REFRESH_SECRET` | **Yes** | Strong 64-character refresh secret key |
   | `COOKIE_SECRET` | **Yes** | Strong 64-character cookie encryption secret |
   | `NODE_ENV` | Optional | `production` |
4. Click **Deploy**. Vercel will build both services (`api` and `web`), inject the service bindings, and route traffic accordingly.

---

## 🛠️ Included Vercel Configuration Files

1. **`vercel.json` (Root Services Config)**:
   Defines the multi-service architecture:
   - `api` (`apps/api`, Express) receives public traffic on `/api/(.*)`.
   - `web` (`apps/web`, Vite) receives public traffic on `/(.*)`.
   - Declares internal bindings (`WEB_URL` for `api`, `API_URL` for `web`).

2. **`apps/web/vercel.json`**:
   Configures Single-Page Application (SPA) rewrites for standalone frontend deployments.

---

## 📋 Checklist Before Going Live

- [x] Multi-service `vercel.json` committed to repository root with services `api` and `web`.
- [x] Inter-service bindings configured (`API_URL` in `web`, `WEB_URL` in `api`).
- [x] Backend CORS dynamically permits bound `WEB_URL`.
- [x] Backend path normalizer supports `/api/v1` and `/v1` service routing.
- [x] Frontend `vite.config.ts` dynamically proxies to bound `API_URL` in `vercel dev`.
- [x] Verified production build exits cleanly with code 0.
