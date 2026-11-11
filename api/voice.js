const CAST = new Set(["lina", "bram", "sera", "edwin"]);

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const key = process.env.XAI_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: "Add XAI_API_KEY in the Vercel project settings, then redeploy. Voice conversation needs that key.",
    });
  }

  const body = readBody(req);
  const character = String(body.character || "");
  if (!CAST.has(character)) {
    return res.status(400).json({ error: "Choose Lina, Bram, Sera, or Edwin." });
  }

  const upstream = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { seconds: 300 },
      model: "grok-voice-latest",
      reasoning: { effort: "none" },
    }),
  });

  if (!upstream.ok) {
    const denied = upstream.status === 401 || upstream.status === 403;
    return res.status(denied ? 401 : 502).json({
      error: denied
        ? "The Grok API key was rejected. Check XAI_API_KEY on the server."
        : "The voice line did not open. Try again in a moment.",
    });
  }

  const data = await upstream.json();
  const token = String(data.value || data.client_secret?.value || "");
  if (!token) {
    return res.status(502).json({ error: "The voice line did not open. Try again in a moment." });
  }

  return res.status(200).json({
    token,
    expires_at: data.expires_at || data.client_secret?.expires_at || 0,
  });
}
