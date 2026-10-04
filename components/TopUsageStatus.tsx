"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isProviderUsageId } from "@/lib/provider-usage-ids";

type UsageBucket = {
  id: string;
  label: string;
  used?: number;
  remaining?: number;
  unit: "percent" | "currency" | "count";
  currency?: string;
  windowMinutes?: number;
  resetsAt?: number;
};
type UsageMetric = { id: string; label: string; value: number | string; unit?: string; currency?: string };
type UsageReport = { capturedAt: number; buckets: UsageBucket[]; metrics: UsageMetric[] };
type UsageResponse = { status: string; report?: UsageReport };
type TodayUsage = { used: number; currency?: string };
type ModelRef = { provider: string; modelId: string };

const REFRESH_MS = 5 * 60 * 1000;

type UsageCacheEntry = {
  snapshot: UsageResponse;
  todayUsage: TodayUsage | null;
  updatedAt: number;
};

// Keep the last successful result per provider. Switching sessions can briefly
// make the model unavailable; the toolbar must not blink or wait for network.
const usageCache = new Map<string, UsageCacheEntry>();

function compactAmount(value: number | string | undefined, currency?: string): string {
  if (value === undefined || value === "") return "--";
  const prefix = currency === "CNY" ? "¥" : "$";
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `${prefix}${numeric.toFixed(2)}` : String(value);
}

function resetIn(seconds: number | undefined, now: number): string | null {
  if (!seconds) return null;
  const total = Math.max(0, seconds - Math.floor(now / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function bucketPercent(bucket: UsageBucket): number | null {
  const value = bucket.remaining ?? (bucket.used === undefined ? undefined : 100 - bucket.used);
  return value === undefined ? null : Math.round(Math.max(0, Math.min(100, value)));
}

function TopUsageStatus({ model, sessionCost = 0 }: {
  model: ModelRef | null;
  sessionCost?: number;
}) {
  const providerId = model?.provider ?? "";
  const supported = isProviderUsageId(providerId);
  const cached = usageCache.get(providerId);
  const [snapshot, setSnapshot] = useState<UsageResponse | null>(() => cached?.snapshot ?? null);
  const [todayUsage, setTodayUsage] = useState<TodayUsage | null>(() => cached?.todayUsage ?? null);
  const [querying, setQuerying] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inFlightProviderRef = useRef<string | null>(null);
  const requestVersionRef = useRef(0);

  const query = useCallback(async () => {
    if (!supported || inFlightProviderRef.current === providerId) return;
    inFlightProviderRef.current = providerId;
    const requestVersion = ++requestVersionRef.current;
    setQuerying(true);
    try {
      const usageResponse = await fetch("/api/provider-usage/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const result = await usageResponse.json() as UsageResponse;
      if (usageResponse.ok && result.status === "ready") {
        const todayMetric = result.report?.metrics.find((metric) => metric.id === "today");
        const todayValue = todayMetric ? Number(todayMetric.value) : NaN;
        const nextToday = Number.isFinite(todayValue)
          ? { used: todayValue, currency: todayMetric?.currency }
          : null;
        usageCache.set(providerId, { snapshot: result, todayUsage: nextToday, updatedAt: Date.now() });
        if (requestVersionRef.current === requestVersion) {
          setSnapshot(result);
          setTodayUsage(nextToday);
        }
      }
    } catch {
      // Usage is supplemental; leave the last successful snapshot visible.
    } finally {
      if (inFlightProviderRef.current === providerId) {
        inFlightProviderRef.current = null;
        if (requestVersionRef.current === requestVersion) setQuerying(false);
      }
    }
  }, [providerId, supported]);

  useEffect(() => {
    requestVersionRef.current += 1;
    setQuerying(false);
    const entry = usageCache.get(providerId);
    setSnapshot(entry?.snapshot ?? null);
    setTodayUsage(entry?.todayUsage ?? null);
    setNow(Date.now());
    if (!supported) return;

    // Show cached data immediately and only refresh automatically when it is
    // older than five minutes. A manual button below always refreshes now.
    if (!entry || Date.now() - entry.updatedAt >= REFRESH_MS) void query();
    const refresh = window.setInterval(() => {
      const latest = usageCache.get(providerId);
      if (!latest || Date.now() - latest.updatedAt >= REFRESH_MS) void query();
    }, REFRESH_MS);
    return () => window.clearInterval(refresh);
  }, [providerId, supported, query]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const report = snapshot?.status === "ready" ? snapshot.report : undefined;
  const values = useMemo(() => {
    if (!report) return { codex: [], today: null, remaining: null };
    const codex = [...report.buckets]
      .sort((a, b) => (a.windowMinutes ?? Infinity) - (b.windowMinutes ?? Infinity))
      .slice(0, 2)
      .map((bucket) => ({
        label: bucket.windowMinutes && bucket.windowMinutes >= 10_080 ? "7d" : bucket.label,
        percent: bucketPercent(bucket),
        reset: resetIn(bucket.resetsAt, now),
      }));
    const daily = report.metrics.find((metric) => /daily|today|day/u.test(`${metric.id} ${metric.label}`));
    const currencyBucket = report.buckets.find((bucket) => bucket.unit === "currency" && bucket.remaining !== undefined);
    const balance = report.metrics.find((metric) => /(?:^|-)remaining$/u.test(metric.id))
      ?? report.metrics.find((metric) => /(?:^|-)total$/u.test(metric.id) || /total balance/u.test(metric.label))
      ?? report.metrics.find((metric) => /balance|available|remaining|credit/u.test(`${metric.id} ${metric.label}`));
    return {
      codex,
      today: todayUsage
        ? compactAmount(Math.max(todayUsage.used, sessionCost), todayUsage.currency)
        : daily ? compactAmount(daily.value, daily.currency) : sessionCost > 0 ? compactAmount(sessionCost) : "--",
      remaining: currencyBucket ? compactAmount(currencyBucket.remaining, currencyBucket.currency) : balance ? compactAmount(balance.value, balance.currency) : "--",
    };
  }, [now, report, sessionCost, todayUsage]);

  if (!model || (!supported && sessionCost <= 0) || (supported && !report)) return null;

  return (
    <div
      title={report ? `Usage updated ${new Date(report.capturedAt).toLocaleString()}` : "Usage"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginLeft: 8,
        minWidth: 0,
        maxWidth: "min(52vw, 500px)",
        padding: "0 10px",
        color: "var(--text-muted)",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.2,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => void query()}
        disabled={querying}
        title={querying ? "刷新中" : "刷新用量"}
        aria-label={querying ? "刷新中" : "刷新用量"}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, padding: 0, border: 0, borderRadius: 4, background: "transparent", color: "var(--text-dim)", cursor: querying ? "default" : "pointer", opacity: querying ? 0.55 : 1 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={querying ? { animation: "spin 0.8s linear infinite" } : undefined} aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>
      {providerId === "openai-codex" ? (
        values.codex.map((item) => (
          <span
            key={item.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              minHeight: 28,
              padding: "3px 9px",
              border: "1px solid color-mix(in srgb, var(--accent) 42%, var(--border))",
              borderRadius: 7,
              background: "color-mix(in srgb, var(--accent) 10%, var(--bg-panel))",
              color: "var(--text)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            <span style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700 }}>{item.label}</span>
            <strong style={{ color: "var(--accent)", fontSize: 14, fontWeight: 800 }}>{item.percent === null ? "--" : `${item.percent}%`}</strong>
            {item.reset && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>· 刷新 {item.reset}</span>}
          </span>
        ))
      ) : supported ? (
        <>
          <span>今日 {values.today}</span>
          <span>剩余 {values.remaining}</span>
        </>
      ) : (
        <>
          <span>今日 {compactAmount(sessionCost)}</span>
          <span>剩余 --</span>
        </>
      )}
    </div>
  );
}

export { TopUsageStatus };
