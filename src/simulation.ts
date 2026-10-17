import type { UpdateApi } from "@clockwyrks/simple-2d";
import type {
  BallState,
  CaromState,
  ReadState,
  PaddleState,
  ObstacleState,
} from "./game";
import * as C from "./constants";
import { clamp, obstacle, parked } from "./debug";
type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
function integrate(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
function paddleHit(
  b: MovingBall,
  p: PaddleState,
  x0: number,
  x1: number,
  left: boolean,
  cues: Set<string>,
) {
  const y0 = p.cy - C.PADDLE_HALF,
    y1 = p.cy + C.PADDLE_HALF,
    r = C.BALL_R;
  if (!(b.x > x0 - r && b.x < x1 + r && b.y > y0 - r && b.y < y1 + r)) return;
  const depths = [b.x - (x0 - r), x1 + r - b.x, b.y - (y0 - r), y1 + r - b.y];
  const face = depths.indexOf(Math.min(...depths));
  if (face >= 2) {
    b.y = face === 2 ? y0 - r : y1 + r;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    return;
  }
  b.x = face === 0 ? x0 - r : x1 + r;
  if (!((face === 0 && b.vx > 0) || (face === 1 && b.vx < 0))) return;
  const angle = clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
  const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
  b.vx = (left ? 1 : -1) * speed * Math.cos(angle);
  b.vy = speed * Math.sin(angle);
  b.spin = clamp(
    b.spin + p.vy * C.SPIN_FROM_PADDLE,
    -C.SPIN_CLAMP,
    C.SPIN_CLAMP,
  );
  b.x = left ? C.P1_X1 + r : C.P2_X0 - r;
  cues.add(C.CUES.paddleHit);
}
function obstacleHit(b: MovingBall, o: ObstacleState, cues: Set<string>) {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta),
    dx = b.x - o.cx,
    dy = b.y - o.cy;
  const x = dx * c + dy * s,
    y = -dx * s + dy * c;
  const qx = clamp(x, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(y, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const d = Math.hypot(x - qx, y - qy);
  if (d >= C.BALL_R) return;
  let nx: number, ny: number, push: number;
  if (d > 0) {
    nx = (x - qx) / d;
    ny = (y - qy) / d;
    push = C.BALL_R - d;
  } else {
    const px = C.OBSTACLE_HW - Math.abs(x),
      py = C.OBSTACLE_HH - Math.abs(y);
    nx = px <= py ? (x >= 0 ? 1 : -1) : 0;
    ny = px <= py ? 0 : y >= 0 ? 1 : -1;
    push = C.BALL_R + Math.min(px, py);
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c,
    dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    cues.add(C.CUES.obstacleBounce);
  }
  b.x += wx * push;
  b.y += wy * push;
}
export function advance(s: ReadState, api: UpdateApi, dt: number): CaromState {
  if (s.screen !== "playing" && s.screen !== "countdown") return s;
  const val = (a: C.ActionName) => api.input.value(a) > 0;
  const axis = (up: boolean, down: boolean) =>
    (Number(down) - Number(up)) * C.PADDLE_SPEED;
  const lp = s.paddles.left,
    rp = s.paddles.right;
  const lv = lp.driven
    ? lp.drivenVy
    : axis(
        val("p1-up") || (s.mode === "solo" && val("p2-up")),
        val("p1-down") || (s.mode === "solo" && val("p2-down")),
      );
  let rv = axis(val("p2-up"), val("p2-down"));
  if (s.mode === "solo") {
    const tracking =
      s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0;
    const target = tracking ? s.ball!.y - s.ball!.vy * C.AI_REACT : C.AI_HOME_Y;
    const diff = target - rp.cy,
      dead = tracking ? C.AI_DEADZONE : C.AI_HOME_DEADZONE;
    rv =
      s.ai.movement && Math.abs(diff) > dead
        ? Math.sign(diff) *
          Math.min(C.AI_SPEED, dt > 0 ? Math.abs(diff) / dt : 0)
        : 0;
  }
  const paddles = {
    left: integrate(lp, lv, dt),
    right: integrate(rp, rp.driven ? rp.drivenVy : rv, dt),
  };
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  let next: CaromState = {
    ...s,
    paddles,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, clock)),
  };
  if (!s.ball) return next;
  const b: MovingBall = { ...s.ball };
  const cues = new Set<string>();
  let served = false;
  if (s.screen === "countdown") {
    b.holdTimer = Math.max(0, b.holdTimer - dt);
    if (b.holdTimer <= 0) {
      b.held = false;
      b.vx =
        (s.receiver === "left" ? -1 : 1) *
        C.SERVE_SPEED *
        Math.cos(C.SERVE_ANGLE);
      b.vy = b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE);
      b.trail = [];
      next = { ...next, screen: "playing" };
      served = true;
    }
  } else if (!b.held) {
    const n = Math.max(
        1,
        Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
      ),
      h = dt / n;
    for (let i = 0; i < n; i++) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 0) {
        const a = (b.spin / speed) * h,
          c = Math.cos(a),
          sn = Math.sin(a),
          vx = b.vx;
        b.vx = vx * c - b.vy * sn;
        b.vy = vx * sn + b.vy * c;
      }
      b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
      b.x += b.vx * h;
      b.y += b.vy * h;
      if (b.y - C.BALL_R < 0 && b.vy < 0) {
        b.y = C.BALL_R;
        b.vy = -b.vy;
        cues.add(C.CUES.wallBounce);
      } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
        b.y = C.FIELD_H - C.BALL_R;
        b.vy = -b.vy;
        cues.add(C.CUES.wallBounce);
      }
      paddleHit(b, paddles.left, C.P1_X0, C.P1_X1, true, cues);
      paddleHit(b, paddles.right, C.P2_X0, C.P2_X1, false, cues);
      for (const o of s.obstacles) obstacleHit(b, o, cues);
    }
  }
  b.trail = served
    ? []
    : [...b.trail, { x: b.x, y: b.y, t: s.simTime }].filter(
        (p) => s.simTime - p.t <= C.TRAIL_TIME,
      );
  next = { ...next, ball: b };
  if (
    s.screen === "playing" &&
    (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)
  ) {
    const left = b.x > C.FIELD_W,
      score = { p1: s.score.p1 + Number(left), p2: s.score.p2 + Number(!left) };
    cues.add(C.CUES.score);
    const won = left
      ? score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD
      : score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD;
    next = won
      ? {
          ...next,
          score,
          winner: left ? "left" : "right",
          screen: "matchover",
          menuIndex: 0,
        }
      : {
          ...next,
          score,
          receiver: left ? "right" : "left",
          ball: parked(),
          screen: "countdown",
        };
  }
  for (const cue of cues) api.audio.play(cue);
  return next;
}
