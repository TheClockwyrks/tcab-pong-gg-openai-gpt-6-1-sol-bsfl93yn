import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { initialState, makeDebug } from "./debug";
import { readInput } from "./menus";
import { advance } from "./simulation";
import { render } from "./render";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}

export interface CaromState {
  readonly menuContacts?: Readonly<
    Record<number, { readonly index: number; readonly screen: Screen }>
  >;
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;

  readonly simTime: number;
  readonly muted: boolean;
}
export type ReadState = DeepReadonly<CaromState>;
export type CaromDebugApi = ReturnType<typeof makeDebug>;
export const BACKGROUND = "#0b121a";
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    [
      C.CUES.paddleHit,
      C.CUES.wallBounce,
      C.CUES.obstacleBounce,
      C.CUES.score,
    ].forEach((cue, i) =>
      api.audio.define(cue, {
        wave: i === 2 ? "triangle" : "sine",
        freq: [540, 230, 780, 980][i],
        freqTo: [230, 120, 420, 1300][i],
        durationMs: [85, 60, 100, 180][i],
        gain: 0.16,
      }),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => s.score.p1 + " : " + s.score.p2);
    api.diagnostics.register("ball position", (s) =>
      s.ball ? s.ball.x.toFixed(1) + ", " + s.ball.y.toFixed(1) : "none",
    );
    api.diagnostics.register("ball velocity", (s) =>
      s.ball ? s.ball.vx.toFixed(1) + ", " + s.ball.vy.toFixed(1) : "none",
    );
    api.diagnostics.register("speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "none",
    );
    api.diagnostics.register("spin", (s) => s.ball?.spin ?? "none");
    for (const side of ["left", "right"] as const) {
      api.diagnostics.register(side + " cy", (s) => s.paddles[side].cy);
      api.diagnostics.register(side + " vy", (s) => s.paddles[side].vy);
    }
    return [initialState(false), makeDebug()];
  },
  update(state, api, dt) {
    api.audio.setMuted(state.muted);
    const next = readInput(state, api);
    const result = advance({ ...next, simTime: state.simTime + dt }, api, dt);
    api.audio.setMuted(result.muted);
    return result;
  },
  render,
};
