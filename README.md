# SK Contact Form Builder — Shopify App

A complete, production-ready Shopify embedded app for building, managing, and embedding custom contact forms on your storefront.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Project Structure](#project-structure)
5. [Step 1 — Shopify Partner Dashboard Setup](#step-1--shopify-partner-dashboard-setup)
6. [Step 2 — Clone & Install Dependencies](#step-2--clone--install-dependencies)
7. [Step 3 — Configure Environment Variables](#step-3--configure-environment-variables)
8. [Step 4 — Push Database Schema](#step-4--push-database-schema)
9. [Step 5 — Run in Development](#step-5--run-in-development)
10. [Step 6 — Install App on Your Shopify Store](#step-6--install-app-on-your-shopify-store)
11. [Step 7 — Create Your First Form](#step-7--create-your-first-form)
12. [Step 8 — Embed Form on Storefront](#step-8--embed-form-on-storefront)
13. [Step 9 — Production Deployment (AWS / VPS)](#step-9--production-deployment-aws--vps)
14. [API Reference](#api-reference)
15. [Shared Database Architecture](#shared-database-architecture)
16. [Troubleshooting](#troubleshooting)

---

## Features

| Feature | Description |
|---|---|
| 📋 Form Builder | Create forms with 11 field types via a visual builder |
| 📬 Submission Inbox | View, filter, mark-read, and delete submissions |
| 📧 Email Notifications | Get notified on new submissions (Resend / SendGrid / SMTP) |
| ✉️ Confirmation Email | Automatically email the submitter a confirmation |
| 🛡 Anti-Spam | Honeypot field stops bots silently |
| 📊 Analytics | Dashboard with total forms, submissions, today & monthly counts |
| 🎨 Customization | Per-form colors, styles (default / minimal / card) |
| 🔗 Embed Anywhere | Iframe embed on any page via Liquid snippet or direct URL |
| 📱 Responsive | Mobile-first form rendering |
| 🗄 PostgreSQL | Shared AWS PostgreSQL database (same as other apps) |

### Supported Field Types
- Text, Email, Phone, Number, Date
- Textarea, Select (Dropdown), Radio, Checkbox
- File Upload, Hidden

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database ORM | Prisma |
| Database | PostgreSQL (shared AWS instance) |
| Email | Resend / SendGrid / Console |
| Auth | Shopify OAuth 2.0 + HMAC session cookie |
| Port | 10001 (separate from loginregister-app on 10000) |

---

## Prerequisites

Before you start, make sure you have:

- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] Access to the shared AWS PostgreSQL database (`DATABASE_URL`)
- [ ] A [Shopify Partner account](https://partners.shopify.com)
- [ ] A Shopify development store for testing
- [ ] (Optional) Resend or SendGrid account for email notifications

---

## Project Structure

```
contactform/
├── prisma/
│   └── schema.prisma              ← Database models for ContactForm app
├── src/
│   ├── app/
│   │   ├── layout.tsx             ← Root HTML layout
│   │   ├── page.tsx               ← Redirects to /install
│   │   ├── globals.css            ← Tailwind base styles
│   │   ├── install/
│   │   │   └── page.tsx           ← App install entry page
│   │   ├── admin/
│   │   │   └── page.tsx           ← Full admin dashboard
│   │   ├── embed/
│   │   │   └── page.tsx           ← Storefront-embeddable form page
│   │   └── api/
│   │       ├── shopify/auth/      ← OAuth start endpoint
│   │       ├── shopify/callback/  ← OAuth callback + shop upsert
│   │       ├── forms/             ← CRUD for contact forms
│   │       ├── submissions/       ← CRUD for form submissions
│   │       ├── settings/          ← App settings (email provider)
│   │       └── health/            ← Database health check
│   └── lib/
│       ├── prisma.ts              ← Prisma client singleton
│       ├── shopify-oauth.ts       ← OAuth helpers (buildAuthUrl, verify, etc.)
│       ├── session.ts             ← HMAC-signed session cookie helpers
│       ├── email.ts               ← Email provider abstraction
│       ├── hmac.ts                ← SHA-256 HMAC signer
│       └── crypto.ts              ← Random token generator
├── seopal_theme/
│   └── snippets/
│       └── contact-form-embed.liquid  ← Shopify theme integration snippet
├── .env                           ← Local environment variables (not committed)
├── .env.example                   ← Environment variable template
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Step 1 — Shopify Partner Dashboard Setup

### 1.1 Create a New App

1. Go to [https://partners.shopify.com](https://partners.shopify.com)
2. Click **Apps** → **Create app** → **Create app manually**
3. Enter app name: `SK Contact Form Builder`
4. Click **Create**

### 1.2 Get API Credentials

On the app overview page, note down:
- **Client ID** → this is your `SHOPIFY_API_KEY`
- **Client secret** → this is your `SHOPIFY_API_SECRET`

### 1.3 Configure App URLs

In **App setup**, set these URLs (use your deployed URL in production or `ngrok` URL in dev):

| Setting | Value |
|---|---|
| App URL | `https://your-app.com/admin` |
| Allowed redirection URL(s) | `https://your-app.com/api/shopify/callback` |

For local development with ngrok:
```
App URL:             https://abc123.ngrok.io/admin
Allowed redirects:   https://abc123.ngrok.io/api/shopify/callback
```

### 1.4 Set Required Scopes

In **API access**, request these scopes:
```
read_products
write_script_tags
write_themes
```

> ℹ️ You can add more scopes as needed. For embedding forms only, `write_themes` is optional.

---

## Step 2 — Clone & Install Dependencies

```bash
# Navigate to the contactform directory
cd THEME_CUTOM_01/contactform

# Install Node.js dependencies
npm install
```

This will also run `prisma generate` automatically via the `postinstall` script.

---

## Step 3 — Configure Environment Variables

### 3.1 Copy the example file

```bash
cp .env.example .env
```

### 3.2 Fill in the values

Open `.env` and set each variable:

```env
# ── Database ─────────────────────────────────────────────────────
# Use the same shared AWS PostgreSQL database as the other apps
DATABASE_URL=postgresql://YOUR_DB_USER:YOUR_DB_PASS@YOUR_AWS_HOST:5432/YOUR_DB_NAME

# ── App Host ──────────────────────────────────────────────────────
# Local dev:
HOST=http://localhost:10001
NEXT_PUBLIC_HOST=http://localhost:10001

# Production:
# HOST=https://your-contactform-app.com
# NEXT_PUBLIC_HOST=https://your-contactform-app.com

# ── Shopify OAuth ─────────────────────────────────────────────────
SHOPIFY_API_KEY=your_client_id_from_partner_dashboard
SHOPIFY_API_SECRET=your_client_secret_from_partner_dashboard
SHOPIFY_SCOPES=read_products,write_script_tags,write_themes

# ── Security ──────────────────────────────────────────────────────
JWT_SECRET=generate_a_random_64_char_hex_string
NEXTAUTH_SECRET=generate_another_random_secret

# ── Email Provider ────────────────────────────────────────────────
# Options: console (dev), resend, sendgrid
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@yourstore.com

# Resend (https://resend.com)
RESEND_API_KEY=re_your_resend_api_key

# SendGrid (https://sendgrid.com) — leave blank if using Resend
SENDGRID_API_KEY=

# ── Server ────────────────────────────────────────────────────────
NODE_ENV=development
PORT=10001
```

### 3.3 Generate secure secrets

Use this command to generate `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4 — Push Database Schema

This command creates the ContactForm app tables in your shared PostgreSQL database. It will not affect or drop any existing tables from other apps.

```bash
npx prisma db push
```

Expected output:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your Prisma schema
```

New tables created:
- `ContactForm`
- `ContactFormField`
- `ContactFormSubmission`
- `ContactFormSettings`

> ⚠️ The `Shop` model in this schema is a **subset** of the shared unified schema.  
> If the `Shop` table already exists (from loginregister-app or other apps), Prisma will **not** recreate it — it only adds the new ContactForm-related tables and columns.

---

## Step 5 — Run in Development

### 5.1 Start the dev server

```bash
npm run dev
```

The app runs on **port 10001** (different from loginregister-app on 10000).

```
  ▲ Next.js 14.x
  - Local:        http://localhost:10001
  - API Routes:   http://localhost:10001/api/*
```

### 5.2 (Optional) Use ngrok for HTTPS tunnel

Shopify requires HTTPS for OAuth. Use ngrok to expose your local server:

```bash
# Install ngrok (https://ngrok.com)
ngrok http 10001
```

Copy the `https://xxxx.ngrok.io` URL and update:
1. Your `.env` → `HOST` and `NEXT_PUBLIC_HOST`
2. Shopify Partner Dashboard → **App URL** and **Allowed redirection URLs**

---

## Step 6 — Install App on Your Shopify Store

### Option A — Via Install Page

1. Open: `http://localhost:10001/install` (or your ngrok URL)
2. Enter your store domain: `your-store.myshopify.com`
3. Click **Install App**
4. You'll be redirected to Shopify OAuth consent screen
5. Click **Install** to authorize
6. You'll be redirected to the admin dashboard

### Option B — Via Direct URL

```
https://your-app.com/api/shopify/auth?shop=your-store.myshopify.com
```

### Option C — From Shopify Partner Dashboard

1. In Partner Dashboard → your app → **Test on development store**
2. Select your development store
3. Click **Install**

---

## Step 7 — Create Your First Form

After installing the app, you'll see the admin dashboard at `/admin?shop=your-store.myshopify.com`.

### 7.1 Create a form

1. Click **Forms** in the sidebar → **+ Create Form**
2. Fill in:
   - **Form Title** (e.g., "Contact Us")
   - **Recipient Email** (where submissions are sent)
   - **Success Message** (shown after successful submission)
3. Add fields by clicking field types on the left panel:
   - **Your Name** (text, required)
   - **Email** (email, required)
   - **Message** (textarea, required)
4. Click **Save Form**

### 7.2 Configure notifications

In Form Settings:
- ✅ Enable **Email Notifications** → sends each submission to your recipient email
- ✅ Enable **Confirmation Email** → sends a thank-you email to the submitter (requires an email field)

### 7.3 Copy the Embed URL

After saving the form, copy the **Embed URL** shown on the form card:
```
https://your-app.com/embed?shop=your-store.myshopify.com&formId=clxxxxx
```

---

## Step 8 — Embed Form on Storefront

### Option A — Using the Liquid Snippet (Recommended)

1. Copy `seopal_theme/snippets/contact-form-embed.liquid` to your Shopify theme's `snippets/` folder

2. Update the `cf_app_host` variable at the top of the snippet:
   ```liquid
   {%- assign cf_app_host = 'https://your-contactform-app.com' -%}
   ```

3. In any template, section, or page, render the snippet:
   ```liquid
   {% render 'contact-form-embed', form_id: 'YOUR_FORM_ID_HERE' %}
   ```
   Replace `YOUR_FORM_ID_HERE` with the actual form ID from the admin.

### Option B — Direct iframe Embed

Paste this HTML anywhere on your store (page, section, block):
```html
<iframe
  src="https://your-app.com/embed?shop=your-store.myshopify.com&formId=YOUR_FORM_ID"
  frameborder="0"
  scrolling="no"
  style="width:100%;border:none;min-height:400px;"
  title="Contact Form"
></iframe>
<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'cf_resize') {
      var iframes = document.querySelectorAll('iframe[src*="cf_embed"]');
      iframes.forEach(function(f) {
        f.style.height = e.data.height + 'px';
      });
    }
  });
</script>
```

### Option C — Shopify Theme Editor (App Block)

If you want a drag-and-drop App Block in the Theme Editor, you'd need to add a `blocks/contact-form.liquid` file and register it in the app's extension. This is an optional advanced step — the iframe approach above works for all themes.

---

## Step 9 — Production Deployment (AWS / VPS)

### 9.1 Build the app

```bash
npm run build
```

### 9.2 Start in production mode

```bash
npm start
# or with PM2 (recommended):
pm2 start npm --name "contactform-app" -- start
pm2 save
```

### 9.3 Environment for production

Update `.env` for production:
```env
NODE_ENV=production
HOST=https://your-contactform-app.com
NEXT_PUBLIC_HOST=https://your-contactform-app.com
DATABASE_URL=postgresql://USER:PASS@your-aws-rds-host:5432/shopify_reviews
```

### 9.4 Nginx reverse proxy (recommended)

```nginx
server {
    listen 80;
    server_name your-contactform-app.com;

    location / {
        proxy_pass http://localhost:10001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then add SSL:
```bash
certbot --nginx -d your-contactform-app.com
```

### 9.5 Docker (optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 10001
CMD ["npm", "start"]
```

---

## API Reference

### Forms

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/forms?shop=...` | List all forms + stats |
| `GET` | `/api/forms?shop=...&formId=...` | Get single form with fields |
| `POST` | `/api/forms` | Create a new form |
| `PUT` | `/api/forms` | Update a form |
| `DELETE` | `/api/forms` | Delete a form |

### Submissions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/submissions?shop=...` | List submissions (paginated) |
| `POST` | `/api/submissions` | Submit a form (from embed) |
| `PATCH` | `/api/submissions` | Mark read / update status |
| `DELETE` | `/api/submissions` | Delete submission(s) |

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/settings` | Save app settings |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Database connectivity check |

---

## Shared Database Architecture

All Shopify apps (COD Restrictions, Store Locator, Review, LoginRegister, **ContactForm**) share the **same PostgreSQL database** and the same `Shop` table.

```
PostgreSQL (AWS)
├── Shop                      ← Shared by ALL apps
├── ContactForm               ← This app
├── ContactFormField          ← This app
├── ContactFormSubmission     ← This app
├── ContactFormSettings       ← This app
├── Customer                  ← LoginRegister app
├── CodSettings               ← COD Restrictions app
├── StoreLocation             ← Store Locator app
├── Review                    ← Review app
└── ...
```

Each app uses the `Shop` table (via `shopifyDomain` as the unique key) and relates its own models to it. Running `prisma db push` from any app only adds that app's missing tables — it never drops existing ones.

---

## Troubleshooting

### ❌ "Can't reach database server"
- Make sure your AWS PostgreSQL security group allows inbound connections on port 5432 from your IP
- Verify the `DATABASE_URL` is correct (host, port, user, password, database name)

### ❌ "Shop not found" error on form submission
- The store must be installed (OAuth complete) before submissions can be received
- Check that the `shop` query param in the embed URL matches the installed store domain exactly

### ❌ OAuth redirect mismatch
- The redirect URL in Shopify Partner Dashboard must exactly match `HOST/api/shopify/callback`
- For ngrok: update both `.env` HOST and Partner Dashboard when ngrok URL changes

### ❌ Emails not being sent
- Set `EMAIL_PROVIDER=console` to log emails to terminal during development
- For Resend: verify your domain at [resend.com](https://resend.com) and use a verified sender email
- For SendGrid: verify sender identity in the SendGrid dashboard

### ❌ "Invalid HMAC" on OAuth callback
- The `SHOPIFY_API_SECRET` in `.env` must match exactly what's in the Partner Dashboard
- Make sure there are no extra spaces or newlines in the secret

### ❌ Form not showing in iframe
- Check that the app is running and reachable at the embed URL
- Confirm the `formId` is correct and the form is **Published** and **Active**
- Check browser console for CORS or mixed-content errors

### Useful Commands

```bash
# View database in browser
npx prisma studio

# Regenerate Prisma client after schema changes
npx prisma generate

# Sync schema to database
npx prisma db push

# Check health
curl http://localhost:10001/api/health

# View PM2 logs
pm2 logs contactform-app
```

---

## Security Notes

- Never commit `.env` to git (it's in `.gitignore`)
- Rotate `JWT_SECRET` and `NEXTAUTH_SECRET` if compromised
- The honeypot field silently discards bot submissions without returning an error
- All Shopify webhook HMAC signatures are verified before processing
- Admin routes use HMAC-signed session cookies (`cf_session`)

---

## License

Private — All Rights Reserved.  
Built for Shopify Partner ecosystem.
# SHOPIFY_FORMBUILDER_2026
