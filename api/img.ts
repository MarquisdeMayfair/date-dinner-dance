export const config = { runtime: "edge" };

const MAX_BYTES = 6_000_000;

function blockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.")
  );
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("method_not_allowed", { status: 405 });
  }
  const raw = new URL(request.url).searchParams.get("u") || "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad_url", { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol) || blockedHost(target.hostname)) {
    return new Response("blocked", { status: 400 });
  }

  const upstream = await fetch(target.toString(), {
    headers: { "User-Agent": "DateDinnerDance/1.0", Accept: "image/*" },
    redirect: "follow",
  });
  if (!upstream.ok) return new Response("fetch_failed", { status: 502 });
  const type = upstream.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return new Response("not_image", { status: 415 });
  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return new Response("too_large", { status: 413 });

  return new Response(bytes, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      "access-control-allow-origin": "*",
    },
  });
}
