# The Pupper Club

A full-stack platform serving two distinct products on one domain:

- **The Pupper Club** — a premium dog walking and visit service based in Port Moody, BC, with a Laravel REST API, a React admin + client portal, an Expo React Native mobile app, and a static marketing website.
- **The Pupper Club Community** — a small, trusted neighbourhood network for shared pet care. Anonymous browse, paid ID verification, connections, broadcasts, messaging, and recommendations. Ships as both a Tauri 2 desktop app and a web SPA hosted at `thepupperclub.ca/community/app/`.

---

## Architecture Overview

This is a **monorepo** with five main components:

| Component | Directory | Technology | Purpose |
|-----------|-----------|------------|---------|
| **API** | `/api` | Laravel 11, PHP 8.2 | REST API for both products: paid service + Community |
| **Web Portal** | `/web` | React 18, TypeScript, Vite, TailwindCSS | Paid-service admin dashboard & client portal |
| **Mobile App** | `/mobile` | Expo SDK 51, React Native, NativeWind | Paid-service client & admin mobile experience |
| **Community App** | `/community` | Tauri 2 + React 18 + Vite + TailwindCSS | Community member desktop app (and matching web SPA) |
| **Marketing Site** | `/site` | Static HTML, CSS, JS | Public-facing website at thepupperclub.ca (9 pages incl. community landing + hidden prospect one-pager) |
| **Shared Types** | `/shared` | TypeScript | Shared interfaces between web and mobile |

```
thepupperclub.ca/
├── api/                  # Laravel 11 REST API (both products)
├── web/                  # React + Vite paid-service portal
├── mobile/               # Expo React Native app
├── community/            # Tauri 2 + React Community app (web build deployed to /community/app/)
├── shared/               # Shared TypeScript types
├── site/                 # Static marketing website
├── .github/workflows/    # GitHub Actions (auto-deploy, 3 FTP steps)
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
- **Document Management**: Upload PDF, Word (.doc/.docx), and images; self-hosted digital signatures (DocuSign-style full-screen signing experience) with encrypted tokens; template system with visual field editor (drag-to-position, corner resize handles, client/company recipient roles); counter-signing workflow (client signs -> admin counter-signs -> fully executed certificate); authenticated preview via blob URL
- **Intake Forms**: 45-field intake form with branded PDF export (blue headings, black text, sentence case), Google Places address autocomplete for parent and vet addresses
- **Auto-Mileage**: Automatic driving distance calculation on appointment completion via Google Maps Distance Matrix API (home -> client1 -> client2 -> ... -> home)
- **Report Exports**: Download mileage, walk history, and billing reports as CSV or PDF
- **Team Management**: Invite members, home address with Google Places autocomplete (Canadian addresses), role management
- **Notifications**: Expo push notifications, multi-channel dispatch (app, email, SMS via Twilio), desktop/browser notifications (Web Notifications API), client notification preferences (app/email/SMS on `client_profiles`), admin notification preferences (app/email/SMS on `users` table), message notification emails include "Reply in Portal" button and reply-to address for two-way email
- **Broadcast System**: Gmail-style rich text editor, system and marketing templates, inline image support, "also send email" override
- **Two-Way Communication**: Chat messages dispatched to client's preferred channels, inbound email webhook for email replies, one-way SMS alerts with "Reply in app or by email" note
- **Email System**: Resend HTTP API transport (custom Guzzle-based transport since GoDaddy blocks SMTP), branded email templates with CID inline logo, editable system email templates (8 templates with token-based customization), email log tracking all sent emails
- **Error & Email Logging**: All API exceptions logged to `error_logs` table, all outbound emails tracked in `email_logs` table, viewable in admin dashboard
- **Service Request Billing**: Admin marks requests as "Included in Plan" or assigns an extra charge on approval. Charges appear as unbilled add-ons on the client's billing tab; admin manually selects add-ons via checkboxes and adds them to an existing invoice or creates a new one
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
- **Admin** (`/admin/*`): Full CRUD for clients, dogs, appointments, invoices, report cards, documents, notifications, audit logs, intake forms, Stripe products, team management, time/mileage reports, report exports, error logs, email logs, service requests with billing, client billing summary (add-ons, invoices), add line items to existing invoices
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

**Admin Pages** (23): Dashboard (with check-in, revenue stats, email/error logs), Clients list, Client detail (with tabs: Overview, Dogs, Appointments, Billing, Documents — billing tab shows subscription info, open/overdue invoices, unbilled add-ons with checkboxes for batch invoicing, invoice history), Dogs list (with search, status tabs, client/breed filters), Intake form, Calendar, Service requests (clickable rows with detail/review modals), Inbox, Conversation, Invoices (with client, month, and status filters), Invoice create (pre-selects client from query param), Invoice detail, Report cards, Report card form, Time & Mileage, Reports (export), Team, Documents (with upload), Template editor (react-pdf per-page rendering, drag-to-position fields, corner resize handles, client/company recipient roles, role-based color coding), Broadcast messages, Email logs, Error logs, Audit logs, Settings (notification preferences for app/email/SMS, desktop notifications, password)

**Client Pages** (12): Dashboard (with "Add to Home Screen" instructions for Safari, Chrome iOS, and Android), Onboarding, Profile (with quick links to Dogs/Billing/Settings), Dogs (full intake-matching form with radio pills, checkbox pills, medications editor), Appointments, Messages, Invoices (with PDF preview/download), Billing (Stripe card management), Report cards, Documents (with upload), Intake form (with address autocomplete), Settings (password change, desktop notifications, notification preferences, account deletion)

**Shared**: Login, Set password, Forgot/reset password, Document signing (DocuSign-style full-screen, counter-sign support)

#### PWA Support

The web portal includes Progressive Web App features for a native-like home screen experience:

- **Web manifest** (`web/public/manifest.json`) with app name, theme color (#3B2F2A), and icons (192x192, 512x512)
- **Apple touch icon** (`web/public/apple-touch-icon.png`) — 180x180 with full logo on cream background
- **Favicon** — leaping dog silhouette (`web/public/images/favicon-32.png`, `favicon-16.png`)
- Dashboard includes instructions for adding to home screen on Safari, Chrome (iOS), and Android

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

### Community App — Tauri 2 + React 18

A separate product from the paid service. Members are stored in their own `community_members` table (not `users`), authenticate with their own bearer tokens, and never cross-reference paid-service identities.

- **Tauri 2** desktop shell (macOS + Windows) plus an identical **web SPA** at `thepupperclub.ca/community/app/`
- **React 18 + Vite + TypeScript + TailwindCSS** (Just Blue accent — Gold is reserved for the paid service)
- **Playfair Display SC / Playfair Display / Lato** matching the marketing brand
- Same Vite codebase emits both bundles; `WEB_DEPLOY=1` flips `base` to `/community/app/`
- **`axios`** with PATCH/PUT/DELETE → POST `_method` spoofing (Plesk/IIS strips bodies on those verbs)
- **`react-easy-crop`** powers the member + pet photo cropper (pan, zoom, rotate, square PNG output)
- Routes in React Router behind a `RequireAuth` wrapper; `BrowserRouter` basename comes from `import.meta.env.BASE_URL`

#### Backend (under `/api/community/*`)

- **Members** — separate `community_members` table with `pending_verification` / `verified` / `suspended` / `closed` status, `paused_at`, `notification_prefs`, `referral_code`, `referred_by_member_id`, soft-delete
- **Verification** — Stripe Identity (document + selfie) **gated on a $5 one-time fee** via Stripe Checkout. Two webhooks: `stripe-identity` for `identity.verification_session.*`, `community-checkout` for `checkout.session.completed`. Promo codes enabled (e.g. `THEGOODEST` for 100% off).
- **Geohash-based proximity** — addresses geocoded to a 6-char geohash (~±0.6km cell) and discarded. Distance shown only as a bucketed label (`About 2 km away`).
- **Connections** — `requester_id` / `recipient_id` edges with `pending` / `accepted` / `declined` / `removed` states. Names + photos unlock only on accepted; pending requests stay anonymous in both directions.
- **Pets** — multi-pet, species-aware (dog / cat / other). Connection-gated photo serving (`/community/pets/{id}/photo`).
- **Broadcasts** — small group asks for help, recipients confirm/decline.
- **Messaging** — 1:1 conversations between accepted connections, light polling.
- **Recommendations** — written notes only, no ratings. Subject can hide them from their own profile.
- **Safety** — `community_blocks` (silent, two-way) and `community_reports` (private flow).
- **Invites** — direct email invites + a per-member referral link (`/community/app/sign-up?invited_by=CODE`). Joining via a link does NOT auto-connect.
- **Donations** — Stripe Checkout `submit_type=donate` for one-off "Say Thanks!" contributions ($1–$1,000 CAD).
- **Support / Contact Us** — branded HTML email to `sophie@thepupperclub.ca` with member as Reply-To.
- **Account self-service** — pause/resume, change password (rotates bearer token), update notification prefs, delete account.

#### Community pages (web + desktop, ~15 screens)

Welcome, Sign In, Sign Up (with `?invited_by=`), Home, Profile Setup (intro, pets, member photo with cropper, Google Places address with autocomplete-confirmed "Selected" pill, 6 radius presets: 1km / 5km / 15km / 25km / 50km / 200km), Discover (anonymous browse + verify-gate modal), Member Profile (anonymous vs full view branching), My Network (incoming / outgoing / accepted + invite section), Broadcasts, Messages, Conversation, Verify (two-step paid + Identity), Settings (notifications / pause / password / delete), Contact Us (topic-based), Donate ("Say Thanks!"), Blocked Members.

#### Branded emails

`App\Services\CommunityMailer` wraps every outbound Community email in `resources/views/emails/notification.blade.php` → `emails/layout.blade.php` (the same Blade template the paid service uses). Inline CID logo, Reply-To routing, Resend transport. Used by Contact Us and Invite emails; ready for connection requests / broadcast notifications / donation receipts as those features mature.

#### Shared infrastructure

The Community app uses the same React Router shell, but every screen passes through a `PageShell` that renders the marketing-site-style nav (espresso wordmark logo linked to `/home`, blue underline on hover, sticky header) and footer (brand blurb, Port Moody, Contact us button to `/contact`, "Say Thanks!" button to `/donate`, copyright + Privacy + Terms). Mobile burger included.

### Marketing Site — Static HTML/CSS/JS

- Pure **HTML, CSS, and JavaScript** — no framework, no build step
- Hosted on GoDaddy alongside the portal, routed via `fallback.php`
- Custom domain: **thepupperclub.ca**
- Contact form wired to the Laravel API `/api/contact` endpoint
- **SEO**: Open Graph tags, canonical links, JSON-LD structured data (LocalBusiness, FAQPage, Service schemas), robots.txt, sitemap.xml
- **Legal**: Privacy Policy (BC PIPA compliant), Terms of Service (CASL compliant)
- Custom favicon (leaping dog silhouette on cream background)

#### Pages

| Page | Description |
|------|-------------|
| Home (`index.html`) | Hero, ethos section, contact form, JSON-LD LocalBusiness schema |
| Services (`services.html`) | Four pricing tabs — Custom Visits 60 min / Custom Visits 30 min / Midday Pack Walks / **Appointment Transportation**. Each subscription tab has Essential / Signature / Premier / 10-Pack cards. Transportation tab pairs marketing copy with a **live fare calculator** (Google Places autocomplete on both address fields → `POST /api/transport-quote` → server-side Distance Matrix → $30 base + $1/km past 5 km, doubled for return trips). Includes a "Custom & Casual" blue callout section linking to /contact for off-menu plans, plus the existing JSON-LD Service schema. |
| About (`about.html`) | Founder story, Instagram feed |
| Contact (`contact.html`) | Contact form, email, phone, service area |
| FAQ (`faq.html`) | 9-item accordion, JSON-LD FAQPage schema |
| Privacy (`privacy.html`) | BC PIPA-compliant privacy policy |
| Terms (`terms.html`) | Terms of service with CASL compliance |
| Community landing (`community/index.html`) | Marketing page for the Community sub-brand with waitlist + early-access CTA |
| **Hidden** — Prospect one-pager (`the411.html`) | Shareable digital one-pager for prospects. Not linked from nav, not in sitemap, `robots noindex,nofollow`, `Disallow: /the411.html` in robots.txt. Used by Sophie to introduce the service one-on-one. |

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
| `thepupperclub.ca` | Public marketing website + paid-service portal (GoDaddy IIS) |
| `thepupperclub.ca/login` | Portal login page |
| `thepupperclub.ca/admin` | Admin dashboard |
| `thepupperclub.ca/client` | Client dashboard |
| `thepupperclub.ca/sign/:token` | Public document signing page (no auth required) |
| `thepupperclub.ca/the411.html` | Hidden prospect one-pager (share one-on-one; noindex) |
| `thepupperclub.ca/community` | Marketing landing for the Community sub-brand |
| `thepupperclub.ca/community/app/` | Community web SPA (sign-in for the Community product) |
| `thepupperclub.ca/api/` | Laravel REST API (paid service + Community) |
| `thepupperclub.ca/api/transport-quote` | Public `POST` endpoint — computes transportation fare for the Services page calculator |
| `thepupperclub.ca/api/maps-key` | Public `GET` endpoint — returns the Google Maps browser key so static marketing pages can attach Places Autocomplete without committing the key to source |
| `thepupperclub.ca/api/webhooks/stripe` | Stripe paid-service webhook |
| `thepupperclub.ca/api/webhooks/stripe-identity` | Stripe Identity webhook (Community ID verification) |
| `thepupperclub.ca/api/webhooks/community-checkout` | Stripe Checkout webhook for Community $5 verification fee + donations |
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

Every push to `main` triggers an automatic deployment via GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Everything (API, Web Portal, Community web build, Marketing Site) deploys to **one GoDaddy host** via FTP — there is no longer a GitHub Pages step (the marketing site moved to GoDaddy when the Community sub-brand launched so all three products share the same domain).

The workflow:

1. **Checkout** — clones the repo
2. **Node.js setup** — installs Node 20 with npm caching
3. **Install dependencies** — runs `npm install --workspace=web --workspace=shared --workspace=community`
4. **Build web portal** — `cd web && npx vite build` with `VITE_API_URL`, `VITE_STRIPE_KEY`, `VITE_GOOGLE_MAPS_KEY`
5. **Build Community app** — `cd community && WEB_DEPLOY=1 npx vite build` with `VITE_API_URL`, `VITE_GOOGLE_MAPS_KEY`. The `WEB_DEPLOY=1` flag flips Vite's `base` to `/community/app/` so asset URLs line up with the deploy subpath.
6. **PHP setup** — installs PHP 8.2 for Composer
7. **Install Composer dependencies** — runs `composer install --no-dev --optimize-autoloader` in `/api`, creating required storage directories first
8. **Deploy API via FTP** — uploads `/api` to `api/` on the server (excludes `.git`, `node_modules`, storage logs/cache/sessions/views, `storage/app/**` to preserve uploaded files, and `.env`). State file: `.ftp-deploy-sync-state-api.json`.
9. **Deploy web portal via FTP** — uploads `/web/dist/` to the server root (`./`). State file: `.ftp-deploy-sync-state-web.json`.
10. **Deploy marketing site via FTP** — uploads `/site/` to the server root (`./`). State file: `.ftp-deploy-sync-state-site.json`.
11. **Deploy Community app via FTP** — uploads `/community/dist/` to `community/app/`. State file: `.ftp-deploy-sync-state-community.json`.
12. **Wipe server config cache** — uses `dangerous-clean-slate` to delete `api/bootstrap/cache/` on the server, preventing stale cached config
13. **Clear Laravel caches** — hits `/api/clear-cache-9x7k` to run `config:clear`, `route:clear`, `view:clear`, and `opcache_reset()`
14. **Purge Cloudflare cache** — purges all cached files so the new JS/CSS bundles are served immediately (prevents blank-page issues from stale HTML referencing old chunk filenames)

> **Why four separate FTP state files?** Each upload step uses [SamKirkland/FTP-Deploy-Action](https://github.com/SamKirkland/FTP-Deploy-Action), which writes a sync-state file to the host so it only uploads diffs. Sharing one state file across steps caused later steps to delete files that earlier steps had uploaded. One state file per step keeps each deploy idempotent.

#### GitHub Secrets Required

The following secrets must be configured in the repo settings (**Settings > Secrets and variables > Actions**):

| Secret | Purpose |
|--------|---------|
| `FTP_SERVER` | GoDaddy FTP hostname |
| `FTP_USERNAME` | FTP username |
| `FTP_PASSWORD` | FTP password |
| `VITE_STRIPE_KEY` | Stripe publishable key (paid service, web portal only) |
| `VITE_GOOGLE_MAPS_KEY` | Google Maps API key (used by both web portal and Community app builds) |
| `CLOUDFLARE_ZONE_ID` | Cloudflare Zone ID (for cache purge after deploy) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Cache Purge permission |

#### What This Means for Development

Since the CI pipeline handles building and deploying:

- **You do NOT need to commit `web/dist/` or `community/dist/`** — the CI builds these fresh each deploy
- **`api/vendor/` IS committed** because GoDaddy shared hosting has no Composer. When you add a PHP package locally, run `composer require ...` and commit `composer.json`, `composer.lock`, and the new `vendor/` directory.
- **You do NOT need to run `npm run build` locally** before pushing (unless testing locally)
- Just commit your source code changes, push to `main`, and the workflow handles the rest
- The `.env` file is **never deployed** — it is managed directly on the server via the GoDaddy admin panel (watch for trailing non-breaking spaces ` `)

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
- **Service Requests** — client-submitted requests for schedule changes, time extensions, and special services (editable/cancellable while pending); billing tracking via `billing_type`, `billing_amount`, `billing_description`, `invoice_line_item_id` columns
- **Visit Reports** — post-visit report cards with multi-photo support, per-dog data (checklists/notes as JSON)
- **Report Card Templates** — customizable checklist templates per client
- **Invoices** — line items, Stripe payment intents, PDF generation, invoice numbers (`PC-YYYY-NNNN`)
- **Conversations & Messages** — threaded messaging with photo attachments, emoji reactions, reply threading (`reply_to_id`), notification type messages
- **Documents** — client documents with digital signature support, templates with visual field editor
- **Document Templates** — PDF templates with positioned form fields (name, checkbox, date, signature, dog_name, open_text), `assigned_to` role per field (client/company), counter-sign fields (`countersign_token`, `countersigned_at`, `countersigner_name`, `countersigner_ip`, `countersign_signature_data`, `countersign_field_values`)
- **System Email Templates** — admin-customizable email overrides with token support
- **Onboarding Steps** — multi-step client onboarding flow
- **Error Logs** — API exception tracking (type, message, context, URL, user)
- **Email Logs** — all outbound emails tracked (to, subject, status, Resend ID, errors)
- **Audit Logs** — admin action tracking
- **Push Notifications** — Expo push notification records

#### Community tables (separate from the paid service)

- **`community_members`** — name, email, password, status (`pending_verification` / `verified` / `suspended` / `closed`), `verification_provider`, `verification_session_id`, `verification_paid_at`, `verification_checkout_session_id`, `verified_at`, `paused_at`, `notification_prefs` (JSON), `geohash` (6-char), `introduction`, `photo_path`, `availability` / `need_availability` / `care_offered` / `care_needed` (JSON arrays), `radius_meters` (unsigned INT, 250–200,000), `referral_code` (8-char, no 0/O/1/I/L), `referred_by_member_id`, `api_token`, soft-deletes
- **`community_pets`** — `member_id`, `species` (`dog`/`cat`/`other`), `species_other`, `name`, `photo_path`, `age_years`, `sex`, `spayed_neutered`, `notes`, `care_instructions`, `species_data` (JSON for species-specific fields like breed/size/energy or indoor-only/shy), `sort_order`, soft-deletes
- **`community_connections`** — `requester_id`, `recipient_id`, `status` (`pending`/`accepted`/`declined`/`removed`), `note`, `responded_at`, soft-deletes
- **`community_invites`** — `inviter_id`, `email`, `note`, `status` (`sent`/`accepted`/`expired`), `accepted_member_id`, `sent_at`, `accepted_at`
- **`community_broadcasts`** + **`community_broadcast_recipients`** — care asks ("Anyone around to drop in tomorrow?") to chosen neighbours; first to confirm opens a chat
- **`community_conversations`** + **`community_messages`** — 1:1 messaging between accepted connections
- **`community_recommendations`** — written-only recs from one member about another, with `hidden` flag the subject controls
- **`community_blocks`** — silent, two-way block edges; the blocked member never sees the blocker again, and vice versa
- **`community_reports`** — private reporting flow with `reason` and `details`

> **Note**: Many columns on the paid-service tables are auto-created by controllers on first use via `Schema::hasColumn()` checks, so the app works even without running all migrations. The Community migrations are stricter — run them all via `/api/migrate-community-9x7k` after any deploy that adds a Community migration.

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
| `STRIPE_KEY` | Stripe publishable key (paid service) |
| `STRIPE_SECRET` | Stripe secret key (`sk_test_` or `sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret — `/api/webhooks/stripe` (paid-service payments) |
| `STRIPE_IDENTITY_WEBHOOK_SECRET` | Webhook signing secret — `/api/webhooks/stripe-identity` (Community ID verification events) |
| `STRIPE_COMMUNITY_CHECKOUT_WEBHOOK_SECRET` | Webhook signing secret — `/api/webhooks/community-checkout` (Community $5 verification fee + donations). Falls back to `STRIPE_WEBHOOK_SECRET` if unset. |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key (enable Distance Matrix, Places, Maps JavaScript APIs, **Geocoding API**) |
| `MAIL_MAILER` | `resend` (uses custom HTTP transport via Guzzle) |
| `RESEND_API_KEY` | Resend API key (also read from `MAIL_PASSWORD` as fallback) |
| `MAIL_FROM_ADDRESS` | `hello@thepupperclub.ca` (requires domain verification in Resend) |
| `RESEND_INBOUND_ADDRESS` | Reply-to address for inbound email routing (e.g. `reply@thepupperclub.ca`) |
| `COMMUNITY_SUPPORT_ADDRESS` | Where Community Contact Us form submissions land. Defaults to `sophie@thepupperclub.ca`. |
| `APP_TIMEZONE` | `America/Vancouver` |
| `SANCTUM_STATEFUL_DOMAINS` | Allowed frontend domains |
| `FRONTEND_URL` | Web portal URL (e.g., `https://thepupperclub.ca`) — used as the fallback origin for Stripe redirects when the request Origin/Referer header can't be trusted |
| `TWILIO_SID` | Twilio account SID (for SMS) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Twilio phone number |

**Web (`web/.env`):**

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL (e.g., `http://localhost:8000`) |
| `VITE_STRIPE_KEY` | Stripe publishable key (must match backend's secret key mode — both test or both live) |
| `VITE_GOOGLE_MAPS_KEY` | Google Maps API key (for Places address autocomplete) |

**Community (`community/.env.local`):**

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL — default `https://thepupperclub.ca` |
| `VITE_GOOGLE_MAPS_KEY` | Google Maps API key for the in-app address autocomplete on Profile Setup |

> The Community app does **not** use Stripe Elements — verification and donations both hand off to Stripe-hosted Checkout / Identity pages — so no publishable key is needed.

> **Stripe key mismatch warning**: `pk_live_` and `sk_test_` keys do not pair. Both must be the same mode (test or live) for payments to work.

### Post-Setup Steps

1. **Google Maps**: Get an API key from [Google Cloud Console](https://console.cloud.google.com/) and enable **Distance Matrix API**, **Places API**, **Maps JavaScript API**, and **Geocoding API** (the last is used by the Community to resolve addresses to geohashes)
2. **Team addresses**: Set each team member's home address on the Team page (Admin -> Team) — required for automatic mileage calculation
3. **Resend**: Verify `thepupperclub.ca` domain in Resend dashboard before sending from `hello@thepupperclub.ca`
4. **Stripe webhooks** (3 separate endpoints, each with its own signing secret):
   - `https://thepupperclub.ca/api/webhooks/stripe` — paid-service events (`payment_intent.*`, `invoice.paid`, `customer.subscription.*`) → `STRIPE_WEBHOOK_SECRET`
   - `https://thepupperclub.ca/api/webhooks/stripe-identity` — `identity.verification_session.verified` / `requires_input` / `canceled` → `STRIPE_IDENTITY_WEBHOOK_SECRET`
   - `https://thepupperclub.ca/api/webhooks/community-checkout` — `checkout.session.completed` → `STRIPE_COMMUNITY_CHECKOUT_WEBHOOK_SECRET`
5. **Stripe promo codes** (optional): Create a 100%-off coupon in Stripe Dashboard, attach a promotion code (e.g. `THEGOODEST`). `allow_promotion_codes: true` is already set on the Community verification checkout.
6. **Inbound email**: Set up email routing so replies to `RESEND_INBOUND_ADDRESS` are forwarded to `https://thepupperclub.ca/api/webhooks/email`. Options: Resend inbound webhooks, or Cloudflare Email Routing (if DNS is on Cloudflare) with a forwarding service
7. **Twilio**: Create account, get phone number, add credentials to `.env` for SMS notifications
8. **Cloudflare**: Add `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` to GitHub Secrets for automatic cache purging on deploy

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
  "workspaces": ["web", "mobile", "shared", "community"]
}
```

Run commands from root:
- `npm run web` — Start web dev server (paid-service portal)
- `npm run mobile` — Start Expo dev server
- `npm run build:web` — Build web portal for production

Or from `community/`:
- `npm run dev` — Vite dev server (web-only, no Tauri shell) on http://localhost:5173
- `npm run tauri:dev` — Tauri desktop dev (Rust compile required on first run)
- `WEB_DEPLOY=1 npm run build` — Build the web SPA bundle for deploy to `/community/app/`
- `npm run tauri:build` — Build native desktop installers (`.app` / `.dmg` / `.msi`)
