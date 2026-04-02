# TapRide 🚗

A ride-hailing app built with React, TypeScript, Vite, Tailwind CSS, Capacitor, and Supabase.

## Features

- **Rider & Driver modes** — request rides or accept them
- **Real-time tracking** — live driver location via Supabase Realtime + Leaflet maps
- **In-app chat** — message your rider/driver during a ride
- **Rating system** — rate completed rides (1-5 stars)
- **Dark/Light theme** — system-aware with manual toggle
- **Mobile-ready** — Capacitor for Android APK builds
- **SPA on GitHub Pages** — with proper 404 redirect handling

## Quick Start

```bash
# Clone
git clone https://github.com/tapiwamakandigona/tapride.git
cd tapride

# Install
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase project URL and anon key

# Run dev server
npm run dev
```

## Environment Variables

See [`.env.example`](.env.example) for all available variables. Required:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run preview` | Preview production build locally |

## Database

The Supabase schema is in [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql). It includes:

- `profiles` — extends `auth.users` with rider/driver fields
- `rides` — ride lifecycle (requested → accepted → in_progress → completed/cancelled)
- `driver_locations` — real-time GPS tracking
- `messages` — in-ride chat
- `ratings` — post-ride ratings
- `app_config` — feature flags and version enforcement

All tables have Row Level Security (RLS) enabled.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Maps | Leaflet + react-leaflet |
| Routing | OSRM (free, no API key) |
| Geocoding | Nominatim (free, rate-limited) |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Mobile | Capacitor (Android) |
| CI/CD | GitHub Actions (tests + GH Pages deploy + APK builds) |

## Deployment

**GitHub Pages** — pushes to `main` auto-deploy via `.github/workflows/deploy.yml`.

**Android APK** — tag a release (`v*`) to trigger `.github/workflows/build-apk.yml`.

## License

Made by Tapiwa Makandigona.
