type Body = {
  email?: string;
  handle?: string;
  city?: string;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const handle = (body.handle || "").trim();
  const city = (body.city || "").trim();
  if (!isEmail(email)) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
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

  return Response.json({ ok: true });
}