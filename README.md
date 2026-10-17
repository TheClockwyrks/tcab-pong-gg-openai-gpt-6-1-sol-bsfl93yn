# Carom

A browser-native paddle duel about spin, moving obstacles, and unlikely bank shots.
Play against the computer in **Solo**, or share a keyboard in **Versus**. First to
11 wins, with a two-point lead required.

## Run locally

Requires Node.js 22.12+ (or a current Node.js release).

- `npm ci` — install the locked dependencies.
- `npm run dev` — start the Vite development server.
- `npm run build` — type-check and build the static site into `dist/`.
- `npm run preview` — serve the production build locally.

Deploy the contents of `dist/` to any static host. No server, external assets,
credentials, or network connection are needed to play.

## Controls

| Control | Effect |
| --- | --- |
| W / S | Move the left paddle |
| ↑ / ↓ | Move the right paddle in Versus; also the left in Solo |
| Enter / Space | Confirm a menu selection |
| W / S or ↑ / ↓ | Navigate menus |
| P / Escape | Pause and resume |
| Escape | Back from instructions or results |
| M | Toggle sound |
| Backtick | Engine diagnostic overlay |

Menus also support mouse and touch. Touch devices get the engine's two vertical
sliders. Strike while moving to add spin; strike near a paddle's end for a steep
return. Gold obstacles rotate and sway: their angled faces can help or hurt you.

## Development

The simulation is independent of rendering. The Simple 2D engine owns the clock,
input, audio synthesis, fitting, and recording. The typed debug API is returned
through the engine, with immutable state transitions and scenario controls.

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test`.
The tests run the real engine on a Node canvas with counted, deterministic frames.
The player-facing presentation and captured media are in `showcase/`.
