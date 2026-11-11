const VOICES = new Set(["eve", "ara", "rex", "sal", "leo"]);

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
      error: "Add XAI_API_KEY in the Vercel project settings, then redeploy. The story can still be read without it.",
    });
  }

  const body = readBody(req);
  const text = String(body.text || "").replace(/\s+/g, " ").trim();
  const voice = String(body.voice || "eve").toLowerCase();

  if (!text || text.length > 1500) {
    return res.status(400).json({ error: "Each spoken line must be between 1 and 1500 characters." });
  }
  if (!VOICES.has(voice)) {
    return res.status(400).json({ error: "That voice is not available." });
  }

  const upstream = await fetch("https://api.x.ai/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: voice,
      language: "en",
    }),
  });

  if (!upstream.ok) {
    const denied = upstream.status === 401 || upstream.status === 403;
    return res.status(denied ? 401 : 502).json({
      error: denied
        ? "The Grok API key was rejected. Check XAI_API_KEY on the server."
        : "The voice service did not answer. Try a shorter line.",
    });
  }

  const audio = Buffer.from(await upstream.arrayBuffer());
  res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(audio);
}
