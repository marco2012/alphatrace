# Google Login & Cross-Device Portfolio Sync — Design Spec

**Date:** 2026-05-09  
**Status:** Approved

---

## Overview

Add optional Google Sign-In so users can save and sync portfolios across devices. Anonymous users continue to use the app exactly as today (localStorage). Signed-in users get Firestore as their storage backend with real-time sync.

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/lib/firebase.ts` | Firebase app initialisation (Auth + Firestore client SDK) |
| `src/context/auth-context.tsx` | `AuthProvider` + `useAuth` hook — exposes `user`, `signIn()`, `signOut()` |

### Modified files

| File | Change |
|------|--------|
| `src/context/portfolio-context.tsx` | Read `user` from `AuthContext`; route all portfolio CRUD to Firestore when signed in, `localStorage` when not |
| `src/app/layout.tsx` | Wrap app with `AuthProvider` (outside `PortfolioProvider`) |
| `src/components/dashboard/dashboard-layout.tsx` | Add sign-in button / user avatar to header |

### Provider nesting order

```
AuthProvider
  └─ PortfolioProvider   ← reads user from AuthContext
       └─ app
```

---

## Firestore Data Model

```
users/{uid}/portfolios/{portfolioId}
  id:          string         (equals doc ID)
  name:        string
  weights:     map<string, number>
  highlighted: boolean
  createdAt:   timestamp
```

Each user has a private subcollection. Security rules enforce `request.auth.uid == userId` — no cross-user reads or writes are possible.

---

## Storage Routing

| Auth state | Read source | Write target |
|-----------|------------|-------------|
| Signed out | `localStorage` | `localStorage` |
| Signed in | Firestore (`onSnapshot`) | Firestore |

When signed in, a single `onSnapshot` listener on `users/{uid}/portfolios` drives React state. All `savePortfolio`, `saveCustomPortfolio`, `deletePortfolio`, and `togglePortfolioHighlight` calls write directly to Firestore — the listener reflects changes back into state, including changes from other devices.

---

## First Sign-In Merge

1. Fetch local portfolios from `localStorage`.
2. Fetch cloud portfolios from Firestore (one-time read).
3. Match by `id`: cloud portfolio wins if IDs collide.
4. Any local portfolio whose `id` is not in the cloud set is uploaded to Firestore.
5. Write merged set to Firestore, update React state.
6. Clear `alphatrace_portfolios` from `localStorage`.

---

## Sign-Out

1. Cancel the `onSnapshot` listener.
2. Write current portfolios back to `localStorage` (user still sees their portfolios anonymously).
3. State falls back to `localStorage` path.

---

## UI

### Header (dashboard-layout.tsx)

- **Signed out:** outline "Sign in with Google" button with Google logo icon — placed in the top-right of the header.
- **Signed in:** user's Google profile photo (small avatar) + display name. Clicking opens a dropdown with a "Sign out" option.

### Sync indicator

- Small cloud icon next to the portfolio list header.
- Filled = synced. Spinner overlay = Firestore write in flight.
- Error toast only on sync failure — no success spam.

### No forced login

The app is fully functional without signing in. The sign-in affordance is visible but not intrusive. No paywalls, modals, or redirects.

---

## Firebase Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/portfolios/{portfolioId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Dependencies to Add

```
firebase  (^10.x)
```

No server-side packages. The Firebase client SDK works with the static GitHub Pages export.

---

## Out of Scope

- Email/password or other OAuth providers
- Sharing portfolios between users
- Server-side rendering or API routes
- Offline conflict resolution beyond the first-sign-in merge
