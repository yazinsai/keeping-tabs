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
