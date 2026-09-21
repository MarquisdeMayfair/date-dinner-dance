export const config = { runtime: "edge" };

const ALLOWED_CITIES = new Set(["ibiza", "london", "manchester", "nyc"]);

type Venue = {
  id?: string;
  name?: string;
  instagram?: string;
  instagram_followers?: number;
};
type Catalog = { date?: Venue[]; dinner?: Venue[]; dance?: Venue[] };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function env(name: string): string {
  const bag = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {};
  return (bag[name] || "").trim();
}

function instagramHandle(url?: string): string {
  if (!url) return "";
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const handle = (path[0] || "").replace(/^@/, "").toLowerCase();
    if (!handle || ["p", "reel", "reels", "stories", "direct", "explore"].includes(handle)) return "";
    if (!/^[a-z0-9._]{1,30}$/.test(handle)) return "";
    return handle;
  } catch {
    return "";
  }
}

function significantChange(previous: number | undefined, next: number): boolean {
  if (!previous || previous <= 0) return true;
  const delta = Math.abs(next - previous);
  return delta >= 1000 || delta / previous >= 0.1;
}

async function followersFor(igUserId: string, token: string, handle: string): Promise<number | null> {
  const fields = `business_discovery.username(${handle}){followers_count}`;
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { business_discovery?: { followers_count?: number } };
    const count = data.business_discovery?.followers_count;
    return typeof count === "number" && count > 0 ? count : null;
  } catch {
    return null;
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const secret = env("DDD_IG_REFRESH_SECRET");
  const igUserId = env("DDD_IG_USER_ID");
  const token = env("DDD_IG_ACCESS_TOKEN");
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!secret || provided !== secret) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!igUserId || !token) {
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const city = new URL(request.url).searchParams.get("c")?.toLowerCase() || "";
  if (!ALLOWED_CITIES.has(city)) {
    return json({ ok: false, error: "unknown_city" }, 400);
  }

  const origin = new URL(request.url).origin;
  const catalogResponse = await fetch(`${origin}/data/${encodeURIComponent(city)}.json`, { cache: "no-store" });
  if (!catalogResponse.ok) return json({ ok: false, error: "catalog_unavailable" }, 502);

  const catalog = (await catalogResponse.json()) as Catalog;
  const updates: Array<{ id: string; name: string; handle: string; from: number | null; to: number }> = [];
  const unchanged: string[] = [];

  for (const reel of [catalog.date, catalog.dinner, catalog.dance]) {
    for (const venue of reel || []) {
      const handle = instagramHandle(venue.instagram);
      if (!handle || !venue.id) continue;
      const next = await followersFor(igUserId, token, handle);
      if (!next) continue;
      const previous = venue.instagram_followers;
      if (significantChange(previous, next)) {
        updates.push({
          id: venue.id,
          name: venue.name || handle,
          handle,
          from: previous && previous > 0 ? previous : null,
          to: next,
        });
      } else {
        unchanged.push(venue.id);
      }
    }
  }

  return json({
    ok: true,
    city,
    updates,
    unchanged: unchanged.length,
    at: new Date().toISOString(),
  });
}
