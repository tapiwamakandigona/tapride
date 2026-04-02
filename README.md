# TapRide 🚗

A ride-hailing web app built with React, TypeScript, and Supabase.

**Live:** [tapiwamakandigona.github.io/tapride](https://tapiwamakandigona.github.io/tapride/)

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (Auth, PostgreSQL, Realtime)
- **Mobile:** Capacitor (Android)
- **Maps:** Leaflet + OpenStreetMap + Nominatim geocoding
- **Deploy:** GitHub Pages (CI/CD via Actions)

## Features

- Rider & driver dashboards
- Real-time ride requests and tracking
- In-app chat between rider and driver
- Fare estimation (distance-based)
- Star ratings after ride completion
- Dark mode
- Mobile-ready (Capacitor)

## Getting Started

```bash
# Install
npm install

# Copy env and fill in your Supabase credentials
cp .env.example .env

# Dev server
npm run dev

# Tests
npm test

# Production build
npm run build
```

## Environment Variables

See `.env.example` for all required variables:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

## Project Structure

```
src/
├── components/     # Shared UI components
│   ├── Chat/       # Chat bubble
│   ├── Layout/     # App shell, navbar, theme toggle
│   ├── Map/        # MapView, address search
│   ├── Ride/       # Ride request cards/forms
│   └── ui/         # Spinner, AlertError, ConfirmModal, Footer
├── context/        # React contexts (Auth, Theme)
├── hooks/          # Custom hooks (useRide, useChat, useLocation, etc.)
├── lib/            # Utilities (Supabase client, fare calc, geo, notifications)
├── pages/          # Route pages (lazy-loaded)
├── types/          # TypeScript type definitions
└── __tests__/      # Unit tests
supabase/
└── migrations/     # SQL schema + RLS policies
```

## Architecture Notes

- **Code-splitting:** All pages are lazy-loaded via `React.lazy` for smaller initial bundle
- **Stacking context:** Map containers use CSS `isolate` to prevent Leaflet z-index bleed
- **Comments:** AI-readable format with `[INTENT]`, `[CONSTRAINT]`, `[EDGE-CASE]` tags
- **Auth:** Supabase auth with auto-profile creation via database trigger
- **Realtime:** Rides, driver locations, and messages use Supabase Realtime subscriptions

## License

MIT
