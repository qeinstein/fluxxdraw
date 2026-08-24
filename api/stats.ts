import { EVENTS, LIVE_WINDOW_MS, configured, dayKey, pipeline } from "./_store";

export const config = { runtime: "edge" };

const DAYS = 14;
const TOP_SERVICES = 12;

const toCount = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Redis returns a hash as a flat [field, value, …] array. */
const hashToCounts = (value: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (Array.isArray(value)) {
    for (let i = 0; i + 1 < value.length; i += 2) {
      out[String(value[i])] = toCount(value[i + 1]);
    }
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toCount(v);
    }
  }
  return out;
};

/**
 * Aggregates for the dashboard. Counters only — there is nothing per-person in
 * the store to return even if this were asked for it.
 *
 * Set STATS_TOKEN in the project's environment to require `?k=<token>`; left
 * unset, the obscurity of the path is the only thing guarding it.
 */
export default async function handler(request: Request): Promise<Response> {
  const expected = process.env.STATS_TOKEN;
  if (expected) {
    const given = new URL(request.url).searchParams.get("k");
    if (given !== expected) return new Response("not found", { status: 404 });
  }

  if (!configured) {
    return Response.json(
      {
        configured: false,
        message:
          "No store attached. Add a Redis integration to the project so KV_REST_API_URL and KV_REST_API_TOKEN (or the UPSTASH_ equivalents) are set, then redeploy.",
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const days = Array.from({ length: DAYS }, (_, i) => dayKey(DAYS - 1 - i));
  const now = Date.now();

  try {
    const results = await pipeline([
      ["ZCOUNT", "live", now - LIVE_WINDOW_MS, "+inf"],
      ["HGETALL", "total"],
      ["ZRANGE", "svc", 0, TOP_SERVICES - 1, "REV", "WITHSCORES"],
      ...days.map((day) => ["HGETALL", `d:${day}`]),
    ]);

    const [liveRaw, totalRaw, svcRaw, ...dayRaws] = results;

    const services: { id: string; count: number }[] = [];
    if (Array.isArray(svcRaw)) {
      for (let i = 0; i + 1 < svcRaw.length; i += 2) {
        services.push({ id: String(svcRaw[i]), count: toCount(svcRaw[i + 1]) });
      }
    }

    return Response.json(
      {
        configured: true,
        generatedAt: new Date(now).toISOString(),
        live: toCount(liveRaw),
        totals: hashToCounts(totalRaw),
        events: EVENTS,
        days: days.map((date, i) => ({ date, ...hashToCounts(dayRaws[i]) })),
        services,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { configured: true, error: (error as Error).message },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
