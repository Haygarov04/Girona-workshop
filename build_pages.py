#!/usr/bin/env python3
"""Rebuild the three story pages from content/*.txt."""

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NAMES = {
    "LINA": "lina",
    "BRAM": "bram",
    "SERA": "sera",
    "EDWIN": "edwin",
}
LABELS = {
    "lina": "Lina",
    "bram": "Bram",
    "sera": "Sera",
    "edwin": "Edwin",
}

PAGES = [
    {
        "file": "index.html",
        "source": "chapter-1.txt",
        "narrator": "lina",
        "current": "Beginning",
        "kicker": "Part one · Beginning",
        "title": "The door in the west row",
        "dek": "Lina comes home to Low Merrow and finds the pear trees growing rooms.",
        "hero": "images/orchard.jpg",
        "video": "videos/orchard.mp4",
        "alt": "A foggy pear orchard at dusk, with wooden doors set into the trunks and warm light spilling from one open door.",
        "prev": None,
        "next": ("middle.html", "Next", "The Room of Tides"),
        "model": "models/pear.glb",
        "model_title": "The lantern pear",
        "model_alt": "A three-dimensional glowing pear. Drag to turn it.",
        "model_note": "Drag the pear to turn it. This is the fruit that lights the west row.",
    },
    {
        "file": "middle.html",
        "source": "chapter-2.txt",
        "narrator": "bram",
        "current": "The Room of Tides",
        "kicker": "Part two · Middle",
        "title": "The room that borrowed the sea",
        "dek": "Bram tells what the parlor showed them, and what he did to the gate.",
        "hero": "images/tides.jpg",
        "video": "videos/tides.mp4",
        "alt": "A parlor grown inside a hollow tree, with a table set for three and a window open onto a moonlit sea.",
        "prev": ("index.html", "Previous", "The door in the west row"),
        "next": ("ending.html", "Next", "The last door"),
    },
    {
        "file": "ending.html",
        "source": "chapter-3.txt",
        "narrator": "sera",
        "current": "The last door",
        "kicker": "Part three · End",
        "title": "Finished, not lost",
        "dek": "Sera tells how the hour was planted, and how one young tree kept a seam.",
        "hero": "images/gallery.jpg",
        "video": "videos/gallery.mp4",
        "alt": "A long glass corridor lined with closed wooden doors, pear branches against the panes, and one open door shining gold.",
        "prev": ("middle.html", "Previous", "The Room of Tides"),
        "next": ("#talk", "After the story", "Talk with them"),
        "ask": True,
    },
]

NAV = [
    ("index.html", "Beginning"),
    ("middle.html", "The Room of Tides"),
    ("ending.html", "The last door"),
    ("notes.html", "Record"),
]

ASIDES = {
    "index.html": [
        ("bram", "Hear Bram", "I locked the gate because a door was learning the way to the lane. I told myself I was protecting the village. I was delaying the search."),
        ("sera", "Hear Sera", "A room here is an hour someone did not finish. Finish the hour, and it remembers how to be a tree."),
        ("edwin", "Hear Edwin", "If you have the slips, come through. If you have come to tell me to let go, you can turn around. I am not finished."),
    ],
    "middle.html": [
        ("lina", "Hear Lina", "The chair with my name on it was warm, as if I had only stood up to fetch a cloth."),
        ("sera", "Hear Sera", "If you plant a promise in the wrong room, the promise becomes the room. Carry the slips to the last door."),
        ("edwin", "Hear Edwin", "If you have the slips, come through. I am not finished."),
    ],
    "ending.html": [
        ("lina", "Hear Lina", "Hours are supposed to be shared. Leave them alone and they turn into furniture."),
        ("bram", "Hear Bram", "I held the door the way I should have held the gate. Open. That was the whole craft."),
        ("edwin", "Hear Edwin", "I can walk. I want the bakery, and a bed that does not try to become a chapel."),
    ],
}


def paragraphs(path):
    blocks = [block.strip() for block in path.read_text().split("\n\n") if block.strip()]
    items = []
    for block in blocks:
        speaker, text = block.split(":", 1)
        voice = NAMES[speaker.strip()]
        items.append((voice, " ".join(text.split())))
    return items


def story_html(items):
    parts = []
    previous = None
    for index, (voice, text) in enumerate(items):
        if voice != previous:
            parts.append(f"          <p class=\"who\">{LABELS[voice]}</p>")
        classes = ["lead"] if index == 0 else []
        class_attr = f' class="{" ".join(classes)}"' if classes else ""
        parts.append(f"          <p{class_attr} data-voice=\"{voice}\">{html.escape(text)}</p>")
        previous = voice
    return "\n".join(parts)


def nav(current):
    links = []
    for href, label in NAV:
        current_attr = ' aria-current="page"' if label == current else ""
        links.append(f'<a href="{href}"{current_attr}>{label}</a>')
    return "\n        ".join(links)


def pager_link(item, class_name):
    if not item:
        return "<span></span>"
    href, small, label = item
    return f'<a class="{class_name}" href="{href}"><small>{small}</small>{label}</a>'


def cast(narrator):
    people = [
        ("lina", "Lina Voss", "Surveyor, home from the coast"),
        ("bram", "Bram", "Groundskeeper with a brass tape"),
        ("sera", "Sera Quill", "Night librarian of rooms"),
        ("edwin", "Edwin Voss", "Holding the last door"),
    ]
    buttons = []
    for voice, name, role in people:
        active = " active" if voice == narrator else ""
        buttons.append(
            f"""<button class="person{active}" type="button" data-line="{html.escape(ROLE_LINES[voice])}" data-voice="{voice}">
            <img src="images/{voice}.jpg" alt="{html.escape(name)}">
            <span><strong>{name}</strong><span>{role}</span></span>
          </button>"""
        )
    return "\n          ".join(buttons)


ROLE_LINES = {
    "lina": "I measure orchards that behave like orchards. This one did not. I came home for my brother, not for a story.",
    "bram": "I know the sound a false room makes. These boards were real. So was the gate I locked.",
    "sera": "Say what a thing is, and it may consent to stay. Tonight the orchard taught me when to stop naming and start planting.",
    "edwin": "I held the door because I did not like the terms. If I let go, the trees would keep the promise and forget who made it.",
}


ASK = """
    <section class="ask" id="ask">
      <p class="kicker">After the story</p>
      <h2>Ask them, in English.</h2>
      <p>Choose a person. Ask what they did, or ask them to say a sentence clearly. The answer is spoken in English.</p>
      <div class="choices">
        <button class="choice" type="button" data-character="lina" aria-pressed="true"><img src="images/lina.jpg" alt="">Lina</button>
        <button class="choice" type="button" data-character="bram" aria-pressed="false"><img src="images/bram.jpg" alt="">Bram</button>
        <button class="choice" type="button" data-character="sera" aria-pressed="false"><img src="images/sera.jpg" alt="">Sera</button>
        <button class="choice" type="button" data-character="edwin" aria-pressed="false"><img src="images/edwin.jpg" alt="">Edwin</button>
      </div>
      <div class="log" aria-live="polite"></div>
      <div class="chips">
        <button class="chip" type="button" data-q="Why did you go into the orchard alone?">Why did you go in alone?</button>
        <button class="chip" type="button" data-q="Why did you lock the gate?">Why did you lock the gate?</button>
        <button class="chip" type="button" data-q="What happens if someone burns a room?">What if a room is burned?</button>
        <button class="chip" type="button" data-q="Please say this clearly in English: an unfinished hour becomes a room.">Help me say this</button>
      </div>
      <form class="ask-form">
        <label class="note" for="question">Your question</label>
        <input id="question" name="question" maxlength="600" placeholder="Ask in English, or ask them to pronounce a line" autocomplete="off">
        <button class="solid" type="submit">Ask</button>
      </form>
    </section>
"""


def hero_media(spec):
    image = f'<img src="{spec["hero"]}" alt="{html.escape(spec["alt"])}">'
    video = spec.get("video")
    if not video:
        return image
    return f"""{image}
    <video autoplay muted loop playsinline poster="{spec["hero"]}">
      <source src="{video}" type="video/mp4">
    </video>"""


def model_panel(spec):
    if not spec.get("model"):
        return ""
    return f"""      <div class="panel object-panel">
        <p class="kicker">Turn it</p>
        <h2>{html.escape(spec["model_title"])}</h2>
        <model-viewer src="{spec["model"]}" alt="{html.escape(spec["model_alt"])}" camera-controls touch-action="pan-y" auto-rotate rotation-per-second="18deg" shadow-intensity="0.7" exposure="1.05" interaction-prompt="auto"></model-viewer>
        <p class="note">{html.escape(spec["model_note"])}</p>
      </div>
"""


def page(spec, body, words):
    asides = "\n          ".join(
        f'<button type="button" data-voice="{voice}" data-line="{html.escape(line)}"><small>{label}</small>{html.escape(line)}</button>'
        for voice, label, line in ASIDES[spec["file"]]
    )
    description = html.escape(spec["dek"])
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(spec["title"])} · The Orchard of Unspent Hours</title>
  <meta name="description" content="{description}">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,650&family=Literata:ital,opsz,wght@0,7..72,460;0,7..72,650;1,7..72,460&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/site.css">
  {('<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js"></script>' if spec.get("model") else "")}
</head>
<body data-narrator="{spec["narrator"]}">
  <a class="skip" href="#story">Skip to the story</a>
  <header class="top">
    <a class="brand" href="index.html">The Orchard of Unspent Hours</a>
    <nav aria-label="Story">
        {nav(spec["current"])}
    </nav>
  </header>
  <section class="hero">
    {hero_media(spec)}
    <div class="hero-copy">
      <p class="kicker">{html.escape(spec["kicker"])}</p>
      <h1>{html.escape(spec["title"])}</h1>
      <p class="dek">{description}</p>
    </div>
  </section>
  <main class="layout">
    <article class="story" id="story">
{body}
    </article>
    {model_panel(spec)}
  </main>
  <nav class="pager" aria-label="Parts">
    {pager_link(spec["prev"], "prev")}
    {pager_link(spec["next"], "next")}
  </nav>
  <footer class="site-foot">
    <p>An English story in three parts. {words} words across the beginning, the middle, and the end. The voices use Grok when the server has an API key.</p>
  </footer>
  <div class="player">
    <img src="images/{spec["narrator"]}.jpg" alt="">
    <div>
      <p class="who-now"></p>
      <p class="status"></p>
      <div class="track" aria-hidden="true"><span></span></div>
    </div>
    <div class="player-actions">
      <button type="button" data-action="play">Play</button>
      <button type="button" data-action="stop">Stop</button>
      <button type="button" data-action="slow" aria-pressed="false">Slower English</button>
    </div>
  </div>
  <script src="js/reader.js"></script>
</body>
</html>
"""


def main():
    total = 0
    for spec in PAGES:
        items = paragraphs(ROOT / "content" / spec["source"])
        words = sum(len(re.findall(r"[A-Za-z0-9''-]+", text)) for _, text in items)
        total += words
        (ROOT / spec["file"]).write_text(page(spec, story_html(items), "COUNT"))
        print(spec["file"], words)
    for path in ROOT.glob("*.html"):
        if path.name == "notes.html":
            continue
        text = path.read_text().replace("COUNT", str(total))
        path.write_text(text)
    print("TOTAL", total)


if __name__ == "__main__":
    main()
