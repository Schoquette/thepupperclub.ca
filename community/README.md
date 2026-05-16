# The Pupper Club — Community

Desktop application for the Community sub-brand. Tauri 2 + React + Vite + Tailwind.

## Prerequisites

- **Node.js** 20+ and **npm**
- **Rust** toolchain — install with `rustup` from https://rustup.rs (Tauri needs `cargo`)
- On macOS: Xcode Command Line Tools (`xcode-select --install`)
- On Windows: WebView2 (ships with Windows 11; auto-installed on Windows 10)

## Local development

```bash
cd community
npm install
npm run tauri:dev
```

The first run will compile the Rust shell — that takes a few minutes. Subsequent runs are fast.

The web frontend alone (no Tauri shell, useful for UI work in a regular browser) can be run with:

```bash
npm run dev
```

…and opened at http://localhost:5173.

## Backend

The app hits the shared Laravel API at `/api/community/*`. Set `VITE_API_URL` in `community/.env.local` to point at a local backend during development:

```
VITE_API_URL=http://localhost:8000
```

Default (no env var) is `https://thepupperclub.ca`.

## Build

```bash
npm run tauri:build
```

Produces signed installers in `src-tauri/target/release/bundle/`:

- macOS: `.app`, `.dmg`
- Windows: `.msi`, `.exe`

Code signing certs aren't wired up yet — without them, macOS shows a Gatekeeper warning ("unidentified developer") and Windows shows a SmartScreen warning. See `docs/specs/community-spec.md` for the plan.

## Project layout

```
community/
├── src/                  # React frontend
│   ├── pages/            # Welcome / SignIn / SignUp / Home
│   ├── contexts/         # AuthContext
│   ├── lib/              # api.ts (axios)
│   └── main.tsx
├── src-tauri/            # Rust shell
│   ├── src/              # main.rs + lib.rs
│   ├── tauri.conf.json
│   └── Cargo.toml
├── tailwind.config.js    # Brand tokens (cream/espresso/taupe/blue)
└── package.json
```

## What's wired up so far

- Sign up / sign in / sign out via `/api/community/auth/*`
- Token-based session, persisted to `localStorage` (bearer header on every request)
- Welcome → Sign In → Sign Up → Home routing
- Brand tokens (Just Blue accent, Playfair Display SC, Lato)
- Tauri shell with cream window background

## Not yet wired

- Identity verification (Persona / Stripe Identity / Onfido) — placeholder button on Home
- Location capture + geohash
- Member discovery / proximity matching
- Care broadcasts
- E2E-encrypted messaging
- Code signing for release builds
