# The Orchard of Unspent Hours

English story site for the AI workshop: three linked pages, seven generated images, character voices, and questions after the ending.

## Voices

The pages can be read with no key. Play, Hear this, and the question box call two server routes:

- `POST /api/speak` sends a line to Grok text-to-speech (`https://api.x.ai/v1/tts`)
- `POST /api/ask` asks Grok 4.3 to answer in character, then the page speaks that answer

The key stays on the server. It is not in the HTML or JavaScript.

On Vercel, open the project, then Settings, then Environment Variables, and add:

```
XAI_API_KEY=your_key_here
```

Redeploy after saving it. For a local trial, copy `.env.example` to `.env.local`, put the key there, and run `npx vercel dev` inside this folder.

Voices: Lina is `eve`, Bram is `leo`, Sera is `ara`, Edwin is `rex`.

## Pages

- `index.html` — beginning, told mostly by Lina
- `middle.html` — middle, told mostly by Bram
- `ending.html` — end, told mostly by Sera, then the question room
- `notes.html` — characters, places, images, prompts, and a short way to present the work

Story text lives in `content/`. Run `python3 build_pages.py` after editing it.

## Deploy

This folder is the project root. Connect it to Vercel as a static site with the `api` functions included. Do not deploy the parent University folder.
