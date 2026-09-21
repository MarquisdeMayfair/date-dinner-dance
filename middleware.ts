const CRAWLERS =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|LinkedInBot|Slackbot|TelegramBot|Discordbot/i;

const ALLOWED = new Set(["ibiza", "london", "manchester", "nyc"]);
const KEYS = ["date", "dinner", "dance"] as const;
const APP_ID = "2325553588248802";

export const config = { matcher: "/" };

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get("user-agent") || "";
  if (!CRAWLERS.test(ua)) return;

  const page = new URL(request.url);
  const origin = page.origin;
  const cityId = (page.searchParams.get("c") || "ibiza").toLowerCase();
  const night = new URL(origin);
  night.searchParams.set("c", ALLOWED.has(cityId) ? cityId : "ibiza");
  KEYS.forEach((key) => {
    const id = page.searchParams.get(key);
    if (id) night.searchParams.set(key, id);
  });

  let title = "date dinner dance";
  let description = "Plan your perfect day then tell somebody special.";
  let image = `${origin}/og.png`;
  if (ALLOWED.has(cityId) && KEYS.every((key) => page.searchParams.get(key))) {
    try {
      const [citiesRes, catalogRes] = await Promise.all([
        fetch(`${origin}/cities.json`, { cache: "no-store" }),
        fetch(`${origin}/data/${encodeURIComponent(cityId)}.json`, { cache: "no-store" }),
      ]);
      const cities = (await citiesRes.json()) as Array<{ id: string; name: string }>;
      const catalog = (await catalogRes.json()) as Record<
        string,
        Array<{ id?: string; name?: string; images?: Array<{ url?: string }> }>
      >;
      const cityName = cities.find((city) => city.id === cityId)?.name || cityId;
      const venues = KEYS.map((key) => {
        const id = page.searchParams.get(key) || "";
        return (catalog[key] || []).find((item) => item.id === id);
      });
      const names = venues.map((venue) => venue?.name || "").filter(Boolean);
      title = `My perfect ${cityName} day`;
      if (names.length) description = `${names.join(" · ")} — Plan yours →`;
      const photo =
        venues[1]?.images?.[0]?.url ||
        venues.find((venue) => venue?.images?.[0]?.url)?.images?.[0]?.url;
      if (photo) image = /^https?:/i.test(photo) ? photo : `${origin}${photo.startsWith("/") ? photo : `/${photo}`}`;
    } catch {
      /* defaults */
    }
  }
  const canonical = night.toString();
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="fb:app_id" content="${APP_ID}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="date dinner dance" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="${esc(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
</head><body><p>${esc(title)}</p><p>${esc(description)}</p><p><a href="${esc(canonical)}">Open this night</a></p></body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
