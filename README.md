# The Pupper Club

A full-stack client management platform for a premium dog walking and visit service based in Port Moody, BC. The project includes a Laravel REST API, a React web portal for both admin and client use, an Expo React Native mobile app, and a static marketing website.

---

## Architecture Overview

This is a **monorepo** with four main components:

| Component | Directory | Technology | Purpose |
|-----------|-----------|------------|---------|
| **API** | `/api` | Laravel 11, PHP 8.2 | REST API, authentication, payments, email |
| **Web Portal** | `/web` | React 18, TypeScript, Vite, TailwindCSS | Admin dashboard & client portal |
| **Mobile App** | `/mobile` | Expo SDK 51, React Native, NativeWind | Client & admin mobile experience |
| **Marketing Site** | `/site` | Static HTML, CSS, JS | Public-facing website at thepupperclub.ca (7 pages) |
| **Shared Types** | `/shared` | TypeScript | Shared interfaces between web and mobile |

```
thepupperclub.ca/
├── api/                  # Laravel 11 REST API
├── web/                  # React + Vite web portal
├── mobile/               # Expo React Native app
├── shared/               # Shared TypeScript types
├── site/                 # Static marketing website
├── .github/workflows/    # GitHub Actions (auto-deploy)
├── setup.sh              # Initial setup script
└── package.json          # Monorepo workspace root
```

---

## Technology Stack

### Backend — Laravel 11

- **PHP 8.2** with Laravel 11 framework
- **MySQL 8.0** database (hosted on GoDaddy cPanel)
- **Laravel Sanctum** for API token authentication (Bearer tokens)
- **Stripe PHP SDK** for payment processing (invoices, subscriptions, saved cards)
- **Resend** (HTTP API transport) for transactional email (GoDaddy blocks SMTP port 587)
- **DomPDF** for PDF generation (intake forms, invoices, reports)
- **Twilio** for one-way SMS notifications
- **40+ database migrations** covering users, clients, dogs, appointments, invoices, messaging, documents, templates, subscriptions, and more

#### Key API Features

- **Authentication**: Login, password reset, password change, account deletion, role-based access (admin/client/superadmin), auto-activation of pending users on login
- **Client Management**: Profiles, onboarding steps, home access codes (encrypted), secondary contacts with notification preferences, intake forms
- **Dog Management**: CRUD with full intake fields (personality, behaviour, medical, visit preferences, medications, training commands), vaccination records, documents, profile photos, size options (toy/small/medium/large/extra large)
- **Appointments**: Scheduling, check-in/complete, recurring generation, team member assignment
- **Invoicing**: Create, send, pay via Stripe, PDF export, subscription billing with pause/resume
- **Messaging**: Conversations with photo attachments, emoji reactions, reply threading, date separators
- **Report Cards**: Post-visit reports with multi-photo support, per-dog checklists/notes, customizable templates per client, branded email with dog photo
- **Document Management**: Upload PDF, Word (.doc/.docx), and images; self-hosted digital signatures with encrypted tokens; template system with visual field editor; authenticated preview via blob URL
- **Intake Forms**: 45-field intake form with branded PDF export (blue headings, black text, sentence case), Google Places address autocomplete for parent and vet addresses
- **Auto-Mileage**: Automatic driving distance calculation on appointment completion via Google Maps Distance Matrix API (home -> client1 -> client2 -> ... -> home)
- **Report Exports**: Download mileage, walk history, and billing reports as CSV or PDF
- **Team Management**: Invite members, home address with Google Places autocomplete (Canadian addresses), role management
- **Notifications**: Expo push notifications, multi-channel dispatch (app, email, SMS via Twilio), desktop/browser notifications (Web Notifications API), client notification preferences, admin email notifications
- **Broadcast System**: Gmail-style rich text editor, system and marketing templates, inline image support, "also send email" override
- **Two-Way Communication**: Chat messages dispatched to client's preferred channels, inbound email webhook for email replies, one-way SMS alerts with "Reply in app or by email" note
- **Email System**: Resend HTTP API transport (custom Guzzle-based transport since GoDaddy blocks SMTP), branded email templates with CID inline logo, editable system email templates (8 templates with token-based customization), email log tracking all sent emails
- **Error & Email Logging**: All API exceptions logged to `error_logs` table, all outbound emails tracked in `email_logs` table, viewable in admin dashboard
- **Service Request Billing**: Admin can select a Stripe product/price when approving requests (charge added to next invoice) or mark as "Included in Plan"
- **Audit Logging**: Tracks all admin actions

#### Scheduled Commands

| Command | Purpose |
|---------|---------|
| `SendPreVisitPrompts` | Sends reminders 2 hours before appointments |
| `GenerateRecurringAppointments` | Creates recurring appointment instances |
| `GenerateSubscriptionInvoices` | Monthly billing with 3-day email reminders |
| `RegenerateIntakePdfs` | One-time: regenerate all intake form PDFs with latest branded template |

#### API Routes

- **Public**: `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/webhooks/stripe`, `/webhooks/email`, `/contact`, `/signing/{token}`
- **Admin** (`/admin/*`): Full CRUD for clients, dogs, appointments, invoices, report cards, documents, notifications, audit logs, intake forms, Stripe products, team management, time/mileage reports, report exports, error logs, email logs, service requests with billing
- **Client** (`/client/*`): Profile, dogs (with full intake fields), appointments, invoices, billing/Stripe setup, report cards, documents, onboarding, intake form
- **Shared**: Conversations, messages, message reactions, photo serving, document download

### Web Portal — React 18

- **React 18** with **TypeScript** and **Vite** build tool
- **TailwindCSS** for styling
- **React Query** (`@tanstack/react-query`) for data fetching with 5-second polling for real-time updates
- **React Router v6** for client-side routing
- **Stripe React SDK** for payment UI (card management, invoice payments)
- **React Big Calendar** for appointment scheduling views
- **Google Places Autocomplete** for address fields (intake forms, team addresses)
- **Web Notifications API** for desktop/browser push notifications
- **Axios** for API communication with auth interceptors

#### Web Portal Pages (38+ pages)

**Admin Pages** (23): Dashboard (with check-in, revenue stats, email/error logs), Clients list, Client detail, Dogs list, Intake form, Calendar, Service requests (with Stripe billing on approval), Inbox, Conversation, Invoices, Invoice create, Invoice detail, Report cards, Report card form, Time & Mileage, Reports (export), Team, Documents (with upload), Template editor (with zoom controls), Broadcast messages, Email logs, Error logs, Audit logs, Settings (desktop notifications, password)

**Client Pages** (12): Dashboard (with "Add to Home Screen" instructions), Onboarding, Profile (with quick links to Dogs/Billing/Settings), Dogs (full intake-matching form with radio pills, checkbox pills, medications editor), Appointments, Messages, Invoices (with PDF preview/download), Billing (Stripe card management), Report cards, Documents (with upload), Intake form (with address autocomplete), Settings (password change, desktop notifications, notification preferences, account deletion)

**Shared**: Login, Set password, Forgot/reset password, Document signing

#### Reusable UI Components

Button, Input, Card, Badge, Modal, LoadingSpinner, MessageBubble (with emoji reactions and photo lightbox), AddressAutocomplete (Google Places, Canada-only, province dropdown), SimpleAddressInput (single-string address autocomplete), RichTextEditor (Gmail-style with inline images), ProvinceSelect (all 13 Canadian provinces/territories)

### Mobile App — Expo SDK 51

- **React Native** with **Expo SDK 51**
- **Expo Router** for file-based navigation (flat directory structure)
- **NativeWind** (TailwindCSS for React Native)
- **Expo Notifications** for push notifications
- **Expo Image Picker** for photo messaging
- **Stripe React Native** for payments

#### Mobile Screens (17 screens)

**Admin**: Dashboard, Clients, Inbox, Conversation, Reports

**Client**: Dashboard, Appointments, Dogs, Invoices, Messages, Profile, Reports

**Auth**: Login, Forgot password

### Marketing Site — Static HTML/CSS/JS

- Pure **HTML, CSS, and JavaScript** — no framework, no build step
- Hosted on GoDaddy alongside the portal, routed via `fallback.php`
- Custom domain: **thepupperclub.ca**
- Contact form wired to the Laravel API `/api/contact` endpoint
- **SEO**: Open Graph tags, canonical links, JSON-LD structured data (LocalBusiness, FAQPage, Service schemas), robots.txt, sitemap.xml
- **Legal**: Privacy Policy (BC PIPA compliant), Terms of Service (CASL compliant)
- Custom favicon (leaping dog silhouette)

#### Pages

| Page | Description |
|------|-------------|
| Home (`index.html`) | Hero, ethos section, contact form, JSON-LD LocalBusiness schema |
| Services (`services.html`) | Tabbed pricing (60min/30min), packages, testimonials, JSON-LD Service schema |
| About (`about.html`) | Founder story, Instagram feed |
| Contact (`contact.html`) | Contact form, email, phone, service area |
| FAQ (`faq.html`) | 9-item accordion, JSON-LD FAQPage schema |
| Privacy (`privacy.html`) | BC PIPA-compliant privacy policy |
| Terms (`terms.html`) | Terms of service with CASL compliance |

### Shared Types — TypeScript

The `/shared` package (`@pupper/shared`) provides TypeScript interfaces used by both the web and mobile apps:

- `api.ts` — API response/request shapes
- `appointment.ts` — Appointment types
- `billing.ts` — Invoices, subscriptions, Stripe types
- `documents.ts` — Document and signing types
- `dog.ts` — Dog profiles
- `messaging.ts` — Conversations, messages, emoji reactions
- `user.ts` — User and client profiles
- `visit.ts` — Visit reports and report cards

---

## Hosting & Deployment

### Live URLs

| URL | What |
|-----|------|
| `www.thepupperclub.ca` | Public marketing website (GitHub Pages) |
| `thepupperclub.ca` | Web portal — admin dashboard & client portal (GoDaddy) |
| `thepupperclub.ca/login` | Portal login page |
| `thepupperclub.ca/admin` | Admin dashboard |
| `thepupperclub.ca/client` | Client dashboard |
| `thepupperclub.ca/sign/:token` | Public document signing page (no auth required) |
| `thepupperclub.ca/api/` | Laravel REST API |
| `thepupperclub.ca/api/webhooks/stripe` | Stripe payment webhook |
| `thepupperclub.ca/api/webhooks/email` | Inbound email webhook (Resend) |

### Infrastructure

| Component | Host | Details |
|-----------|------|---------|
| **API + Web Portal + Marketing Site** | GoDaddy Plesk (Windows/IIS) | PHP 8.2 hosting with MySQL 8.0 |
| **Database** | GoDaddy MySQL | `pupper_club` database |
| **Email** | Resend | HTTP API transport (custom Guzzle-based, port 443) |
| **SMS** | Twilio | One-way SMS alerts |
| **Payments** | Stripe | Webhooks at `/api/webhooks/stripe` |
| **CDN / DNS** | Cloudflare | DNS management, caching, SSL |
| **Domain** | GoDaddy | `thepupperclub.ca` |
| **Source** | GitHub | `Schoquette/thepupperclub.ca` |

### Automatic Deployment — GitHub Actions CI/CD

Every push to `main` triggers an automatic deployment via GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). The workflow runs two parallel jobs:

#### Job 1: Marketing Site → GitHub Pages (`deploy-site`)

1. Checks out the repo
2. Uploads the `/site` folder as a GitHub Pages artifact
3. Deploys to GitHub Pages at `www.thepupperclub.ca`

#### Job 2: API + Web Portal → GoDaddy (`deploy-godaddy`)

This job builds everything from source in CI and deploys via FTP — nothing needs to be pre-built or committed locally.

1. **Checkout** — clones the repo
2. **Node.js setup** — installs Node 20 with npm caching
3. **Install dependencies** — runs `npm install` for the `web` and `shared` workspaces
4. **Build web portal** — runs `npx vite build` in `/web` with production environment variables:
   - `VITE_API_URL=https://thepupperclub.ca`
   - `VITE_STRIPE_KEY` (from GitHub Secrets)
   - `VITE_GOOGLE_MAPS_KEY` (from GitHub Secrets)
5. **PHP setup** — installs PHP 8.2 for Composer
6. **Install Composer dependencies** — runs `composer install --no-dev --optimize-autoloader` in `/api`, creating required storage directories first
7. **Deploy API via FTP** — uploads the entire `/api` directory (including `vendor/`) to `api/` on the server, excluding `.git`, `node_modules`, storage logs/cache/sessions/views, and `.env`
8. **Deploy web portal via FTP** — uploads the built `/web/dist/` contents to the server root (`./`)
9. **Wipe server config cache** — uses `dangerous-clean-slate` to delete `api/bootstrap/cache/` on the server, preventing stale cached config
10. **Clear Laravel caches** — hits `clear-cache` endpoint to run `config:clear`, `route:clear`, `view:clear`
11. **Purge Cloudflare cache** — purges all cached files so the new JS/CSS bundles are served immediately (prevents blank-page issues from stale HTML referencing old chunk filenames)

#### GitHub Secrets Required

The following secrets must be configured in the repo settings (**Settings > Secrets and variables > Actions**):

| Secret | Purpose |
|--------|---------|
| `FTP_SERVER` | GoDaddy FTP hostname |
| `FTP_USERNAME` | FTP username |
| `FTP_PASSWORD` | FTP password |
| `VITE_STRIPE_KEY` | Stripe publishable key (injected at build time) |
| `VITE_GOOGLE_MAPS_KEY` | Google Maps API key (injected at build time) |
| `CLOUDFLARE_ZONE_ID` | Cloudflare Zone ID (for cache purge after deploy) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Cache Purge permission |

#### What This Means for Development

Since the CI pipeline handles building and deploying:

- **You do NOT need to commit `web/dist/` or `api/vendor/`** — the CI builds these fresh each deploy
- **You do NOT need to run `npm run build` locally** before pushing (unless testing locally)
- **You do NOT need to run `composer install` locally** before pushing (unless testing locally)
- Just commit your source code changes, push to `main`, and the workflow handles the rest
- The `.env` file is **never deployed** — it is managed directly on the server via the hosting admin panel

#### Monitoring Deploys

- View deploy status at: **Actions** tab in the GitHub repo
- Each push shows both jobs with detailed logs
- Failed deploys do not affect the live site (FTP upload is atomic per-file)

#### Database Migrations

Since the server has no SSH or CLI access, database schema changes are handled via:

- **`migrate.php`** — a web-accessible migration runner (see below)
- **Temporary migration endpoints** in `api/routes/api.php` — one-off `Route::get('/fix-something-9x7k', ...)` endpoints that run raw SQL, visited once in the browser, then removed

### Database Management — `migrate.php`

A web-accessible migration runner at `https://thepupperclub.ca/migrate.php?key=SECRET`:

| Parameter | Action |
|-----------|--------|
| (none) | Run pending migrations + seed |
| `?fresh=1` | Drop all tables, re-migrate, seed with test data (4 clients, 6 dogs) |
| `?clean=1` | Drop all tables, re-migrate, create admin user only (clean slate) |

Shows diagnostics (storage permissions, PHP version, DB connection) and data counts after completion.

> **Note**: The API's `.env` file must be configured directly on the server.

---

## Database Schema

Migrations covering:

- **Users & Auth** — users table with roles (admin, client, superadmin), Sanctum tokens, home address fields for team members
- **Client Profiles** — extended client info, subscription fields (with pause/resume), secondary contact (name, email, notification preferences), billing method (interac_pad enum), notification preferences (app/email/SMS)
- **Home Access** — encrypted access codes for client homes
- **Dogs** — breed, age, size (toy/small/medium/large/extra_large/xl), colour, microchip, spayed/neutered, personality (energy level, interactions with dogs/strangers/children, triggers), medical (conditions, allergies, medications as JSON, mobility limitations, recent surgeries), visit preferences (walk style, gear, treats, training commands, avoid list), profile photos, vaccination records, bite history, admin tags (off-leash approved, media consent, buddy walks OK)
- **Appointments** — scheduling with check-in/complete timestamps, recurring support, team member assignment
- **Service Requests** — client-submitted requests for schedule changes, time extensions, and special services (editable/cancellable while pending)
- **Visit Reports** — post-visit report cards with multi-photo support, per-dog data (checklists/notes as JSON)
- **Report Card Templates** — customizable checklist templates per client
- **Invoices** — line items, Stripe payment intents, PDF generation, invoice numbers (`PC-YYYY-NNNN`)
- **Conversations & Messages** — threaded messaging with photo attachments, emoji reactions, reply threading (`reply_to_id`), notification type messages
- **Documents** — client documents with digital signature support, templates with visual field editor
- **Document Templates** — PDF templates with positioned form fields (name, checkbox, date, signature, dog_name, open_text)
- **System Email Templates** — admin-customizable email overrides with token support
- **Onboarding Steps** — multi-step client onboarding flow
- **Error Logs** — API exception tracking (type, message, context, URL, user)
- **Email Logs** — all outbound emails tracked (to, subject, status, Resend ID, errors)
- **Audit Logs** — admin action tracking
- **Push Notifications** — Expo push notification records

> **Note**: Many columns are auto-created by controllers on first use via `Schema::hasColumn()` checks, so the app works even without running all migrations.

---

## Brand

| Element | Value |
|---------|-------|
| Cream | `#F6F3EE` |
| Espresso | `#3B2F2A` |
| Taupe | `#C8BFB6` |
| Gold | `#C9A24D` |
| Blue | `#6492D8` |
| Display Font | Playfair Display (headings) |
| Body Font | Lato (body text) |

---

## Setup

### Prerequisites

- PHP 8.2+ with Composer
- Node.js 20+ with npm
- MySQL 8.0
- Expo CLI (for mobile development)

### Installation

```bash
# Clone the repo
git clone https://github.com/Schoquette/thepupperclub.ca.git
cd thepupperclub.ca

# Run the setup script
chmod +x setup.sh
./setup.sh

# Configure environment
# Edit api/.env with your database credentials, Stripe keys, Google Maps key, and Resend API key
# Edit web/.env with your API URL, Stripe publishable key, and Google Maps key

# Run database migrations
cd api
php artisan migrate

# Seed admin user
php artisan db:seed

# Start the API
php artisan serve

# Start the web portal (in a new terminal)
cd ../web
npm run dev

# Start the mobile app (in a new terminal)
cd ../mobile
npm install
npx expo install expo-image-picker
npx expo start
```

### Environment Variables

**API (`api/.env`):**

| Variable | Description |
|----------|-------------|
| `DB_*` | MySQL connection |
| `STRIPE_SECRET` | Stripe secret key (`sk_test_` or `sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key (enable Distance Matrix, Places, Maps JavaScript APIs) |
| `MAIL_MAILER` | `resend` (uses custom HTTP transport via Guzzle) |
| `RESEND_API_KEY` | Resend API key (also read from `MAIL_PASSWORD` as fallback) |
| `MAIL_FROM_ADDRESS` | `hello@thepupperclub.ca` (requires domain verification in Resend) |
| `APP_TIMEZONE` | `America/Vancouver` |
| `SANCTUM_STATEFUL_DOMAINS` | Allowed frontend domains |
| `FRONTEND_URL` | Web portal URL (e.g., `https://thepupperclub.ca`) |
| `TWILIO_SID` | Twilio account SID (for SMS) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Twilio phone number |
| `RESEND_INBOUND_ADDRESS` | `reply@thepupperclub.ca` (for two-way email) |

**Web (`web/.env`):**

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL (e.g., `http://localhost:8000`) |
| `VITE_STRIPE_KEY` | Stripe publishable key (must match backend's secret key mode — both test or both live) |
| `VITE_GOOGLE_MAPS_KEY` | Google Maps API key (for Places address autocomplete) |

> **Stripe key mismatch warning**: `pk_live_` and `sk_test_` keys do not pair. Both must be the same mode (test or live) for payments to work.

### Post-Setup Steps

1. **Google Maps**: Get an API key from [Google Cloud Console](https://console.cloud.google.com/) and enable **Distance Matrix API**, **Places API**, and **Maps JavaScript API**
2. **Team addresses**: Set each team member's home address on the Team page (Admin -> Team) — required for automatic mileage calculation
3. **Resend**: Verify `thepupperclub.ca` domain in Resend dashboard before sending from `hello@thepupperclub.ca`
4. **Stripe webhook**: Register `https://thepupperclub.ca/api/webhooks/stripe` in Stripe dashboard
5. **Resend inbound email**: Set up inbound webhook URL to `https://thepupperclub.ca/api/webhooks/email` for two-way email replies
6. **Twilio**: Create account, get phone number, add credentials to `.env` for SMS notifications
7. **Cloudflare**: Add `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` to GitHub Secrets for automatic cache purging on deploy

### Auto-Mileage

When an appointment is completed (check-out), the system automatically calculates driving distance via Google Maps Distance Matrix API:

- **First appointment of the day**: team member's home -> client's address
- **Middle appointments**: previous client's address -> current client's address
- **Last appointment of the day**: includes return trip to team member's home
- If another appointment is completed later, mileage for the entire day is recalculated

Requires `GOOGLE_MAPS_API_KEY` in `api/.env` and team member home addresses set on the Team page.

### Default Admin Account

- **Email**: sophie@thepupperclub.ca
- **Password**: changeme123

---

## Monorepo Structure

The project uses npm workspaces defined in the root `package.json`:

```json
{
  "workspaces": ["web", "mobile", "shared"]
}
```

Run commands from root:
- `npm run web` — Start web dev server
- `npm run mobile` — Start Expo dev server
- `npm run build:web` — Build web for production
