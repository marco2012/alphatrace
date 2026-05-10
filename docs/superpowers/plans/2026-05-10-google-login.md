# Google Login & Cross-Device Portfolio Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Google Sign-In backed by Firebase Auth + Firestore so portfolios sync across devices while anonymous users continue using localStorage exactly as today.

**Architecture:** A new `AuthContext` wraps the app and exposes `user`, `signIn`, `signOut`. `PortfolioContext` reads `user` from `AuthContext`; when non-null all portfolio CRUD goes to Firestore (with an `onSnapshot` listener for real-time cross-device sync), when null it falls back to `localStorage` unchanged. On first sign-in, local portfolios are merged into Firestore.

**Tech Stack:** Firebase 10.x (Auth + Firestore), Next.js 16 static export, TypeScript, React 19

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/firebase.ts` | Firebase app init, exports `auth` and `db` |
| Create | `src/context/auth-context.tsx` | `AuthProvider`, `useAuth` hook — Google sign-in/out, auth state |
| Create | `src/lib/firestore-portfolios.ts` | Typed Firestore CRUD helpers for portfolios |
| Modify | `src/app/layout.tsx` | Add `AuthProvider` wrapping `PortfolioProvider` |
| Modify | `src/context/portfolio-context.tsx` | Route CRUD to Firestore when signed in; merge on first sign-in |
| Modify | `src/components/dashboard/dashboard-layout.tsx` | Sign-in button + user avatar in header |
| Modify | `.github/workflows/deploy.yml` | Pass Firebase env vars during GitHub Actions build |

---

## Task 1: Firebase Project Setup (Manual)

**Files:** none (Firebase Console + local `.env.local`)

- [ ] **Step 1: Create Firebase project**

  Go to https://console.firebase.google.com → "Add project" → name it `alphatrace` → disable Google Analytics → Create.

- [ ] **Step 2: Enable Google Sign-In**

  Firebase Console → Authentication → Sign-in method → Google → Enable → save your support email → Save.

- [ ] **Step 3: Create Firestore database**

  Firebase Console → Firestore Database → Create database → Start in **production mode** → choose a region → Done.

- [ ] **Step 4: Register a web app and copy config**

  Firebase Console → Project settings → "Add app" → Web → name it `alphatrace-web` → Register. Copy the `firebaseConfig` object shown.

- [ ] **Step 5: Create `.env.local`**

  Create `/Users/marco/Development/alphatrace/.env.local` with your values from step 4:

  ```
  NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
  NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
  ```

- [ ] **Step 6: Add `.env.local` to `.gitignore`**

  Open `.gitignore` and confirm `.env.local` is listed (Next.js adds it by default). If not, add it.

- [ ] **Step 7: Install Firebase**

  ```bash
  pnpm add firebase
  ```

  Expected: `dependencies: { firebase: "^10.x.x" }` added to `package.json`.

- [ ] **Step 8: Commit**

  ```bash
  git add package.json pnpm-lock.yaml
  git commit -m "feat: install firebase"
  ```

---

## Task 2: Firebase Init Module

**Files:**
- Create: `src/lib/firebase.ts`

- [ ] **Step 1: Create `src/lib/firebase.ts`**

  ```ts
  import { initializeApp, getApps } from "firebase/app";
  import { getAuth } from "firebase/auth";
  import { getFirestore } from "firebase/firestore";

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

  export const auth = getAuth(app);
  export const db = getFirestore(app);
  ```

- [ ] **Step 2: Verify it compiles**

  ```bash
  pnpm run build 2>&1 | tail -20
  ```

  Expected: build succeeds (or only pre-existing errors, none from `firebase.ts`).

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/firebase.ts
  git commit -m "feat: add Firebase init module"
  ```

---

## Task 3: Auth Context

**Files:**
- Create: `src/context/auth-context.tsx`

- [ ] **Step 1: Create `src/context/auth-context.tsx`**

  ```tsx
  "use client";

  import React, { createContext, useContext, useEffect, useState } from "react";
  import {
    User,
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
  } from "firebase/auth";
  import { auth } from "@/lib/firebase";

  interface AuthContextType {
    user: User | null;
    authLoading: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
  }

  const AuthContext = createContext<AuthContextType>({
    user: null,
    authLoading: true,
    signIn: async () => {},
    signOut: async () => {},
  });

  export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthLoading(false);
      });
      return unsubscribe;
    }, []);

    const signIn = async () => {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    };

    const signOut = async () => {
      await firebaseSignOut(auth);
    };

    return (
      <AuthContext.Provider value={{ user, authLoading, signIn, signOut }}>
        {children}
      </AuthContext.Provider>
    );
  }

  export const useAuth = () => useContext(AuthContext);
  ```

- [ ] **Step 2: Wrap app in `AuthProvider` — modify `src/app/layout.tsx`**

  Find:
  ```tsx
  import { PortfolioProvider } from "@/context/portfolio-context";
  ```

  Replace with:
  ```tsx
  import { PortfolioProvider } from "@/context/portfolio-context";
  import { AuthProvider } from "@/context/auth-context";
  ```

  Find:
  ```tsx
          <PortfolioProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </PortfolioProvider>
  ```

  Replace with:
  ```tsx
          <AuthProvider>
            <PortfolioProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </PortfolioProvider>
          </AuthProvider>
  ```

- [ ] **Step 3: Verify build**

  ```bash
  pnpm run build 2>&1 | tail -20
  ```

  Expected: build succeeds.

- [ ] **Step 4: Commit**

  ```bash
  git add src/context/auth-context.tsx src/app/layout.tsx
  git commit -m "feat: add AuthContext with Google sign-in"
  ```

---

## Task 4: Firestore Portfolio Helpers

**Files:**
- Create: `src/lib/firestore-portfolios.ts`

- [ ] **Step 1: Create `src/lib/firestore-portfolios.ts`**

  ```ts
  import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    onSnapshot,
    Unsubscribe,
  } from "firebase/firestore";
  import { db } from "@/lib/firebase";
  import { SavedPortfolio } from "@/context/portfolio-context";

  function portfoliosRef(uid: string) {
    return collection(db, "users", uid, "portfolios");
  }

  export async function fetchCloudPortfolios(uid: string): Promise<SavedPortfolio[]> {
    const snap = await getDocs(portfoliosRef(uid));
    return snap.docs.map((d) => d.data() as SavedPortfolio);
  }

  export async function upsertPortfolio(uid: string, portfolio: SavedPortfolio): Promise<void> {
    const ref = doc(db, "users", uid, "portfolios", portfolio.id);
    await setDoc(ref, portfolio);
  }

  export async function removePortfolio(uid: string, id: string): Promise<void> {
    await deleteDoc(doc(db, "users", uid, "portfolios", id));
  }

  export function subscribePortfolios(
    uid: string,
    onUpdate: (portfolios: SavedPortfolio[]) => void
  ): Unsubscribe {
    return onSnapshot(portfoliosRef(uid), (snap) => {
      onUpdate(snap.docs.map((d) => d.data() as SavedPortfolio));
    });
  }
  ```

- [ ] **Step 2: Verify build**

  ```bash
  pnpm run build 2>&1 | tail -20
  ```

  Expected: build succeeds.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/firestore-portfolios.ts
  git commit -m "feat: add Firestore portfolio CRUD helpers"
  ```

---

## Task 5: Wire Firestore into Portfolio Context

**Files:**
- Modify: `src/context/portfolio-context.tsx`

This task has the most changes. Make them section by section.

- [ ] **Step 1: Add imports at the top of `src/context/portfolio-context.tsx`**

  Find the existing import block (around line 1–20). Add these two imports after the existing imports:

  ```ts
  import { useAuth } from "@/context/auth-context";
  import {
    fetchCloudPortfolios,
    upsertPortfolio,
    removePortfolio,
    subscribePortfolios,
  } from "@/lib/firestore-portfolios";
  ```

- [ ] **Step 2: Add Firestore unsubscribe ref inside `PortfolioProvider`**

  Inside the `PortfolioProvider` function body, immediately after the existing `useState` declarations, add:

  ```ts
  const { user } = useAuth();
  const firestoreUnsubRef = React.useRef<(() => void) | null>(null);
  const portfoliosForSignoutRef = React.useRef<SavedPortfolio[]>([]);
  ```

- [ ] **Step 3: Keep portfoliosForSignoutRef in sync with state**

  Find the `useEffect` that loads portfolios from localStorage on mount (searches for `alphatrace_portfolios` around line 390). Just before or after that effect, add:

  ```ts
  // Keep a ref to current portfolios so sign-out can persist them to localStorage
  useEffect(() => {
    portfoliosForSignoutRef.current = savedPortfolios;
  }, [savedPortfolios]);
  ```

- [ ] **Step 4: Add the Firestore sync effect**

  Add this new `useEffect` after the ref sync effect from Step 3:

  ```ts
  useEffect(() => {
    if (!user) {
      // User signed out: cancel listener, persist to localStorage
      if (firestoreUnsubRef.current) {
        firestoreUnsubRef.current();
        firestoreUnsubRef.current = null;
      }
      localStorage.setItem(
        "alphatrace_portfolios",
        JSON.stringify(portfoliosForSignoutRef.current)
      );
      return;
    }

    // User signed in: merge local + cloud, then subscribe
    const merge = async () => {
      const local = portfoliosForSignoutRef.current;
      const cloud = await fetchCloudPortfolios(user.uid);
      const cloudIds = new Set(cloud.map((p) => p.id));
      const toUpload = local.filter((p) => !cloudIds.has(p.id));

      await Promise.all(toUpload.map((p) => upsertPortfolio(user.uid, p)));

      localStorage.removeItem("alphatrace_portfolios");

      firestoreUnsubRef.current = subscribePortfolios(user.uid, (portfolios) => {
        setSavedPortfolios(portfolios);
      });
    };

    merge();

    return () => {
      if (firestoreUnsubRef.current) {
        firestoreUnsubRef.current();
      }
    };
  }, [user]);
  ```

- [ ] **Step 5: Route `savePortfolio` writes to Firestore**

  Find the `savePortfolio` function. It currently ends with:
  ```ts
  setSavedPortfolios(updated);
  localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
  ```

  There are two branches (update existing + create new). In **both** branches, replace the `localStorage.setItem(...)` line with:
  ```ts
  if (user) {
    upsertPortfolio(user.uid, newOrUpdatedPortfolio);
  } else {
    localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
  }
  ```

  Where `newOrUpdatedPortfolio` is the portfolio object being saved in that branch (the updated `p` in the update branch, or `newPortfolio` in the create branch).

- [ ] **Step 6: Route `saveCustomPortfolio` writes to Firestore**

  Find `saveCustomPortfolio`. It currently ends with:
  ```ts
  setSavedPortfolios(updated);
  localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
  ```

  Replace the `localStorage.setItem(...)` line with:
  ```ts
  if (user) {
    upsertPortfolio(user.uid, newPortfolio);
  } else {
    localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
  }
  ```

- [ ] **Step 7: Route `deletePortfolio` to Firestore**

  Find `deletePortfolio`. It currently ends with:
  ```ts
  setSavedPortfolios(updated);
  localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
  ```

  Replace the `localStorage.setItem(...)` line with:
  ```ts
  if (user) {
    removePortfolio(user.uid, id);
  } else {
    localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
  }
  ```

- [ ] **Step 8: Route `togglePortfolioHighlight` to Firestore**

  Find `togglePortfolioHighlight`. It currently ends with:
  ```ts
  setSavedPortfolios(updated);
  localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
  ```

  Replace the `localStorage.setItem(...)` line with:
  ```ts
  if (user) {
    const toggled = updated.find((p) => p.id === id);
    if (toggled) upsertPortfolio(user.uid, toggled);
  } else {
    localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
  }
  ```

- [ ] **Step 9: Verify build**

  ```bash
  pnpm run build 2>&1 | tail -20
  ```

  Expected: build succeeds with no TypeScript errors.

- [ ] **Step 10: Commit**

  ```bash
  git add src/context/portfolio-context.tsx
  git commit -m "feat: route portfolio CRUD to Firestore when signed in"
  ```

---

## Task 6: Sign-In UI in Header

**Files:**
- Modify: `src/components/dashboard/dashboard-layout.tsx`

- [ ] **Step 1: Add imports to `dashboard-layout.tsx`**

  Find the existing import block. Add:

  ```tsx
  import { useAuth } from "@/context/auth-context";
  import { LogIn, LogOut } from "lucide-react";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import Image from "next/image";
  ```

- [ ] **Step 2: Consume `useAuth` inside the component**

  Find the component function body. After existing hook calls (e.g., `usePortfolio()`), add:

  ```tsx
  const { user, signIn, signOut } = useAuth();
  ```

- [ ] **Step 3: Add sign-in / avatar to the header**

  In `dashboard-layout.tsx`, find the header's right-side `div` at line ~164:

  ```tsx
  <div className="flex items-center gap-2">
  ```

  Inside that `div`, add at the end (after existing children):

  ```tsx
  {user ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt={user.displayName ?? "User"}
              width={28}
              height={28}
              className="rounded-full"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {user.displayName?.[0] ?? "U"}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          {user.email}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <button
      onClick={signIn}
      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
    >
      <LogIn className="h-3.5 w-3.5" />
      Sign in
    </button>
  )}
  ```

- [ ] **Step 4: Verify build**

  ```bash
  pnpm run build 2>&1 | tail -20
  ```

  Expected: build succeeds.

- [ ] **Step 5: Manual smoke test**

  ```bash
  pnpm run dev
  ```

  Open http://localhost:3000. Verify:
  - "Sign in" button is visible in the header
  - Clicking it opens a Google OAuth popup
  - After sign-in, avatar and email appear in a dropdown
  - "Sign out" works and returns to the "Sign in" button

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/dashboard/dashboard-layout.tsx
  git commit -m "feat: add Google sign-in button and user avatar to header"
  ```

---

## Task 7: Firestore Security Rules

**Files:** none (Firebase Console)

- [ ] **Step 1: Set security rules**

  Firebase Console → Firestore Database → Rules → replace the content with:

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

  Click **Publish**.

- [ ] **Step 2: Verify rules are active**

  Firebase Console → Firestore → Rules → confirm "Published" timestamp is current.

---

## Task 8: GitHub Actions — Firebase Env Vars

**Files:**
- Modify: `.github/workflows/deploy.yml`

Without this task, the GitHub Pages build won't have Firebase config and the production site will fail to initialise Firebase.

- [ ] **Step 1: Add secrets in GitHub**

  Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret. Add one secret for each line in `.env.local`:

  - `FIREBASE_API_KEY`
  - `FIREBASE_AUTH_DOMAIN`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_STORAGE_BUCKET`
  - `FIREBASE_MESSAGING_SENDER_ID`
  - `FIREBASE_APP_ID`

- [ ] **Step 2: Pass secrets in `deploy.yml`**

  Find:
  ```yaml
      - name: Build (static export)
        env:
          NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
        run: pnpm run build
  ```

  Replace with:
  ```yaml
      - name: Build (static export)
        env:
          NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          NEXT_PUBLIC_FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
        run: pnpm run build
  ```

- [ ] **Step 3: Add authorised domain in Firebase**

  Firebase Console → Authentication → Settings → Authorised domains → Add your GitHub Pages domain (e.g. `marco2012.github.io`).

  Without this step, `signInWithPopup` will be blocked on the deployed site.

- [ ] **Step 4: Commit and push**

  ```bash
  git add .github/workflows/deploy.yml
  git commit -m "feat: pass Firebase env vars in GitHub Actions build"
  git push
  ```

  Expected: GitHub Actions runs successfully, deployed site shows "Sign in" button and Google auth works.

---

## Task 9: Cross-Device Sync Smoke Test

- [ ] **Step 1: Sign in on Device A**

  Open the app. Sign in with Google. Create a portfolio named "Test Portfolio".

- [ ] **Step 2: Verify sync on Device B (or incognito tab)**

  Open the app in a different browser or incognito window. Sign in with the same Google account. Verify "Test Portfolio" appears immediately.

- [ ] **Step 3: Test sign-out persistence**

  Sign out on Device A. Verify "Test Portfolio" is still visible (written back to localStorage). Sign in again — verify cloud portfolios reload correctly.

- [ ] **Step 4: Test anonymous flow still works**

  Open a fresh incognito tab. Without signing in, create a portfolio. Verify it saves and reloads correctly from localStorage (no Firebase errors in the browser console).
