# Google Search Console Setup & Domain Verification Guide
**Target Milestone:** Phase 9 Release Hardening (Launch Checklist Item #18)  
**Applicable Domain:** `transport.technofay.com` / `technofay.com`

---

## 1. Overview

Google Search Console (GSC) monitors search performance, indexation coverage, and security alerts for the Technofay Fleet Management Platform's public entry points. Because ownership verification requires external domain/DNS access, this guide provides the exact operational steps for system administrators.

---

## 2. Recommended Verification Methods

### Option A: DNS TXT Record (Recommended for Root & Subdomains)
1. Sign in to [Google Search Console](https://search.google.com/search-console).
2. Select **Domain** property type and enter `transport.technofay.com`.
3. Copy the Google verification TXT token:
   ```
   google-site-verification=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
4. Access your DNS provider (Cloudflare, Route53, GoDaddy) and add a TXT record:
   - **Type:** `TXT`
   - **Name:** `@` (or `transport`)
   - **Value:** `google-site-verification=...`
   - **TTL:** Auto or 300s
5. Return to Search Console and click **Verify**.

### Option B: HTML Meta Tag (Quick Setup)
If DNS access is restricted to corporate network ops, add the verification meta tag directly into the `<head>` of [`apps/web/index.html`](file:///c:/Users/HP/OneDrive/Desktop/technofy%20office%20work/fleet/apps/web/index.html):
```html
<meta name="google-site-verification" content="YOUR_GSC_TOKEN_HERE" />
```

---

## 3. Post-Verification Configuration Checklist

Once ownership is verified in Google Search Console:

1. **Submit XML Sitemap**:
   - Navigate to **Index** $\rightarrow$ **Sitemaps**.
   - Enter `https://transport.technofay.com/sitemap.xml`.
   - Click **Submit** and verify status indicates `Success`.

2. **Verify URL Inspection for Public Pages**:
   - Inspect `https://transport.technofay.com/`
   - Inspect `https://transport.technofay.com/contact`
   - Inspect `https://transport.technofay.com/privacy`
   - Confirm Google Smartphone crawler successfully parses Schema.org `LogisticsService` structured data.

3. **Verify Robots.txt Blocking on Private App Paths**:
   - Open Search Console **Robots.txt Tester**.
   - Test test path `/app/loads` $\rightarrow$ must report **Blocked by Disallow: /app/**.
   - Test test path `/api/v1/customers` $\rightarrow$ must report **Blocked by Disallow: /api/**.
   - Test test path `/documents/lr/sample.pdf` $\rightarrow$ must report **Blocked by Disallow: /documents/**.

---

## 4. Operator Responsibility Notice

*Per master prompt guidelines, Google Search Console ownership requires authorized production credentials and cannot be fabricated. The system is 100% pre-configured with compliant sitemap, robots.txt, canonical headers, and meta tags ready for instant verification upon production domain launch.*
