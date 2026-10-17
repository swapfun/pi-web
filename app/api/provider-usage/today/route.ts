import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { NextResponse } from "next/server";
import { isApiRequestAllowed } from "@/lib/request-security";
import { isProviderUsageId } from "@/lib/provider-usage-ids";
import { readDeepSeekTodaySpend } from "@/lib/deepseek-balance-history";
import { getSessionEntries, listAllSessions } from "@/lib/session-reader";
import type { AgentUsage, SessionEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function costOf(usage: AgentUsage | undefined): number {
  const value = usage?.cost?.total;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function isToday(timestamp: string | undefined, start: number, end: number): boolean {
  if (!timestamp) return false;
  const time = Date.parse(timestamp);
  return Number.isFinite(time) && time >= start && time < end;
}

function localDayBounds(now = new Date()): { start: number; end: number; date: string } {
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    start: startDate.getTime(),
    end: endDate.getTime(),
    date: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
  };
}

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });

  const providerId = new URL(request.url).searchParams.get("providerId") ?? "";
  if (!isProviderUsageId(providerId)) return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });

  const { start, end, date } = localDayBounds();
  if (providerId === "deepseek") {
    let credential: string | undefined;
    try {
      const runtime = await ModelRuntime.create({ refreshOnCreate: false });
      const resolved = await runtime.getAuth("deepseek");
      const auth = resolved?.auth;
      credential = auth?.apiKey
        ?? auth?.headers?.authorization
        ?? auth?.headers?.Authorization
        ?? undefined;
    } catch {
      // Read the default history account if auth is temporarily unavailable.
    }
    const spend = readDeepSeekTodaySpend(credential);
    return NextResponse.json({ providerId, date, used: spend.todaySpend, currency: spend.currency });
  }
  let used = 0;
  try {
    const sessions = await listAllSessions({ allowStale: true });
    for (const session of sessions) {
      if (session.relation?.kind === "subagent") continue;
      let entries: SessionEntry[];
      try {
        entries = getSessionEntries(session.path);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!isToday(entry.timestamp, start, end)) continue;
        if (entry.type === "usage" && entry.provider === providerId) {
          used += costOf(entry.usage);
          continue;
        }
        if (entry.type !== "message" || entry.message.role !== "assistant") continue;
        if (entry.message.provider === providerId) used += costOf(entry.message.usage);
      }
    }
  } catch {
    // A local usage total is supplemental. Return zero rather than breaking the toolbar.
  }

  return NextResponse.json({ providerId, date, used, currency: "USD" });
}
