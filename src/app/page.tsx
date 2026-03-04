"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TimeRange } from "@/types";
import { getAccessKey } from "@/components/AuthGate";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "3months", label: "3 months" },
  { value: "6months", label: "6 months" },
  { value: "1year", label: "1 year" },
  { value: "2years", label: "2 years" },
];

const PROGRESS_PHASES = [
  "Fetching posts from social profiles...",
  "Reading through the content...",
  "Extracting actions and outcomes...",
  "Identifying patterns and strategies...",
  "Synthesizing the report...",
];

export default function Home() {
  const router = useRouter();
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("6months");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressPhase, setProgressPhase] = useState(0);
  const [pastReports, setPastReports] = useState<
    { id: string; personName: string; createdAt: string }[]
  >([]);

  useEffect(() => {
    fetch("/api/reports", {
      headers: { "x-access-key": getAccessKey() || "" },
    })
      .then((res) => res.json())
      .then(setPastReports)
      .catch(() => {});
  }, []);

  const hasInput = linkedinUrl.trim() || twitterHandle.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasInput) {
      setError("Enter at least one LinkedIn URL or Twitter handle.");
      return;
    }
    setError(null);
    setLoading(true);
    setProgressPhase(0);

    // Cycle through progress phases to give a sense of progress
    const interval = setInterval(() => {
      setProgressPhase((prev) =>
        prev < PROGRESS_PHASES.length - 1 ? prev + 1 : prev
      );
    }, 8000);

    try {
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

      const data = await res.json();
      clearInterval(interval);

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      router.push(`/report/${data.reportId}`);
    } catch {
      clearInterval(interval);
      setError("Network error. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Ambient glow behind the form */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full bg-accent/[0.03] blur-[120px]" />

      <main className="relative w-full max-w-md stagger">
        {/* Logo / Title */}
        <div className="mb-12 text-center">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            Keeping Tabs
          </h1>
          <p className="mt-2 text-sm text-muted">
            Distill competitor posts into actionable lessons
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* LinkedIn */}
          <div>
            <label
              htmlFor="linkedin"
              className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted"
            >
              LinkedIn
            </label>
            <input
              id="linkedin"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/username"
              disabled={loading}
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-accent/50 focus:bg-surface-2 disabled:opacity-50"
            />
          </div>

          {/* Twitter */}
          <div>
            <label
              htmlFor="twitter"
              className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted"
            >
              Twitter / X
            </label>
            <input
              id="twitter"
              type="text"
              value={twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value)}
              placeholder="@handle"
              disabled={loading}
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-accent/50 focus:bg-surface-2 disabled:opacity-50"
            />
          </div>

          {/* Time range */}
          <div>
            <label
              htmlFor="timeRange"
              className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted"
            >
              Time Range
            </label>
            <div className="relative">
              <select
                id="timeRange"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                disabled={loading}
                className="w-full appearance-none rounded-md border border-border bg-surface px-3.5 py-2.5 pr-10 text-sm text-foreground transition-colors focus:border-accent/50 focus:bg-surface-2 disabled:opacity-50"
              >
                {TIME_RANGES.map((tr) => (
                  <option key={tr.value} value={tr.value}>
                    {tr.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="animate-fade-in rounded-md border border-red-900/40 bg-red-950/30 px-3.5 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !hasInput}
            className="group w-full rounded-md bg-accent px-4 py-2.5 font-mono text-sm font-medium text-background transition-all hover:bg-accent-dim active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </form>

        {/* Loading state */}
        {loading && (
          <div className="animate-fade-in mt-8 rounded-md border border-border bg-surface p-5">
            <div className="mb-4 flex items-center gap-2.5">
              {/* Spinner */}
              <div className="relative h-4 w-4">
                <div className="absolute inset-0 rounded-full border-2 border-border" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
              </div>
              <span className="font-mono text-xs uppercase tracking-wider text-muted">
                Working
              </span>
            </div>

            {/* Progress phases */}
            <div className="space-y-2">
              {PROGRESS_PHASES.map((phase, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 text-sm transition-all duration-500 ${
                    i < progressPhase
                      ? "text-muted"
                      : i === progressPhase
                        ? "text-foreground"
                        : "text-muted/30"
                  }`}
                >
                  {i < progressPhase ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="shrink-0 text-accent"
                    >
                      <path d="M3 8.5l3.5 3.5L13 5" />
                    </svg>
                  ) : i === progressPhase ? (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent animate-pulse-slow" />
                  ) : (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                  )}
                  <span>{phase}</span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-muted">
              This usually takes 30-60 seconds.
            </p>
          </div>
        )}

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-muted/50">
          At least one profile required. Both recommended for deeper analysis.
        </p>

        {/* Past reports */}
        {pastReports.length > 0 && (
          <div className="mt-12 border-t border-border pt-8">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-muted">
              Past Reports
            </h2>
            <div className="space-y-2">
              {pastReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface text-sm transition-colors hover:border-accent/30 hover:bg-surface-2"
                >
                  <Link
                    href={`/report/${report.id}`}
                    className="flex flex-1 items-center justify-between px-3.5 py-2.5"
                  >
                    <span className="text-foreground">{report.personName}</span>
                    <span className="font-mono text-xs text-muted">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/reports/${report.id}`, {
                        method: "DELETE",
                        headers: { "x-access-key": getAccessKey() || "" },
                      });
                      if (res.ok) {
                        setPastReports((prev) =>
                          prev.filter((r) => r.id !== report.id)
                        );
                      }
                    }}
                    className="shrink-0 px-2.5 py-2.5 text-muted hover:text-red-400 transition-colors"
                    title="Delete report"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M4 4l8 8M12 4L4 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
