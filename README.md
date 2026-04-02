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
| **Marketing Site** | `/site` | Static HTML, CSS, JS | Public-facing website at thepupperclub.ca |
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
- **Resend** (via SMTP) for transactional email
- **DomPDF** for PDF generation (intake forms, invoices)
- **22 database migrations** covering users, clients, dogs, appointments, invoices, messaging, documents, and more

#### Key API Features

- **Authentication**: Login, password reset, role-based access (admin/client)
- **Client Management**: Profiles, onboarding steps, home access codes (encrypted)
- **Dog Management**: CRUD, vaccination records, documents
- **Appointments**: Scheduling, check-in/complete, recurring generation
- **Invoicing**: Create, send, pay via Stripe, PDF export, subscription billing
- **Messaging**: Conversations with photo attachments, emoji reactions
- **Report Cards**: Post-visit reports with photos and templates
- **Document Signing**: Self-hosted digital signatures with encrypted tokens
- **Intake Forms**: 45-field intake form with branded PDF export
- **Notifications**: Expo push notifications, email broadcasts, pre-visit reminders
- **Audit Logging**: Tracks all admin actions

#### Scheduled Commands

| Command | Purpose |
|---------|---------|
| `SendPreVisitPrompts` | Sends reminders 2 hours before appointments |
| `GenerateRecurringAppointments` | Creates recurring appointment instances |
| `GenerateSubscriptionInvoices` | Monthly billing with 3-day email reminders |

#### API Routes

- **Public**: `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/webhooks/stripe`, `/contact`, `/signing/{token}`
- **Admin** (`/admin/*`): Full CRUD for clients, dogs, appointments, invoices, report cards, documents, notifications, audit logs, intake forms, Stripe products
- **Client** (`/client/*`): Profile, dogs, appointments, invoices, billing/Stripe setup, report cards, documents, onboarding
- **Shared**: Conversations, messages, message reactions, photo serving

### Web Portal — React 18

- **React 18** with **TypeScript** and **Vite** build tool
- **TailwindCSS** for styling
- **React Query** (`@tanstack/react-query`) for data fetching with 5-second polling for real-time updates
- **React Router v6** for client-side routing
- **Stripe React SDK** for payment UI (card management, invoice payments)
- **React Big Calendar** for appointment scheduling views
- **Axios** for API communication with auth interceptors

#### Web Portal Pages (30 pages)

**Admin Pages**: Dashboard, Clients list, Client detail, Intake form, Calendar, Service requests, Inbox, Conversation, Invoices, Invoice create, Invoice detail, Report cards, Report card form, Broadcast messages, Audit logs

**Client Pages**: Dashboard, Onboarding, Profile, Dogs, Appointments, Messages, Invoices, Billing (Stripe card management), Report cards, Documents

**Shared**: Login, Set password, Forgot/reset password, Document signing

#### Reusable UI Components

Button, Input, Card, Badge, Modal, LoadingSpinner, MessageBubble (with emoji reactions and photo lightbox)

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
- Deployed to **GitHub Pages** with automatic deployment on push
- Custom domain: **www.thepupperclub.ca**
- Clean URLs via `.htaccess` rewrite rules (Apache)
- Contact form wired to the Laravel API `/api/contact` endpoint

#### Pages

| Page | Description |
|------|-------------|
| Home (`index.html`) | Hero, ethos section, contact form |
| Services (`services.html`) | Tabbed pricing (60min/30min), packages, testimonials |
| About (`about.html`) | Founder story, Instagram feed |
| Contact (`contact.html`) | Contact form, email, phone, service area |
| FAQ (`faq.html`) | 9-item accordion |

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

| Component | Host | Details |
|-----------|------|---------|
| **Marketing Site** | GitHub Pages | Auto-deploys from `site/` on push to `main` |
| **API + Web Portal** | GoDaddy cPanel | PHP hosting with MySQL 8.0 |
| **Database** | GoDaddy MySQL | `pupper_club` database |
| **Email** | Resend | SMTP via `smtp.resend.com` |
| **Payments** | Stripe | Webhooks at `/api/webhooks/stripe` |
| **Domain** | GoDaddy | `thepupperclub.ca` |

### GitHub Actions

The `.github/workflows/deploy.yml` workflow automatically deploys the `site/` directory to GitHub Pages on every push to `main`.

---

## Database Schema

22 migrations covering:

- **Users & Auth** — users table with roles (admin, client), Sanctum personal access tokens
- **Client Profiles** — extended client info, subscription fields (plan, billing date, Stripe customer/payment method)
- **Home Access** — encrypted access codes for client homes
- **Dogs** — breed, age, temperament, special needs, vaccination records
- **Appointments** — scheduling with check-in/complete timestamps, recurring support
- **Service Requests** — client-submitted requests for schedule changes
- **Visit Reports** — post-visit report cards with photos, mood, notes
- **Invoices** — line items, Stripe payment intents, PDF generation
- **Conversations & Messages** — threaded messaging with photo attachments and emoji reactions
- **Documents** — client documents with digital signature support
- **Onboarding Steps** — multi-step client onboarding flow
- **Audit Logs** — admin action tracking
- **Push Notifications** — Expo push notification records

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
# Edit api/.env with your database credentials, Stripe keys, and Resend API key

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
npx expo start
```

### Environment Variables

**API (`api/.env`):**
- `DB_*` — MySQL connection
- `MAIL_*` — Resend SMTP credentials
- `STRIPE_KEY`, `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET` — Stripe keys
- `SANCTUM_STATEFUL_DOMAINS` — Allowed frontend domains
- `FRONTEND_URL` — Web portal URL
- `DISPLAY_TIMEZONE` — Set to `America/Vancouver`

**Web (`web/.env`):**
- `VITE_API_URL` — API base URL
- `VITE_STRIPE_KEY` — Stripe publishable key

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
