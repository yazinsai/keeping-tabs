# Password Protection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gate the app behind a key-based auth using a URL param + localStorage persistence.

**Architecture:** A shared `validateAccessKey()` helper protects API routes. An `AuthGate` client component wraps all pages — it checks localStorage, validates via `/api/auth/verify`, and blocks rendering if unauthorized. First visit with `?key=secret` stores the key in localStorage and strips the param.

**Tech Stack:** Next.js API routes, React client component, localStorage

---

### Task 1: Add ACCESS_KEY env var

**Files:**
- Modify: `.env:4` (add new line)
- Modify: `.env.example:4` (add new line)

**Step 1: Add env var to both files**

Add to `.env`:
```
ACCESS_KEY=kt-2026-s3cr3t
```

Add to `.env.example`:
```
ACCESS_KEY=your_access_key
```

**Step 2: Set env var on dokku**

Run:
```bash
ssh dokku@dokku-server config:set keeping-tabs ACCESS_KEY=kt-2026-s3cr3t
```

**Step 3: Commit**

```bash
git add .env.example
git commit -m "feat: add ACCESS_KEY env var for password protection"
```

Note: Do NOT commit `.env`.

---

### Task 2: Create shared access key validation helper

**Files:**
- Create: `src/lib/auth.ts`

**Step 1: Write the helper**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function validateAccessKey(request: NextRequest): boolean {
  const key = request.headers.get('x-access-key');
  const expected = process.env.ACCESS_KEY;
  if (!expected) return true; // No key configured = no protection
  return key === expected;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add access key validation helper"
```

---

### Task 3: Create `/api/auth/verify` endpoint

**Files:**
- Create: `src/app/api/auth/verify/route.ts`

**Step 1: Write the endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateAccessKey } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const valid = validateAccessKey(request);
  return NextResponse.json({ valid });
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/verify/route.ts
git commit -m "feat: add auth verify API endpoint"
```

---

### Task 4: Protect existing API routes

**Files:**
- Modify: `src/app/api/analyze/route.ts:1-11` (add auth check at top of POST handler)
- Modify: `src/app/api/reports/[id]/route.ts:1-8` (add auth check at top of GET handler)

**Step 1: Add auth guard to `/api/analyze`**

Add import at top:
```typescript
import { validateAccessKey, unauthorizedResponse } from '@/lib/auth';
```

Add as first line inside the `POST` function body (before the try block):
```typescript
  if (!validateAccessKey(request)) return unauthorizedResponse();
```

**Step 2: Add auth guard to `/api/reports/[id]`**

Add import at top:
```typescript
import { validateAccessKey, unauthorizedResponse } from '@/lib/auth';
```

Add as first line inside the `GET` function body (before the `const { id }` line):
```typescript
  if (!validateAccessKey(_request)) return unauthorizedResponse();
```

Note: The reports route already has `_request` as the param name — rename it to `request` since we're now using it.

**Step 3: Commit**

```bash
git add src/app/api/analyze/route.ts src/app/api/reports/[id]/route.ts
git commit -m "feat: protect API routes with access key validation"
```

---

### Task 5: Create AuthGate client component

**Files:**
- Create: `src/components/AuthGate.tsx`

**Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

const STORAGE_KEY = "kt-access-key";

export function getAccessKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "authorized" | "denied">("checking");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      // 1. Check URL param — store and strip
      const keyParam = searchParams.get("key");
      if (keyParam) {
        localStorage.setItem(STORAGE_KEY, keyParam);
        // Strip ?key= from URL
        const params = new URLSearchParams(searchParams.toString());
        params.delete("key");
        const qs = params.toString();
        router.replace(pathname + (qs ? `?${qs}` : ""));
      }

      // 2. Get key from localStorage
      const key = keyParam || localStorage.getItem(STORAGE_KEY);
      if (!key) {
        setStatus("denied");
        return;
      }

      // 3. Validate against server
      try {
        const res = await fetch("/api/auth/verify", {
          headers: { "x-access-key": key },
        });
        const data = await res.json();
        setStatus(data.valid ? "authorized" : "denied");
        if (!data.valid) {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        setStatus("denied");
      }
    }

    checkAuth();
  }, [searchParams, router, pathname]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="relative h-5 w-5">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm text-muted">Access denied</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

**Step 2: Commit**

```bash
git add src/components/AuthGate.tsx
git commit -m "feat: add AuthGate client component with localStorage persistence"
```

---

### Task 6: Wire AuthGate into layout

**Files:**
- Modify: `src/app/layout.tsx:1-34`

**Step 1: Wrap children with AuthGate**

Add import:
```typescript
import AuthGate from "@/components/AuthGate";
```

Wrap `{children}` inside `<body>`:
```tsx
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
  <AuthGate>{children}</AuthGate>
</body>
```

Note: `AuthGate` uses `useSearchParams()` which requires a Suspense boundary in Next.js. Wrap it:
```tsx
import { Suspense } from "react";

<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
  <Suspense>
    <AuthGate>{children}</AuthGate>
  </Suspense>
</body>
```

**Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wire AuthGate into root layout"
```

---

### Task 7: Add access key header to client-side API calls

**Files:**
- Modify: `src/app/page.tsx:51-59` (the fetch call in handleSubmit)
- Modify: `src/app/report/[id]/page.tsx:134` (the fetch call in fetchReport)

**Step 1: Update the analyze fetch in `page.tsx`**

Import `getAccessKey` from AuthGate:
```typescript
import { getAccessKey } from "@/components/AuthGate";
```

Update the fetch call:
```typescript
const res = await fetch("/api/analyze", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-access-key": getAccessKey() || "",
  },
  body: JSON.stringify({
    linkedinUrl: linkedinUrl.trim() || undefined,
    twitterHandle: twitterHandle.trim() || undefined,
    timeRange,
  }),
});
```

**Step 2: Update the report fetch in `report/[id]/page.tsx`**

Import `getAccessKey`:
```typescript
import { getAccessKey } from "@/components/AuthGate";
```

Update the fetch call:
```typescript
const res = await fetch(`/api/reports/${id}`, {
  headers: { "x-access-key": getAccessKey() || "" },
});
```

**Step 3: Commit**

```bash
git add src/app/page.tsx src/app/report/[id]/page.tsx
git commit -m "feat: send access key header on all client API calls"
```

---

### Task 8: Verify locally

**Step 1: Run dev server**

```bash
cd /Users/rock/ai/projects/keeping-tabs && bun run dev
```

**Step 2: Test denied state**

Open `http://localhost:3000` — should show "Access denied".

**Step 3: Test unlock via URL param**

Open `http://localhost:3000?key=kt-2026-s3cr3t` — should redirect to clean URL and show the app.

**Step 4: Test persistence**

Refresh `http://localhost:3000` (no param) — should still show the app (key is in localStorage).

**Step 5: Test API protection**

```bash
curl http://localhost:3000/api/auth/verify
# Should return { "valid": false }

curl -H "x-access-key: kt-2026-s3cr3t" http://localhost:3000/api/auth/verify
# Should return { "valid": true }
```

---

### Task 9: Deploy

**Step 1: Commit any remaining changes and push**

```bash
git push dokku main
```

**Step 2: Verify the deployed app**

Open `https://keeping-tabs.whhite.com?key=kt-2026-s3cr3t` — should work.
Open `https://keeping-tabs.whhite.com` in incognito — should show "Access denied".
