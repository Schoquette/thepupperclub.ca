# The Pupper Club — Community

The Community sub-brand. Same React + Vite codebase ships as a **Tauri 2 desktop app** (macOS + Windows) and as a **web SPA** hosted at `thepupperclub.ca/community/app/`. The `WEB_DEPLOY=1` env var flips Vite's `base` so asset URLs line up with the subpath.

Members are stored in their own `community_members` table — completely separate from the paid service's `users` table — and authenticate with their own bearer tokens.

## Prerequisites

- **Node.js** 20+ and **npm**
- **Rust** toolchain — install with `rustup` from https://rustup.rs (Tauri needs `cargo`)
- On macOS: Xcode Command Line Tools (`xcode-select --install`)
- On Windows: WebView2 (ships with Windows 11; auto-installed on Windows 10)

## Local development

```bash
cd community
npm install
npm run tauri:dev          # full desktop shell (Rust compile on first run)
# OR
npm run dev                # web frontend only, http://localhost:5173 — faster UI iteration
```

The first `tauri:dev` run compiles the Rust shell — that takes a few minutes. Subsequent runs are fast.

## Backend

The app hits the shared Laravel API at `/api/community/*`. Override `VITE_API_URL` in `community/.env.local` to point at a local backend during development:

```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_MAPS_KEY=your_google_maps_key   # used by the address autocomplete on Profile Setup
```

Default (no env var) is `https://thepupperclub.ca`.

## Build

```bash
# Web SPA bundle for deploy to /community/app/
WEB_DEPLOY=1 npm run build

# Native desktop installers
npm run tauri:build
```

Web build outputs to `dist/`. Native installers land in `src-tauri/target/release/bundle/`:

- macOS: `.app`, `.dmg`
- Windows: `.msi`, `.exe`

Code signing certs aren't wired up yet — without them, macOS shows a Gatekeeper warning ("unidentified developer") and Windows shows a SmartScreen warning.

## Project layout

```
community/
├── src/
│   ├── components/
│   │   ├── AppNav.tsx              # Marketing-style header with logo + nav
│   │   ├── AppFooter.tsx           # Brand / location / Contact us / Say Thanks!
│   │   ├── PageShell.tsx           # Nav + back / breadcrumbs + content + footer
│   │   ├── AddressAutocomplete.tsx # Google Places single-input picker
│   │   ├── AuthImage.tsx           # Bearer-token blob fetch for gated images
│   │   ├── PetForm.tsx             # Species-aware add/edit pet modal
│   │   ├── PhotoCropper.tsx        # react-easy-crop modal for member + pet photos
│   │   ├── MemberSafetyMenu.tsx    # Block / report
│   │   └── VerifiedBadge.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx         # Token persistence + signIn/signUp/signOut/refresh
│   ├── lib/
│   │   └── api.ts                  # axios + PATCH/PUT/DELETE→POST _method spoofing
│   ├── pages/
│   │   ├── WelcomePage.tsx
│   │   ├── SignInPage.tsx
│   │   ├── SignUpPage.tsx          # Reads ?invited_by= from URL
│   │   ├── HomePage.tsx
│   │   ├── ProfileSetupPage.tsx    # Photo + pets + intro + radius (1/5/15/25/50/200km) + address
│   │   ├── DiscoverPage.tsx        # Anonymous browse + verify-gate modal
│   │   ├── MemberProfilePage.tsx   # Anonymous vs full view (full_view flag)
│   │   ├── NetworkPage.tsx         # My Network: invite section + connections
│   │   ├── BroadcastsPage.tsx
│   │   ├── MessagesPage.tsx
│   │   ├── ConversationPage.tsx
│   │   ├── VerifyPage.tsx          # Two-step paid + Stripe Identity
│   │   ├── SettingsPage.tsx        # Notifications / pause / password / delete
│   │   ├── ContactPage.tsx         # Topic-based support form
│   │   ├── DonatePage.tsx          # "Say Thanks!" — presets + custom amount
│   │   └── BlockedMembersPage.tsx
│   ├── App.tsx                     # Routes (RequireAuth wrapper)
│   ├── main.tsx
│   └── index.css                   # Tailwind + brand button / nav-link / pac-container styles
├── src-tauri/                      # Rust shell
│   ├── src/
│   ├── tauri.conf.json
│   └── Cargo.toml
├── tailwind.config.js              # Brand tokens (cream / espresso / taupe / blue)
└── package.json
```

## What's wired up

### Auth + profile
- Sign up (with optional `?invited_by=CODE` referral), sign in, sign out
- Token persisted to `localStorage`, attached as `Authorization: Bearer …` on every request
- Change password (rotates token), delete account, pause / resume profile
- Notification preferences (connection requests, messages, broadcasts, product updates)
- Member photo upload with full pan/zoom/rotate cropper (square PNG output)

### Pets
- Multi-pet, species-aware form (Dog / Cat / Other → free-text species)
- Per-species fields: dog breed/size/energy/good-with-{dogs,cats,kids}; cat indoor-only/shy
- Photo per pet, connection-gated serving

### Identity verification ($5 paywall + Stripe Identity)
- Step 1: Stripe Checkout for the one-time $5 CAD fee (with `allow_promotion_codes: true`, e.g. `THEGOODEST` for 100% off)
- Step 2: Stripe Identity (`document` type with live-capture + matching selfie)
- Auto-polling `/verification/status` while the flow is mid-flight
- Two webhooks: `/api/webhooks/stripe-identity` for verification events; `/api/webhooks/community-checkout` for `checkout.session.completed`
- Verification gated on connection requests, anonymous browse always allowed

### Discovery + connections
- Anonymous browse — names and photos hidden, distance bucketed (`About 2 km away`), pet count summary, care offer / need tag groups
- Member profile: branches on `full_view` from the API (anonymous intro / care / pet counts → full name / photo / pets / recommendations once both verified and connected)
- Connection requests with a personal note; recipient's pending row stays anonymous until accepted
- My Network: incoming / outgoing / accepted lists + invite section

### Invites
- Send an email invite directly (branded `CommunityMailer` email with Reply-To set to the inviter)
- Or share a personal join link — does **not** auto-connect joiners to the inviter (controls who's in the network); recipients sign up via `?invited_by=CODE`
- Pending invite list with status (sent / accepted / expired) and remove action

### Messaging + broadcasts
- 1:1 conversations between accepted connections, light 5s polling
- Broadcast care asks to chosen neighbours; first to confirm opens chat

### Recommendations + safety
- Written-only recommendations; no scores or ratings
- Subject can hide individual recommendations from their own profile
- Block (silent, two-way) and report (private flow)

### Donate / Contact us
- "Say Thanks!" donation flow with presets ($5/$10/$20/$50) + custom amount, Stripe Checkout `submit_type=donate`
- Contact us with topic selection (technical / question / feature / safety), routed through `App\Services\CommunityMailer` to `sophie@thepupperclub.ca` with the member as Reply-To

### Branded email
- Every outbound Community email renders through `resources/views/emails/notification.blade.php` → `emails/layout.blade.php` (same template the paid Client Portal uses), with inline CID logo and proper Reply-To handling

### UX shell
- Marketing-site-style header (espresso wordmark logo linked to `/home`, blue underline hover, sticky cream bar) + mobile burger
- Footer with Port Moody / Contact us button / Say Thanks! button / copyright + Privacy + Terms
- Back button + breadcrumb trail on every authed page via `PageShell`

## What's not done

- Code signing for native installers (macOS notarisation, Windows EV cert)
- Push notifications inside the desktop app (web build relies on email + in-app)
- End-to-end encrypted messaging (currently stored encrypted at rest only)
- Multi-language support
