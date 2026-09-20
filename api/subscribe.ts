export const config = { runtime: "edge" };

type Body = {
  email?: string;
  handle?: string;
  city?: string;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(request: Request): Promise<Response> {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };

  if (request.method === "GET") {
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers,
    });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers,
    });
  }

  const email = (body.email || "").trim().toLowerCase();
  const handle = (body.handle || "").trim();
  const city = (body.city || "").trim();
  if (!isEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_email" }), {
      status: 400,
      headers,
    });
  }

  console.log(
    JSON.stringify({
      event: "subscribe",
      email,
      handle,
      city,
      at: new Date().toISOString(),
    }),
  );

  return new Response(JSON.stringify({ ok: true }), { headers });
}
