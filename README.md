# DIMOOOON

A joke racing game: pick a car and overtake 10 cars. Spoiler: only one car can do it, and only with downpipes.

Plain HTML + CSS + JavaScript — no build step, no dependencies (only the Nunito font from Google Fonts).

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .            # or: python3 -m http.server
```

## Put it on a website

Upload these files to any static hosting (Netlify, GitHub Pages, Vercel, your own server) into one folder:

- `index.html`
- `style.css`
- `race.js` — game logic and drawing (no DOM)
- `game.js` — car selection, game loop, keyboard/touch input, result screen

## Controls

- `←` `→` (or `A` `D`) — steer
- `Space` / `Enter` — install downpipes when the button shows up
- `Esc` — back to car selection
- On phones and tablets: ◀ ▶ buttons under the road
