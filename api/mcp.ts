import type { IncomingMessage, ServerResponse } from "node:http";
import { cities, getVenue, planDay, searchVenues } from "./muse-catalog";

const PROTOCOL = "2025-03-26";
const WINDOW_MS = 60_000;
const LIMIT = 60;
const buckets = new Map<string, number[]>();

type Rpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const TOOLS = [
  {
    name: "list_cities",
    description:
      "Read. Lists the Date · Dinner · Dance cities and the city-only plan URL for each. Call this when the person has not named Ibiza, London, Manchester, or New York.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "plan_day",
    description:
      "Read. Plans one day: a place to go, a place to eat, and a place to dance, from the checked catalog only. Returns the Hey let's go line. Does not book, message, or post. Pass avoid only with venue ids already shown.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "Ibiza, London, Manchester, or New York." },
        avoid: {
          type: "array",
          items: { type: "string" },
          description: "Venue ids to skip.",
        },
      },
      required: ["city"],
      additionalProperties: false,
    },
  },
  {
    name: "get_venue",
    description: "Read. Returns one catalog card by city and venue id, or a clear miss. Does not invent a venue.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        id: { type: "string", description: "Venue id from plan_day or search_venues." },
      },
      required: ["city", "id"],
      additionalProperties: false,
    },
  },
  {
    name: "search_venues",
    description:
      "Read. Searches one reel in one city. Reel is date, dinner, or dance. Requires a search word. Returns at most 8 cards and never the whole city.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        reel: { type: "string", enum: ["date", "dinner", "dance"] },
        text: { type: "string", description: "Word or phrase to match. At least 2 characters." },
      },
      required: ["city", "reel", "text"],
      additionalProperties: false,
    },
  },
];

function send(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  for (const [key, value] of Object.entries(extra)) res.setHeader(key, value);
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function rpcError(id: Rpc["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function clientKey(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket.remoteAddress || "anon";
  return String(raw).split(",")[0].trim() || "anon";
}

function limited(key: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= LIMIT) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  return false;
}

function toolResult(payload: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError,
  };
}

function note(tool: string, city: unknown) {
  const name = String(city || "").trim().toLowerCase().slice(0, 40);
  console.log(JSON.stringify({ tool, city: name || null, at: new Date().toISOString() }));
}

function callTool(name: string, args: Record<string, unknown>) {
  if (name === "list_cities") {
    note(name, "");
    return toolResult({ cities: cities() });
  }
  if (name === "plan_day") {
    const result = planDay(args.city, args.avoid);
    note(name, result.ok ? result.day.city_id : args.city);
    return toolResult(result.ok ? result.day : { error: result.error }, !result.ok);
  }
  if (name === "get_venue") {
    const result = getVenue(args.city, args.id);
    note(name, args.city);
    return toolResult(result.ok ? { venue: result.venue } : { error: result.error }, !result.ok);
  }
  if (name === "search_venues") {
    const result = searchVenues(args.city, args.reel, args.text);
    note(name, args.city);
    return toolResult(
      result.ok ? { city: result.city, reel: result.reel, venues: result.venues } : { error: result.error },
      !result.ok,
    );
  }
  return null;
}

function handle(message: Rpc): { status: number; body?: unknown } {
  if (message.jsonrpc !== "2.0" || !message.method) {
    return { status: 200, body: rpcError(message.id, -32600, "Invalid request") };
  }
  if (message.id === undefined || message.id === null) {
    return { status: 202 };
  }
  if (message.method === "initialize") {
    return {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "date-dinner-dance", version: "1.0.0" },
          instructions:
            "Date · Dinner · Dance plans one day: a place to go, a place to eat, and a place to dance, in Ibiza, London, Manchester, or New York. Use the catalog lines as given. Do not invent a venue, a booking, or a post.",
        },
      },
    };
  }
  if (message.method === "ping") {
    return { status: 200, body: { jsonrpc: "2.0", id: message.id, result: {} } };
  }
  if (message.method === "tools/list") {
    return { status: 200, body: { jsonrpc: "2.0", id: message.id, result: { tools: TOOLS } } };
  }
  if (message.method === "tools/call") {
    const params = message.params || {};
    const name = String(params.name || "");
    const args = (params.arguments || {}) as Record<string, unknown>;
    const result = callTool(name, args);
    if (!result) return { status: 200, body: rpcError(message.id, -32602, "Unknown tool") };
    return { status: 200, body: { jsonrpc: "2.0", id: message.id, result } };
  }
  return { status: 200, body: rpcError(message.id, -32601, "Method not found") };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    send(res, 204, undefined, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, accept",
    });
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "POST JSON-RPC only" }, { allow: "POST" });
    return;
  }
  if (limited(clientKey(req))) {
    send(res, 429, rpcError(null, -32000, "Too many requests"));
    return;
  }
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    send(res, 400, rpcError(null, -32700, "Parse error"));
    return;
  }
  if (Array.isArray(body)) {
    send(res, 400, rpcError(null, -32600, "One message per request"));
    return;
  }
  const outcome = handle(body as Rpc);
  send(res, outcome.status, outcome.body, { "access-control-allow-origin": "*" });
}
