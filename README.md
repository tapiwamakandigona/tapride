# 🚗 TapRide

> Affordable ride-hailing for Zimbabwe — built with React, TypeScript & Supabase.

[![Build](https://img.shields.io/badge/build-passing-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)

---

## 📸 Screenshots

| Rider Dashboard | Fare Bidding | Active Ride |
|:-:|:-:|:-:|
| ![Rider Dashboard](docs/screenshots/rider-dashboard.png) | ![Fare Bidding](docs/screenshots/fare-bidding.png) | ![Active Ride](docs/screenshots/active-ride.png) |

> _Replace placeholders with actual screenshots._

---

## ✨ Features

- **Dynamic Pricing** — time-of-day multipliers, surge pricing, per-ride-type rates
- **Fare Bidding** — riders and drivers negotiate fares in real time
- **Multiple Ride Types** — Economy, Comfort, and XL with distinct pricing
- **Real-Time Tracking** — live driver location on an interactive Leaflet map
- **In-App Chat** — message your driver during a ride
- **SOS / Emergency** — one-tap emergency overlay with safety contacts
- **Driver Verification** — badge system for verified drivers
- **Promo Codes** — apply discount codes at checkout
- **Ride Scheduling** — book rides in advance
- **Digital Receipts** — detailed fare breakdowns after every trip
- **Ride History** — browse and review past rides
- **Driver Ratings** — rate drivers after each trip
- **Dark Mode** — system-aware theme toggle
- **Offline Banner** — network status detection
- **Mobile-First** — ships as an Android app via Capacitor

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript 5.3, Vite 5 |
| Styling | Tailwind CSS 3.4 |
| Maps | Leaflet + React-Leaflet |
| Backend | Supabase (Auth, Database, Realtime, RPC) |
| Mobile | Capacitor 5 (Android) |
| Testing | Vitest, Testing Library |
| Routing | React Router 6 |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A [Supabase](https://supabase.com) project
- (For Android) Android Studio + JDK 17

### Installation

```bash
git clone https://github.com/tapiwamakandigona/tapride.git
cd tapride
npm install
```

### Environment Setup

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Supabase Setup

Run the SQL migration files in order against your Supabase project:

```bash
# In the Supabase SQL Editor, run each file in supabase/migrations/ in order:
# 001_initial_schema.sql
# 002_driver_locations.sql
# 003_fare_bids.sql
# ... etc.
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 📱 Building for Android

```bash
npm run build
npx cap sync android
npx cap open android
```

Then build the APK from Android Studio.

---

## 📁 Project Structure

```
src/
├── __tests__/              # Unit tests (Vitest)
│   ├── fare.test.ts
│   ├── geo.test.ts
│   ├── matching.test.ts
│   └── bidding.test.ts
├── components/
│   ├── Chat/               # ChatBubble, TypingIndicator
│   ├── Driver/             # VerificationBadge
│   ├── Layout/             # AppLayout, Navbar, NetworkBanner, ThemeToggle
│   ├── Map/                # AddressSearch, MapView
│   ├── Ride/               # FareBidding, RideTypeSelector, PromoCodeInput,
│   │                         ReceiptCard, RideRequestCard, RideRequestForm,
│   │                         ScheduleRidePicker, BidResponseCard
│   ├── Safety/             # SOSButton, EmergencyOverlay
│   └── ErrorBoundary.tsx
├── context/                # AuthContext, ThemeContext
├── hooks/                  # useBidding, useChat, useLocation, useNetworkStatus,
│                             usePromo, useRide, useSOS, useVersion
├── lib/                    # fare, geo, matching, storage, supabase, version
├── pages/                  # Login, Register, RiderDashboard, DriverDashboard,
│                             ActiveRide, ChatPage, Profile, RideHistory,
│                             RideReceipt, ScheduledRides, RateRide,
│                             DriverVerification, ForgotPassword, Splash
├── test/                   # Test setup (setup.ts)
├── types/                  # TypeScript type definitions
├── App.tsx
├── index.css
└── main.tsx
```

---

## 🧪 Running Tests

```bash
npm test            # single run
npm run test:watch  # watch mode
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please keep code consistent with the existing TypeScript + Tailwind patterns.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/tapiwamakandigona">Tapiwa Makandigona</a>
</p>
