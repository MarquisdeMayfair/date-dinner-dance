import { put } from "@vercel/blob";
import type { IncomingMessage, ServerResponse } from "node:http";

const ALLOWED = new Set(["ibiza", "london", "manchester", "nyc"]);
const KINDS = new Set(["open", "share", "city", "spin"]);
const CHANNELS = new Set(["story", "copy", "dm", "native", "instagram"]);
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const BOTS =
  /bot|crawler|spider|crawling|facebookexternalhit|facebot|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|yandex|baiduspider|applebot|bytespider|gptbot|claudebot|semrush|ahrefs|petalbot|duckduckbot|preview|^curl\/|^wget\/|^python-requests/i;

function send(res: ServerResponse, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function cleanId(value: unknown): string {
  const text = String(value || "").trim().toLowerCase();
  return ID.test(text) ? text : "";
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("access-control-allow-origin", "*");
    res.end();
    return;
  }
  if (req.method !== "POST") return send(res, { ok: false }, 405);

  const ua = String(req.headers["user-agent"] || "");
  if (!ua || BOTS.test(ua)) return send(res, { ok: true, skipped: "bot" });

  let body: Record<string, unknown> = {};
  try {
    body = await readJson(req);
  } catch {
    return send(res, { ok: false }, 400);
  }

  const kind = String(body.kind || "").toLowerCase();
  const city = cleanId(body.city);
  const date = cleanId(body.date);
  const dinner = cleanId(body.dinner);
  const dance = cleanId(body.dance);
  const channel = String(body.channel || "").toLowerCase();
  const needsNight = kind === "open" || kind === "share" || kind === "spin";
  if (!KINDS.has(kind) || !ALLOWED.has(city) || (needsNight && (!date || !dinner || !dance))) {
    return send(res, { ok: false }, 400);
  }
  if (kind === "share" && channel && !CHANNELS.has(channel)) return send(res, { ok: false }, 400);

  const header = (name: string) => {
    const value = req.headers[name];
    const text = Array.isArray(value) ? value[0] : value || "";
    return String(text).slice(0, 80);
  };
  const country = header("x-vercel-ip-country");
  const region = header("x-vercel-ip-country-region");

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return send(res, { ok: false }, 503);

  const combo = `${city}|${date}|${dinner}|${dance}`;
  const at = new Date().toISOString();
  const stamp = `${at.replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
  await put(
    `hits/${stamp}.json`,
    JSON.stringify({
      kind,
      channel: kind === "share" && CHANNELS.has(channel) ? channel : undefined,
      city,
      date: date || undefined,
      dinner: dinner || undefined,
      dance: dance || undefined,
      country: country || undefined,
      region: region || undefined,
      combo,
      at,
    }),
    { access: "private", token, addRandomSuffix: false, contentType: "application/json" },
  );

  return send(res, { ok: true });
}
