import type { RenderApi } from "@clockwyrks/simple-2d";
import type { ReadState } from "./game";
import { BACKGROUND } from "./game";
import * as C from "./constants";
import { menuItems, menuItemRect } from "./menus";
const INK = "#edf5f3",
  MUTED = "#71828f",
  TEAL = "#66e8d1",
  CORAL = "#ff897b",
  GOLD = "#e9c47b";
export function render(s: ReadState, { ctx: g }: RenderApi): void {
  const text = (
    copy: string,
    x: number,
    y: number,
    size = 14,
    color = MUTED,
    align: CanvasTextAlign = "left",
    weight = 400,
  ) => {
    g.fillStyle = color;
    g.textAlign = align;
    g.font =
      weight +
      " " +
      size +
      "px " +
      (size >= 36 ? "Arial, sans-serif" : "monospace");
    g.fillText(copy, x, y);
  };
  const line = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    color: string,
  ) => {
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
  };
  const bar = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    r = 6,
  ) => {
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
  };
  const circle = (x: number, y: number, r: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  g.fillStyle = BACKGROUND;
  g.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  // Subtle drafting grid keeps the court readable without competing with play.
  g.fillStyle = "#18232d";
  for (let x = 32; x < C.FIELD_W; x += 32)
    for (let y = 24; y < C.FIELD_H; y += 32) g.fillRect(x, y, 1, 1);
  const menu = menuItems(s).length > 0;
  g.save();
  if (menu)
    g.globalAlpha = s.screen === "title" || s.screen === "howto" ? 0.22 : 0.3;
  g.setLineDash([7, 13]);
  line(C.NET_X, 116, C.NET_X, 640, "#31424e");
  g.setLineDash([]);
  line(32, 2, C.FIELD_W - 32, 2, "#42505a");
  line(32, C.FIELD_H - 2, C.FIELD_W - 32, C.FIELD_H - 2, "#42505a");
  g.strokeStyle = "#23313c";
  g.lineWidth = 1;
  g.beginPath();
  g.arc(C.FIELD_CX, C.FIELD_CY, 76, 0, Math.PI * 2);
  g.stroke();
  for (const o of s.obstacles) {
    g.save();
    g.translate(o.cx, o.cy);
    g.rotate(o.theta);
    g.shadowColor = GOLD;
    g.shadowBlur = 18;
    bar(-C.OBSTACLE_HW, -C.OBSTACLE_HH, C.OBSTACLE_W, C.OBSTACLE_H, GOLD, 5);
    g.shadowBlur = 0;
    circle(0, 0, 3, "#51452f");
    g.restore();
  }
  g.shadowBlur = 20;
  g.shadowColor = TEAL;
  bar(C.P1_X0, s.paddles.left.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, TEAL);
  g.shadowColor = CORAL;
  bar(
    C.P2_X0,
    s.paddles.right.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    CORAL,
  );
  g.shadowBlur = 0;
  const b = s.ball;
  if (b) {
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      g.globalAlpha = (((menu ? 0.2 : 1) * i) / b.trail.length) * 0.5;
      g.strokeStyle = INK;
      g.lineWidth = (2 * C.BALL_R * i) / b.trail.length;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(p.x, p.y);
      g.stroke();
    }
    g.globalAlpha = menu ? 0.22 : 1;
    g.shadowColor = INK;
    g.shadowBlur = 18;
    circle(b.x, b.y, C.BALL_R, INK);
    g.shadowBlur = 0;
  }
  g.restore();
  if (!menu) {
    text("CAROM", 32, 40, 18, INK, "left", 700);
    text(
      s.mode === "solo" ? "SOLO / HUMAN vs MACHINE" : "VERSUS / LOCAL DUEL",
      32,
      62,
      11,
    );
    text(String(s.score.p1), C.FIELD_CX - 105, 83, 64, TEAL, "center", 700);
    text(String(s.score.p2), C.FIELD_CX + 105, 83, 64, CORAL, "center", 700);
    text(
      "FIRST TO " + C.WIN_SCORE + " · WIN BY " + C.WIN_LEAD,
      C.FIELD_CX,
      109,
      10,
      MUTED,
      "center",
    );
    text("P  PAUSE", C.FIELD_W - 32, 40, 12, MUTED, "right");
    text(
      s.muted ? "M  SOUND OFF" : "M  SOUND ON",
      C.FIELD_W - 32,
      62,
      11,
      MUTED,
      "right",
    );
    text(s.mode === "solo" ? "W / S  OR  ↑ / ↓" : "W / S", 32, 687, 12, TEAL);
    text(
      s.mode === "solo" ? "COMPUTER" : "↑ / ↓",
      C.FIELD_W - 32,
      687,
      12,
      CORAL,
      "right",
    );
    text(
      "MOVE AT CONTACT. BEND THE RALLY.",
      C.FIELD_CX,
      690,
      11,
      MUTED,
      "center",
    );
    if (s.screen === "countdown") {
      bar(540, 420, 200, 60, "#111e29", 10);
      text("GET READY", C.FIELD_CX, 445, 12, TEAL, "center");
      text(
        "SERVE  " + Math.max(1, Math.ceil(b?.holdTimer ?? 1)),
        C.FIELD_CX,
        467,
        15,
        INK,
        "center",
      );
    }
    return;
  }
  // A calm, editorial menu above the physical court.
  if (s.screen === "title" || s.screen === "howto") {
    const grad = g.createLinearGradient(370, 0, 910, 0);
    grad.addColorStop(0, "#0b121a00");
    grad.addColorStop(0.18, BACKGROUND);
    grad.addColorStop(0.82, BACKGROUND);
    grad.addColorStop(1, "#0b121a00");
    g.fillStyle = grad;
    g.fillRect(300, 0, 680, C.FIELD_H);
  }
  text("C /", 40, 49, 22, TEAL, "left", 700);
  text("INDEPENDENT ARCADE", 88, 48, 11);
  text("01 — PADDLE DUEL", C.FIELD_W - 40, 48, 11, MUTED, "right");
  if (s.screen === "title") {
    text("A GAME OF ANGLES", C.FIELD_CX, 167, 12, TEAL, "center");
    text(C.TITLE_TEXT, C.FIELD_CX, 279, 112, INK, "center", 800);
    line(543, 302, 737, 302, "#384650");
    text(
      "Two paddles. Two obstacles. A different ricochet.",
      C.FIELD_CX,
      330,
      12,
      MUTED,
      "center",
    );
    text("SPIN THE SHOT. FIND THE GAP.", C.FIELD_CX, 605, 12, GOLD, "center");
  } else if (s.screen === "howto") {
    text("THE ART OF THE RETURN", C.FIELD_CX, 149, 12, TEAL, "center");
    text("HOW TO PLAY", C.FIELD_CX, 213, 48, INK, "center", 700);
    const rows = [
      [
        "01",
        "TAKE YOUR SIDE",
        "Solo: W / S or ↑ / ↓. Versus: W / S left, ↑ / ↓ right.",
      ],
      [
        "02",
        "PUT A CURVE ON IT",
        "Move as you strike to add spin. Edge hits send sharper angles.",
      ],
      [
        "03",
        "PLAY THE BANK",
        "Gold obstacles sway and rotate. Use their faces to find a gap.",
      ],
      [
        "04",
        "CLOSE THE MATCH",
        "First to " +
          C.WIN_SCORE +
          ", ahead by " +
          C.WIN_LEAD +
          ". P / Esc pauses. M toggles sound.",
      ],
    ];
    rows.forEach((r, i) => {
      const y = 277 + i * 73;
      text(r[0], 260, y, 14, TEAL);
      text(r[1], 310, y, 14, INK, "left", 700);
      text(r[2], 310, y + 25, 12);
    });
  } else {
    bar(405, 140, 470, 450, "#0d1823", 16);
    g.strokeStyle = "#2c3c49";
    g.lineWidth = 1;
    g.strokeRect(426, 160, 428, 410);
    text(
      s.screen === "paused" ? "TIME OUT" : "MATCH COMPLETE",
      C.FIELD_CX,
      218,
      12,
      TEAL,
      "center",
    );
    text(
      s.screen === "paused"
        ? "PAUSED"
        : s.winner === "left"
          ? "PLAYER ONE WINS"
          : s.mode === "solo"
            ? "COMPUTER WINS"
            : "PLAYER TWO WINS",
      C.FIELD_CX,
      280,
      s.screen === "paused" ? 56 : 32,
      INK,
      "center",
      700,
    );
    text(
      s.score.p1 + "  /  " + s.score.p2,
      C.FIELD_CX,
      322,
      24,
      MUTED,
      "center",
    );
  }
  menuItems(s).forEach((item, i) => {
    const r = menuItemRect(s, i)!,
      active = i === s.menuIndex;
    bar(r.x, r.y, r.w, r.h, active ? TEAL : "#14212c", 7);
    text(
      String(i + 1).padStart(2, "0"),
      r.x + 18,
      r.y + 33,
      11,
      active ? "#315c58" : MUTED,
    );
    text(
      item,
      C.FIELD_CX,
      r.y + 34,
      16,
      active ? BACKGROUND : INK,
      "center",
      700,
    );
    if (active) text("→", r.x + r.w - 24, r.y + 33, 18, BACKGROUND, "center");
  });
  line(40, 655, C.FIELD_W - 40, 655, "#23313c");
  text("↑ ↓ / W S  SELECT     ENTER  CONFIRM", 40, 686, 11);
  text(
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    C.FIELD_W - 40,
    686,
    11,
    MUTED,
    "right",
  );
}
