"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Report, ReportSection } from "@/types";

const TIME_RANGE_LABELS: Record<string, string> = {
  "3months": "3 months",
  "6months": "6 months",
  "1year": "1 year",
  "2years": "2 years",
};

const SECTION_ICONS: Record<string, string> = {
  actionsAndResults: "M3 8.5l3.5 3.5L13 5",
  strategiesAndPatterns: "M2 4h12M2 8h8M2 12h10",
  whatsWorking: "M8 2v4M8 10v4M4 6h8M4 10h8",
  whatFailed: "M4 4l8 8M12 4L4 12",
  keyTakeaways: "M8 2l2 4h4l-3 3 1 5-4-2.5L4 14l1-5-3-3h4z",
};

const SECTION_ORDER = [
  "actionsAndResults",
  "strategiesAndPatterns",
  "whatsWorking",
  "whatFailed",
  "keyTakeaways",
] as const;

function ExternalLinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="shrink-0"
    >
      <path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" />
    </svg>
  );
}

function SectionBlock({
  sectionKey,
  section,
  index,
}: {
  sectionKey: string;
  section: ReportSection;
  index: number;
}) {
  const iconPath = SECTION_ICONS[sectionKey] || SECTION_ICONS.keyTakeaways;

  return (
    <section
      className="animate-fade-in"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Section header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-2 border border-border">
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-accent"
          >
            <path d={iconPath} />
          </svg>
        </div>
        <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-foreground">
          {section.title}
        </h2>
      </div>

      {/* Insights */}
      <div className="space-y-0 border-l border-border ml-3.5 pl-6">
        {section.insights.map((insight, i) => (
          <div
            key={i}
            className="relative py-3 first:pt-0 last:pb-0"
          >
            {/* Dot on the timeline */}
            <div className="absolute -left-[27px] top-[17px] first:top-[3px] h-1.5 w-1.5 rounded-full bg-border" />

            <p className="text-[15px] leading-relaxed text-foreground/90">
              {insight.text}
            </p>

            {insight.sourceUrls.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {insight.sourceUrls.map((url, j) => (
                  <a
                    key={j}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors"
                    title={url}
                  >
                    <ExternalLinkIcon />
                    <span>
                      source{insight.sourceUrls.length > 1 ? ` ${j + 1}` : ""}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/reports/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setReport(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto h-5 w-5">
            <div className="absolute inset-0 rounded-full border-2 border-border" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
          </div>
          <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted">
            Loading report
          </p>
        </div>
      </div>
    );
  }

  // 404 state
  if (notFound || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="font-mono text-6xl font-semibold text-border">404</p>
          <p className="mt-3 text-sm text-muted">Report not found.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 font-mono text-xs uppercase tracking-wider text-accent hover:text-accent-dim transition-colors"
          >
            &larr; Back to start
          </button>
        </div>
      </div>
    );
  }

  const createdDate = new Date(report.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const platforms: string[] = [];
  if (report.linkedinUrl) platforms.push("LinkedIn");
  if (report.twitterHandle) platforms.push("Twitter");

  return (
    <div className="min-h-screen px-4 py-12 md:py-20">
      <div className="mx-auto max-w-2xl">
        {/* Navigation */}
        <button
          onClick={() => router.push("/")}
          className="mb-10 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-accent transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M10 3L5 8l5 5" />
          </svg>
          New analysis
        </button>

        {/* Header */}
        <header className="mb-12 animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {report.personName}
          </h1>
          {report.personHeadline && (
            <p className="mt-1.5 text-base text-muted">
              {report.personHeadline}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wider text-muted">
            <span>{platforms.join(" + ")}</span>
            <span className="text-border">|</span>
            <span>{TIME_RANGE_LABELS[report.timeRange] || report.timeRange}</span>
            <span className="text-border">|</span>
            <span>{report.totalPostsAnalyzed} posts analyzed</span>
            <span className="text-border">|</span>
            <span>{createdDate}</span>
          </div>

          <div className="mt-6 h-px bg-border" />
        </header>

        {/* Sections */}
        <div className="space-y-12">
          {SECTION_ORDER.map((key, index) => {
            const section = report.sections[key];
            if (!section || section.insights.length === 0) return null;
            return (
              <SectionBlock
                key={key}
                sectionKey={key}
                section={section}
                index={index}
              />
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-border pt-6 pb-12">
          <div className="flex items-center justify-between text-xs text-muted">
            <button
              onClick={() => router.push("/")}
              className="font-mono uppercase tracking-wider hover:text-accent transition-colors"
            >
              &larr; New analysis
            </button>
            <span className="font-mono uppercase tracking-wider">
              Keeping Tabs
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
