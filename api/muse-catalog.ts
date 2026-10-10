import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ORIGIN = "https://datedinnerdance.com";
export const REELS = ["date", "dinner", "dance"] as const;
export type Reel = (typeof REELS)[number];

const SEARCH_CAP = 8;

export type CityInfo = { id: string; name: string };

export type Card = {
  id: string;
  name: string;
  area: string;
  vibe: string;
  website: string;
  reel: Reel;
  image: string;
  alt: string;
  image_kind: "venue" | "lifestyle";
};

type RawVenue = {
  id?: string;
  name?: string;
  area?: string;
  vibe?: string;
  website?: string;
  images?: Array<{ url?: string; alt?: string }>;
  verified?: { notes?: string };
};

type Catalog = Record<Reel, Card[]>;

const cache = new Map<string, { at: number; cities: CityInfo[]; catalogs: Map<string, Catalog> }>();

function publicDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), "public"),
    path.join(here, "..", "public"),
  ];
  return candidates.find((dir) => existsSync(path.join(dir, "data", "ibiza.json"))) || candidates[0];
}

function loadCities(): CityInfo[] {
  const file = path.join(publicDir(), "cities.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as Array<{ id?: string; name?: string }>;
  return rows
    .filter((row) => row.id && row.name)
    .map((row) => ({ id: String(row.id), name: String(row.name) }));
}

function cardFrom(reel: Reel, raw: RawVenue): Card | null {
  const vibe = (raw.vibe || "").trim();
  const local = (raw.images || []).find((image) => (image.url || "").includes("/assets/opt/"));
  const id = (raw.id || "").trim();
  const name = (raw.name || "").trim();
  if (!vibe || !local?.url || !id || !name) return null;
  const notes = (raw.verified?.notes || "").toLowerCase();
  return {
    id,
    name,
    area: (raw.area || "").trim(),
    vibe,
    website: (raw.website || "").trim(),
    reel,
    image: local.url.startsWith("http") ? local.url : `${ORIGIN}${local.url}`,
    alt: (local.alt || name).trim(),
    image_kind: notes.includes("lifestyle image") ? "lifestyle" : "venue",
  };
}

function loadCatalog(cityId: string): Catalog {
  const file = path.join(publicDir(), "data", `${cityId}.json`);
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, RawVenue[]>;
  const catalog = {} as Catalog;
  for (const reel of REELS) {
    catalog[reel] = (raw[reel] || []).map((venue) => cardFrom(reel, venue)).filter((card): card is Card => Boolean(card));
  }
  return catalog;
}

function snapshot(): { cities: CityInfo[]; catalogs: Map<string, Catalog> } {
  const hit = cache.get("live");
  if (hit && Date.now() - hit.at < 30_000) return hit;
  const cities = loadCities();
  const catalogs = new Map<string, Catalog>();
  for (const city of cities) {
    const file = path.join(publicDir(), "data", `${city.id}.json`);
    if (existsSync(file)) catalogs.set(city.id, loadCatalog(city.id));
  }
  const next = { at: Date.now(), cities, catalogs };
  cache.set("live", next);
  return next;
}

export function cities(): Array<CityInfo & { plan_url: string }> {
  return snapshot().cities.map((city) => ({
    ...city,
    plan_url: planURL(city.id),
  }));
}

export function resolveCity(input: unknown): CityInfo | null {
  const text = String(input || "").trim().toLowerCase();
  if (!text) return null;
  const { cities: list } = snapshot();
  return (
    list.find((city) => city.id === text || city.name.toLowerCase() === text) ||
    (text === "new york" || text === "new-york" ? list.find((city) => city.id === "nyc") || null : null)
  );
}

export function planURL(cityId: string): string {
  return `${ORIGIN}/?c=${encodeURIComponent(cityId)}`;
}

export function heyLine(cards: Card[], cityId: string): string {
  const names = cards.map((card) => card.name).join(" · ");
  return `Hey let's go\n${names}\nYour day → ${planURL(cityId)}`;
}

function pick(cards: Card[], avoid: Set<string>): Card | null {
  const pool = cards.filter((card) => !avoid.has(card.id));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function planDay(cityInput: unknown, avoidInput: unknown): { ok: true; day: Record<string, unknown> } | { ok: false; error: string } {
  const city = resolveCity(cityInput);
  if (!city) return { ok: false, error: "Unknown city. Use list_cities." };
  const catalog = snapshot().catalogs.get(city.id);
  if (!catalog) return { ok: false, error: `${city.name} has no catalog yet.` };
  const avoid = new Set(
    (Array.isArray(avoidInput) ? avoidInput : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const chosen: Card[] = [];
  for (const reel of REELS) {
    const card = pick(catalog[reel], avoid);
    if (!card) {
      const reason = catalog[reel].length
        ? `Every eligible ${reel} in ${city.name} was in avoid.`
        : `${city.name} has no eligible ${reel} venues.`;
      return { ok: false, error: reason };
    }
    chosen.push(card);
  }
  const [date, dinner, dance] = chosen;
  return {
    ok: true,
    day: {
      city: city.name,
      city_id: city.id,
      date,
      dinner,
      dance,
      hey_lets_go: heyLine(chosen, city.id),
      plan_url: planURL(city.id),
    },
  };
}

export function getVenue(cityInput: unknown, idInput: unknown): { ok: true; venue: Card } | { ok: false; error: string } {
  const city = resolveCity(cityInput);
  if (!city) return { ok: false, error: "Unknown city. Use list_cities." };
  const id = String(idInput || "").trim();
  if (!id) return { ok: false, error: "Missing venue id." };
  const catalog = snapshot().catalogs.get(city.id);
  if (!catalog) return { ok: false, error: `${city.name} has no catalog yet.` };
  for (const reel of REELS) {
    const venue = catalog[reel].find((card) => card.id === id);
    if (venue) return { ok: true, venue };
  }
  return { ok: false, error: `No venue ${id} in ${city.name}.` };
}

export function searchVenues(
  cityInput: unknown,
  reelInput: unknown,
  textInput: unknown,
): { ok: true; city: string; reel: Reel; venues: Card[] } | { ok: false; error: string } {
  const city = resolveCity(cityInput);
  if (!city) return { ok: false, error: "Unknown city. Use list_cities." };
  const reel = String(reelInput || "").trim().toLowerCase();
  if (!REELS.includes(reel as Reel)) return { ok: false, error: "Reel must be date, dinner, or dance." };
  const text = String(textInput || "").trim().toLowerCase();
  if (text.length < 2) return { ok: false, error: "Add a search word. This tool does not return the whole reel." };
  const catalog = snapshot().catalogs.get(city.id);
  if (!catalog) return { ok: false, error: `${city.name} has no catalog yet.` };
  const words = text.split(/\s+/).filter(Boolean);
  const venues = catalog[reel as Reel]
    .filter((card) => {
      const hay = `${card.name} ${card.area} ${card.vibe} ${card.id}`.toLowerCase();
      return words.every((word) => hay.includes(word));
    })
    .slice(0, SEARCH_CAP);
  return { ok: true, city: city.name, reel: reel as Reel, venues };
}
