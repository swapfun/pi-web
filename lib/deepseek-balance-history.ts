import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import lockfile from "proper-lockfile";

type HistoryEntry = {
  currency: string;
  trackingSince: number;
  lastPaid: number | null;
  allTimeSpend: number;
  dailySpend: Record<string, number>;
};

type HistoryStore = {
  version: 1;
  accounts: Record<string, HistoryEntry>;
};

const RETENTION_MS = 40 * 24 * 60 * 60 * 1000;

function storePath(): string {
  const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, "provider-usage", "deepseek-balance-history.json");
}

function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readStore(): HistoryStore {
  try {
    const parsed = JSON.parse(readFileSync(storePath(), "utf8")) as Partial<HistoryStore>;
    if (parsed.version === 1 && parsed.accounts && typeof parsed.accounts === "object") {
      return { version: 1, accounts: parsed.accounts as Record<string, HistoryEntry> };
    }
  } catch {
    // A missing or corrupt local history starts a new baseline.
  }
  return { version: 1, accounts: {} };
}

function writeStore(store: HistoryStore): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

function accountKey(apiKey: string | undefined): string {
  const credential = apiKey || "unknown";
  return createHash("sha256").update(`deepseek:${credential}`).digest("hex");
}

function selectBalance(payload: Record<string, unknown>): { currency: string; amount: number; paid: number } | null {
  const rows = Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
  const parsed = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    const currency = typeof value.currency === "string" ? value.currency.trim().toUpperCase() : "";
    const amount = Number(value.total_balance);
    const paid = Number(value.topped_up_balance);
    return currency && Number.isFinite(amount) && Number.isFinite(paid) ? [{ currency, amount, paid }] : [];
  });
  const funded = parsed
    .filter((row) => row.amount > 0)
    .sort((a, b) => (b.amount - a.amount) || (a.currency === "USD" ? -1 : b.currency === "USD" ? 1 : 0));
  return funded[0] ?? parsed.find((row) => row.currency === "USD") ?? parsed[0] ?? null;
}

function prune(entry: HistoryEntry, now: number): void {
  const cutoff = now - RETENTION_MS;
  for (const key of Object.keys(entry.dailySpend)) {
    const timestamp = Date.parse(`${key}T00:00:00`);
    if (!Number.isFinite(timestamp) || timestamp < cutoff) delete entry.dailySpend[key];
  }
}

export async function recordDeepSeekBalance(payload: Record<string, unknown>, apiKey: string | undefined, now = Date.now()): Promise<{ currency: string; todaySpend: number } | null> {
  const balance = selectBalance(payload);
  if (!balance) return null;

  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  const release = await lockfile.lock(path, {
    realpath: false,
    stale: 15_000,
    retries: { retries: 8, minTimeout: 25, maxTimeout: 250 },
  });
  try {
    // Read only after acquiring the lock so concurrent requests cannot overwrite
    // each other's account baseline or daily total.
    const store = readStore();
    const key = accountKey(apiKey);
    const previous = store.accounts[key];
    const entry: HistoryEntry = previous && previous.currency === balance.currency
      ? previous
      : { currency: balance.currency, trackingSince: now, lastPaid: null, allTimeSpend: 0, dailySpend: {} };

    if (entry.lastPaid !== null && balance.paid < entry.lastPaid) {
      const spend = round2(entry.lastPaid - balance.paid);
      const day = localDayKey(now);
      entry.dailySpend[day] = round2((entry.dailySpend[day] ?? 0) + spend);
      entry.allTimeSpend = round2(entry.allTimeSpend + spend);
    }
    // Increases are top-ups/refunds, not consumption. Updating the baseline here
    // prevents the next observation from counting the top-up as negative spend.
    entry.lastPaid = balance.paid;
    prune(entry, now);
    store.accounts[key] = entry;
    writeStore(store);
    return { currency: balance.currency, todaySpend: round2(entry.dailySpend[localDayKey(now)] ?? 0) };
  } finally {
    await release();
  }
}

export function readDeepSeekTodaySpend(apiKey?: string, now = Date.now()): { currency: string; todaySpend: number } {
  const store = readStore();
  const entry = store.accounts[accountKey(apiKey)];
  return { currency: entry?.currency ?? "CNY", todaySpend: round2(entry?.dailySpend?.[localDayKey(now)] ?? 0) };
}
