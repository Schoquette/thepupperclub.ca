#!/bin/bash
# The Pupper Club — Project Setup Script
# Run this once after cloning to install all dependencies and scaffold the base frameworks.
# Requirements: PHP 8.2+, Composer, Node 20+, npm

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================================"
echo "  The Pupper Club — Setup"
echo "================================================"

# ── API (Laravel 11) ─────────────────────────────────────────────────────────
echo ""
echo "→ Setting up Laravel API..."
cd "$SCRIPT_DIR/api"
composer install
cp -n .env.example .env 2>/dev/null || true
php artisan key:generate
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider" --force

echo ""
echo "⚠  Edit api/.env with your database credentials, then run:"
echo "   cd api && php artisan migrate --seed"

# ── Web (React + Vite) ───────────────────────────────────────────────────────
echo ""
echo "→ Setting up Web frontend..."
cd "$SCRIPT_DIR/web"
npm install

# ── Mobile (Expo) ────────────────────────────────────────────────────────────
echo ""
echo "→ Setting up Mobile app..."
cd "$SCRIPT_DIR/mobile"
npm install

# ── Shared types ─────────────────────────────────────────────────────────────
echo ""
echo "→ Installing shared types..."
cd "$SCRIPT_DIR/shared"
npm install

echo ""
echo "================================================"
echo "  Setup complete!"
echo ""
echo "  Start dev servers:"
echo "    API:    cd api && php artisan serve"
echo "    Web:    cd web && npm run dev"
echo "    Mobile: cd mobile && npx expo start"
echo "================================================"
