# 🌙 Overnight Work Report — April 5-6, 2026
*Prepared by Pat while MC slept*

---

## PART 1: GITHUB PROFILE AUDIT

### Current Issues with Profile README

**1. "Senior Full Stack Software Engineer" title is a stretch**
You're a student/early-career dev with impressive projects, but claiming "Senior" is a red flag for any recruiter or dev who visits. It undermines credibility.

**Recommendation:** Change to something honest but strong:
- "Full Stack Developer | Zimbabwe 🇿🇼"
- "Building apps with React, TypeScript & Supabase"

**2. "Zero slop" claim + "production-ready" everywhere**
The repos are AI-generated portfolio projects (which is fine — everyone does this now). But overclaiming they're "production-ready" or "zero slop" when they're demo/portfolio pieces creates a credibility gap.

**Recommendation:** Be honest about what they are: well-crafted portfolio projects showing range. That's genuinely impressive for your age.

**3. "Open to remote engineering roles" at the bottom**
If you're a student competing in AOAI, this is premature. Replace with your actual context — student, builder, learning.

**4. Featured repos are good picks** ✅
ZimBet, FPS game, Todo cross-platform, ZimPay — these show range (games, fintech, cross-platform). Keep these.

**5. Missing: TapRide!**
Your most sophisticated project (Supabase realtime, ride-hailing with maps, chat, driver tracking) isn't featured. It should be the #1 hero repo.

**6. Tech stack icons include things you haven't demo'd**
Docker, MongoDB, Firebase, Next.js, Prisma — but your repos are almost all React + Supabase + Vite. Either build something with those stacks or remove them.

### Profile README Rewrite Plan
- Honest title (student/developer, not senior)
- TapRide as #1 featured project
- Remove overclaiming language
- Keep the stats cards (they look good)
- Add AOAI 2026 mention (competing internationally is impressive)
- Fix tech stack to match actual repos

---

## PART 2: TAPRIDE DEEP CODE AUDIT

### Anti-Pattern Scan (checked against React 2025 best practices)

**✅ CLEAN — No major anti-patterns found:**
- No derived state stored in useState (computed inline where needed)
- No components defined inside other components
- No conditional hook calls
- useCallback/useRef used correctly for stable references
- mountedRef pattern used consistently to prevent setState-after-unmount
- Proper effect cleanup everywhere

**⚠️ MINOR ISSUES:**

1. **RiderDashboard.tsx has too many useState calls (11 state variables)**
   - Could benefit from useReducer for the ride-request flow
   - Not critical but makes the component harder to reason about

2. **MapView creates DivIcon objects at module level** ✅ (this is actually correct — they're stable constants)

3. **No error boundaries around individual routes**
   - There's a top-level ErrorBoundary, which is good
   - But a crash in one page takes down the whole app
   - Should add per-route error boundaries for critical pages (ActiveRide, DriverDashboard)

4. **Supabase client is a singleton** ✅ (correct pattern)

5. **No request cancellation on rapid navigation**
   - If a user navigates away while a Supabase query is in-flight, the response is silently discarded via mountedRef — this is fine but wasteful
   - AbortController would be cleaner for geo.ts calls (already partially implemented there)

### Missing Tests
- **No integration tests** for the auth flow (signUp → verify → signIn)
- **No tests for useRide hook** (the most complex piece)
- **No tests for the realtime subscription logic**
- Current tests only cover pure utility functions (fare, geo, version, notifications, edge cases)

### Security Audit

**✅ Good:**
- RLS enabled on all tables
- Profile update uses field allowlist (PROFILE_ALLOWED_FIELDS)
- Auth loading timeout prevents infinite spinner
- Service role key is NOT in the frontend code
- Anon key is used correctly (it's meant to be public)

**⚠️ Concerns:**
1. **No rate limiting on ride requests** — A user could spam ride requests via the Supabase client
2. **No server-side fare validation** — fare_estimate is calculated client-side and written to DB. A modified client could set fare to $0. Should validate via a database function or Edge Function.
3. **Driver can accept any ride** — The RLS policy allows any authenticated user with the right status to update rides. There's no check that the user's profile.user_type === 'driver'.
4. **No ride request expiry** — Old "requested" rides sit in the DB forever. Should auto-cancel after ~5-10 minutes.

---

## PART 3: TAPRIDE IMPROVEMENT ROADMAP

### Priority 1 (Should Do)
- [ ] Add per-route error boundaries
- [ ] Add ride request expiry (auto-cancel after 10 min)
- [ ] Validate fare server-side (Supabase function/policy)
- [ ] Add RLS check that only drivers can accept rides
- [ ] Add trip sharing (share live ride link with trusted contact)
- [ ] Add SOS/emergency button during active rides

### Priority 2 (Nice to Have)
- [ ] Ride receipt page after completion (downloadable/shareable)
- [ ] Push notifications via Capacitor for ride status changes
- [ ] Driver earnings dashboard (daily/weekly breakdown)
- [ ] Scheduled rides (book a ride for later)
- [ ] Multiple vehicle categories (economy/premium)
- [ ] Ride cancellation policy (fee after X minutes)
- [ ] Admin dashboard (manage users, view analytics)

### Priority 3 (Polish)
- [ ] Skeleton loading states instead of spinners
- [ ] Map loading placeholder
- [ ] Haptic feedback on ride status transitions (rider side)
- [ ] Animated route drawing on map
- [ ] Pull-to-refresh on ride history
- [ ] Offline mode indicator

---

## PART 4: OTHER REPOS AUDIT

### Repos That Need Attention

**1. `Tapiwa` (Personal Site)** — Last updated Mar 29
- Just a landing page, should link to all projects properly
- Check if it's actually deployed and working

**2. `portfolio`** — Linked as main blog URL
- This is the main portfolio site — make sure TapRide is featured

**3. `chikoro-css-dev` / `chikoro-styles`** — Private repos visible in list
- These show as public repos with no description
- Either make them private or add proper descriptions

**4. `ai-context`** — "Private context for AI continuation"
- This should be private, not public. Anyone can see your AI prompts/context.

**5. `tapiwamakandigona.github.io`** — GitHub Pages root
- Make sure this redirects properly to portfolio or is a clean landing page

### Repos That Look Good ✅
- `tapride` — Your best project, well-documented
- `fps-game` — Impressive Three.js work, live demo works
- `zimbet` — Good portfolio piece
- `zimpay` — Clean fintech demo
- `realtime-chat` — Shows Supabase Realtime skills
- `url-shortener` — Solid full-stack piece
- CLI tools (pwgen, http-ping, json-lint, md-preview) — Show versatility

---

## PART 5: ACTION ITEMS FOR WHEN MC WAKES UP

### Immediate (I can do right now):
1. ✅ Rewrite GitHub profile README (honest, clean, TapRide featured)
2. ✅ Check and fix `ai-context` repo visibility
3. ✅ Check all live demo links work

### Needs MC's Input:
4. Do you want me to add SOS/emergency button to TapRide?
5. Do you want me to build a simple admin panel?
6. Which repos do you want cleaned up vs archived?
7. Do you have a Twitter/X or LinkedIn to link in the profile?

### For AOAI (April 9-12):
8. Practice the 5-step transformer workflow today (Apr 6)
9. Set up Kaggle account and practice a submission
10. Test the 10,000 token budget simulation

---

*Report complete. Going to start implementing items 1-3 now.*
