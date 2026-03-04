# Password Protection Design

## Overview

Gate the entire app behind a simple key-based auth. No login form — access is granted via a URL param (`?key=secret`) which persists in localStorage.

## How It Works

1. **Env var** `ACCESS_KEY` holds the secret on the server
2. **URL param unlock**: Visiting any page with `?key=<secret>` stores the key in localStorage and redirects to the clean URL
3. **Client auth wrapper**: On every page load, checks localStorage for the key, validates it against `/api/auth/verify`
4. **Access denied screen**: If invalid/missing key → minimal "Access Denied" message, no login form, no hints
5. **API protection**: All API routes (`/api/analyze`, `/api/reports/[id]`) require the key via `x-access-key` header. Client sends it from localStorage on every request.

## Components

### `/api/auth/verify` (GET)
- Accepts `x-access-key` header
- Returns `{ valid: true }` or `{ valid: false }`
- Compares against `ACCESS_KEY` env var

### `AuthGate` client component
- Wraps app content in `layout.tsx`
- On mount: checks URL for `?key=` param → stores in localStorage → strips param from URL
- Validates key against `/api/auth/verify`
- Shows loading state during validation
- Shows "Access Denied" if invalid
- Renders children if valid

### API route middleware helper
- Shared `validateAccessKey(request)` function
- Reads from `x-access-key` header
- Used in `/api/analyze` and `/api/reports/[id]`

### Client-side API calls
- Add `x-access-key` header (from localStorage) to all fetch/axios calls

## Security Notes

- This is a simple gate, not enterprise auth. It's sufficient to keep random visitors out.
- The key is visible in localStorage and network requests — acceptable for this use case.
- No rate limiting on the verify endpoint (low risk given no login form).
