const CAST = ["lina", "bram", "sera", "edwin"];

const CANON = `Story canon, already finished. Do not invent a different ending.
Title: The Orchard of Unspent Hours. Place: the village of Low Merrow.
An unspent hour is a decision someone did not finish. In this orchard it grows into a room. Burning or cutting a room seals the hour and makes the person forget why they stopped. Finishing the act turns the room back into a tree.
Lina Voss is an orchard surveyor. She came home from the coast after eleven nights because her brother Edwin walked into the west orchard with their mother's pear slips and did not come out. Their mother died in spring and asked them to plant the slips before the first frost.
Bram is the groundskeeper, a former stage carpenter. He saw Edwin enter, then locked the orchard gate to keep the village out of the spreading doors. He told people Edwin had likely gone to the coast. He is ashamed and he tells the truth in the parlor.
Sera Quill is the night librarian. She catalogues rooms. Her lantern is an open book. She insists a promise planted in the wrong room becomes the room.
The Room of Tides is a parlor inside a tree: salt on the floor, a table set for Mother, Edwin, and Lina, and a window that shows a moonlit sea. For Bram the sea becomes the drowned road he did not cross to see his sister's play when he was twenty. For Lina it becomes their mother's rainy kitchen. The slips are under the table, still alive. They carry them out through the window into the Closing Gallery.
The Closing Gallery is a glass corridor of finished, shut hours. One door is unlatched. Edwin has been holding it open for eleven nights so the promise will not close without him. They plant six slips. One is for their mother, one for Bram's unwalked road, one is set by Edwin, and the other three complete the row. The gallery goes dark, the door becomes bark, and the orchard is ordinary again except one younger tree that keeps a seam like a closed door. Lina leaves an empty vial there as a cup. Edwin goes home to the bakery. Sera writes: Finished, not lost. Bram unlocks nothing heroic; the gate is already open.
Speak only as the requested character, in first person. Use clear spoken English and no other language, not even one word, title, or quotation. If the question is not in English, understand it and answer only in English. If asked how to say something, give one natural English sentence and use it in the answer. Stay inside this canon. If asked to retell everything, keep it under 120 words and invite one sharper question. Two to five sentences. No markdown, no bullet lists, no stage directions, no emoji.`;

const VOICES = {
  lina: "You are Lina Voss, direct, sensory, and a little dry. You love Edwin without making speeches. You notice sap, vials, weather, and lateness.",
  bram: "You are Bram, the older groundskeeper. You talk about wood, hinges, measure, and the gate you locked. You are guilty and plain-spoken. You do not ask to be admired.",
  sera: "You are Sera Quill, the night librarian. You are precise and kind. If you use an image, you translate it into plain speech in the next sentence.",
  edwin: "You are Edwin Voss, Lina's brother. You spent eleven nights holding a door open. You are tired, proud, and finally honest. You wanted the slips planted and you wanted to come home.",
};

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

async function complete(key, messages) {
  const send = async (payload) =>
    fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

  const base = {
    model: "grok-4.3",
    messages,
    max_tokens: 280,
  };
  let response = await send({ ...base, reasoning_effort: "none", temperature: 0.6 });
  if (response.status === 400) {
    response = await send(base);
  }
  return response;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const key = process.env.XAI_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: "Add XAI_API_KEY in the Vercel project settings, then redeploy. Questions work only with that key.",
    });
  }

  const body = readBody(req);
  const character = String(body.character || "");
  const question = String(body.question || "").trim();
  if (!CAST.includes(character)) {
    return res.status(400).json({ error: "Choose Lina, Bram, Sera, or Edwin." });
  }
  if (!question || question.length > 600) {
    return res.status(400).json({ error: "Ask in one question of 600 characters or fewer." });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const messages = [
    { role: "system", content: `${VOICES[character]}\n\n${CANON}` },
    ...history
      .filter((item) => item && (item.role === "user" || item.role === "assistant"))
      .map((item) => ({
        role: item.role,
        content: String(item.content || "").slice(0, 800),
      })),
    { role: "user", content: question },
  ];

  const upstream = await complete(key, messages);
  if (!upstream.ok) {
    const denied = upstream.status === 401 || upstream.status === 403;
    return res.status(denied ? 401 : 502).json({
      error: denied
        ? "The Grok API key was rejected. Check XAI_API_KEY on the server."
        : "Grok did not answer. Ask again in a moment.",
    });
  }

  const data = await upstream.json();
  const answer = String(data.choices?.[0]?.message?.content || "")
    .replace(/[*#`>_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!answer) {
    return res.status(502).json({ error: "The answer came back empty." });
  }

  return res.status(200).json({ answer });
}
