import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { CaromState, ReadState } from "./game";
import * as C from "./constants";
import { startMatch, title } from "./debug";
export function menuItems(s: ReadState): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: ReadState, index: number) {
  if (index < 0 || index >= menuItems(s).length) return null;
  return {
    x: 475,
    y:
      (s.screen === "howto" ? 595 : s.screen === "title" ? 355 : 360) +
      index * 66,
    w: 330,
    h: 54,
  };
}
function confirm(s: ReadState): CaromState {
  const i = s.menuIndex;
  switch (s.screen) {
    case "title":
      return i < 2
        ? startMatch({ ...s, titleIndex: i }, i === 0 ? "solo" : "versus")
        : { ...s, titleIndex: i, screen: "howto", menuIndex: 0 };
    case "howto":
      return title(s);
    case "paused":
      return i === 0
        ? { ...s, screen: s.resumeScreen }
        : i === 1
          ? startMatch(s, s.mode)
          : title(s);
    case "matchover":
      return i === 0 ? startMatch(s, s.mode) : title(s);
    default:
      return s;
  }
}
export function readInput(state: ReadState, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const samples = api.input.pointerSamples();
  api.input.pointer();
  api.input.pointerContacts();
  let s: CaromState = {
    ...state,
    muted: edges.mute ? !state.muted : state.muted,
  };
  const screen = state.screen;
  if ((screen === "playing" || screen === "countdown") && edges.pause)
    return { ...s, resumeScreen: screen, screen: "paused", menuIndex: 0 };
  if (screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen };
  if ((screen === "howto" || screen === "matchover") && edges.back)
    return title(s);
  const count = menuItems(s).length;
  if (!count) return s;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  if (up || down)
    s = { ...s, menuIndex: (s.menuIndex + (up ? -1 : 1) + count) % count };
  const keyboardConfirm = edges.confirm && !up && !down;
  // Remember each contact's landing region so releases cannot confirm a drag
  // that began outside this item, including gestures spanning several frames.
  let pointerConfirm = false;
  const origins = { ...state.menuContacts };
  const keyboardIndex = s.menuIndex;
  for (const p of samples) {
    const index = menuItems(s).findIndex((_, i) => {
      const r = menuItemRect(s, i)!;
      return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    });
    if (p.type === "down") origins[p.id] = { index, screen };
    if (p.type === "up") {
      if (
        index >= 0 &&
        origins[p.id]?.index === index &&
        origins[p.id]?.screen === screen
      )
        pointerConfirm = true;
      delete origins[p.id];
    }
    if (index >= 0) s = { ...s, menuIndex: index };
  }
  s = { ...s, menuContacts: origins };
  if (keyboardConfirm) return confirm({ ...s, menuIndex: keyboardIndex });
  return pointerConfirm ? confirm(s) : s;
}
