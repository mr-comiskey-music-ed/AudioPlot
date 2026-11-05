import { CableConnection, EnvironmentMode, MixerChannelState, PlacedGear } from '../../types';
import { getSnakeBoxBounds, getSnakeChannelPosition, getSnakeOutputPosition } from './canvasMath';

/**
 * Stage-style XLR routing. All XLR runs are laid out together so they can share bundles:
 *
 *  - Inputs (mic / DI -> snake input): each run goes straight up (or down) from its gear to a shared
 *    trunk just downstage of the snake, rides it in a tight bundle, then turns up into its socket.
 *    Lanes are ordered so runs in the same bundle don't cross (outermost gear gets the lane nearest
 *    the snake). Runs patched out of stage order still have to cross near the snake, as they would
 *    on a real stage.
 *  - Outputs (snake MAIN / MON -> PA, wedge, IEM): out the side of the snake (under the snake box),
 *    to the side wall (MAIN L left, MAIN R right, monitors whichever wall is closer), down the wall,
 *    then into a PA from the side, or along the downstage edge and up into a wedge.
 *  - Speaker/wedge links (wedge -> wedge, PA -> PA): along the downstage edge.
 *
 * Gaff tape goes across bundles (the input trunk, walls, the downstage edge) at regular spacing,
 * never on the short individual drops.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface RoutedCable {
  points: Pt[];
  d: string;
  /** Where the unpatch button sits: the middle of the longest visible straight piece. */
  midPoint: Pt;
}

export interface GaffStrip {
  x: number;
  y: number;
  /** Length across the bundle. */
  length: number;
  /** 'v' = the strip runs up/down (taping a horizontal bundle); 'h' = left/right. */
  orientation: 'v' | 'h';
  seed: number;
}

export interface CableRouting {
  /** Keys: `in:<channel>` for snake inputs, `conn:<connection id>` for XLR connections. */
  cables: Map<string, RoutedCable>;
  tape: GaffStrip[];
}

const GAP = 6; // space between parallel runs in a bundle
const WALL = 12; // first wall lane, in from the edge of the stage
const FRONT = 12; // first downstage lane, up from the front edge
const CORNER = 6; // corner rounding
const TAPE_EVERY = 170;

type Kind = 'drop' | 'trunk' | 'wall' | 'front' | 'exit' | 'hidden';
interface Seg {
  a: Pt;
  b: Pt;
  kind: Kind;
  bundle: string;
}

const isOutputTarget = (gearId: string) =>
  gearId === 'gear_stage_monitor' || gearId === 'gear_pa_speaker' || gearId === 'gear_iem_transmitter';

/** Rounded right-angle path through the points. */
export function pathThrough(points: Pt[], r = CORNER): string {
  const pts = points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 0.5);
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const l1 = Math.hypot(p0.x - p1.x, p0.y - p1.y);
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr > 1) {
      const sx = p1.x + ((p0.x - p1.x) / l1) * rr;
      const sy = p1.y + ((p0.y - p1.y) / l1) * rr;
      const ex = p1.x + ((p2.x - p1.x) / l2) * rr;
      const ey = p1.y + ((p2.y - p1.y) / l2) * rr;
      d += ` L ${sx} ${sy} Q ${p1.x} ${p1.y} ${ex} ${ey}`;
    } else {
      d += ` L ${p1.x} ${p1.y}`;
    }
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

export function routeXlrCables(opts: {
  environment: EnvironmentMode;
  placedGear: PlacedGear[];
  connections: CableConnection[];
  mixerChannels: MixerChannelState[];
  world: { width: number; height: number };
  getGearCenter: (g: PlacedGear) => Pt;
}): CableRouting {
  const { environment, placedGear, connections, mixerChannels, world, getGearCenter } = opts;
  const W = world.width;
  const H = world.height;
  const box = getSnakeBoxBounds(environment, W, H);
  const inSnake = (p: Pt) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
  const gearById = new Map(placedGear.map((g) => [g.instanceId, g]));

  const cables = new Map<string, RoutedCable>();
  const segs: Seg[] = [];

  const finish = (key: string, points: Pt[], kinds: Kind[], bundles: string[]) => {
    // kinds[i] / bundles[i] describe the segment from points[i] to points[i+1]
    let best: { len: number; mid: Pt } | null = null;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const kind = inSnake(a) && inSnake(b) ? 'hidden' : kinds[i];
      segs.push({ a, b, kind, bundle: bundles[i] });
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (kind !== 'hidden' && !inSnake(mid) && (!best || len > best.len)) best = { len, mid };
    }
    cables.set(key, { points, d: pathThrough(points), midPoint: best?.mid ?? points[0] });
  };

  // ---------- Inputs: up to a shared trunk under the snake ----------
  const trunkBase = box.y + box.h + 20;
  type In = { ch: number; g: Pt; s: Pt };
  const inputs: In[] = [];
  for (const ch of mixerChannels) {
    const gear = ch.assignedGearInstanceId ? gearById.get(ch.assignedGearInstanceId) : undefined;
    if (!gear) continue;
    inputs.push({ ch: ch.channelNumber, g: getGearCenter(gear), s: getSnakeChannelPosition(ch.channelNumber, environment, W, H) });
  }
  const straight = inputs.filter((c) => Math.abs(c.g.x - c.s.x) < 4);
  const fromLeft = inputs.filter((c) => c.g.x <= c.s.x - 4).sort((a, b) => a.g.x - b.g.x);
  const fromRight = inputs.filter((c) => c.g.x >= c.s.x + 4).sort((a, b) => b.g.x - a.g.x);
  // If the two bundles reach past each other under the snake, give the right one its own lanes.
  const overlap =
    fromLeft.length > 0 &&
    fromRight.length > 0 &&
    Math.max(...fromLeft.map((c) => c.s.x)) > Math.min(...fromRight.map((c) => c.s.x));
  const rightStart = overlap ? fromLeft.length : 0;
  const laneRun = (c: In, lane: number, bundle: string) => {
    const y = trunkBase + lane * GAP;
    finish(`in:${c.ch}`, [c.g, { x: c.g.x, y }, { x: c.s.x, y }, c.s], ['drop', 'trunk', 'hidden'], ['', bundle, '']);
  };
  fromLeft.forEach((c, i) => laneRun(c, i, 'trunk-left'));
  fromRight.forEach((c, i) => laneRun(c, rightStart + i, overlap ? 'trunk-right' : 'trunk-left'));
  straight.forEach((c) => finish(`in:${c.ch}`, [c.g, { x: c.g.x, y: c.s.y }], ['drop'], ['']));

  // ---------- Outputs: out the side of the snake, along the walls ----------
  type Out = { key: string; s: Pt; t: Pt; front: boolean };
  const sides: Record<'left' | 'right', Out[]> = { left: [], right: [] };
  const links: Array<{ key: string; a: Pt; b: Pt }> = [];
  for (const c of connections) {
    if (c.cableType !== 'xlr') continue;
    const fromSnake = c.fromInstanceId.startsWith('snake_out_');
    const toSnake = c.toInstanceId.startsWith('snake_out_');
    if (fromSnake || toSnake) {
      const port = (fromSnake ? c.fromInstanceId : c.toInstanceId).replace('snake_out_', '') as 'mon1' | 'mon2' | 'main_l' | 'main_r';
      const target = gearById.get(fromSnake ? c.toInstanceId : c.fromInstanceId);
      if (!target) continue;
      const t = getGearCenter(target);
      const s = getSnakeOutputPosition(port, environment, W, H);
      const side = port === 'main_l' ? 'left' : port === 'main_r' ? 'right' : t.x < W / 2 ? 'left' : 'right';
      sides[side].push({ key: `conn:${c.id}`, s, t, front: target.gearId === 'gear_stage_monitor' });
    } else {
      const a = gearById.get(c.fromInstanceId);
      const b = gearById.get(c.toInstanceId);
      if (!a || !b) continue;
      if (isOutputTarget(a.gearId) && isOutputTarget(b.gearId)) links.push({ key: `conn:${c.id}`, a: getGearCenter(a), b: getGearCenter(b) });
      else {
        const pa = getGearCenter(a);
        const pb = getGearCenter(b);
        finish(`conn:${c.id}`, [pa, { x: pa.x, y: pb.y }, pb], ['drop', 'drop'], ['', '']);
      }
    }
  }

  let frontLanesUsed = 0;
  for (const side of ['left', 'right'] as const) {
    const list = sides[side];
    const fromWall = (o: Out) => (side === 'left' ? o.t.x : W - o.t.x);
    // Outermost lane first: wedges (farthest from the wall first), then side entries (deepest first).
    const fronts = list.filter((o) => o.front).sort((a, b) => fromWall(b) - fromWall(a));
    const others = list.filter((o) => !o.front).sort((a, b) => b.t.y - a.t.y);
    const ordered = [...fronts, ...others];
    ordered.forEach((o, k) => {
      const wallX = side === 'left' ? WALL + k * GAP : W - WALL - k * GAP;
      const exitY = box.y + 40 + k * GAP; // inside the snake box, so the start is hidden under it
      const head: Pt[] = [o.s, { x: o.s.x, y: exitY }, { x: wallX, y: exitY }];
      const headKinds: Kind[] = ['hidden', 'exit'];
      const headBundles = ['', `exit-${side}`];
      if (o.front) {
        const fy = H - FRONT - fronts.indexOf(o) * GAP;
        finish(
          o.key,
          [...head, { x: wallX, y: fy }, { x: o.t.x, y: fy }, o.t],
          [...headKinds, 'wall', 'front', 'drop'],
          [...headBundles, `wall-${side}`, `front-${side}`, '']
        );
      } else {
        finish(o.key, [...head, { x: wallX, y: o.t.y }, o.t], [...headKinds, 'wall', 'drop'], [...headBundles, `wall-${side}`, '']);
      }
    });
    frontLanesUsed = Math.max(frontLanesUsed, fronts.length);
  }
  // Wedge-to-wedge and PA-to-PA links run along the downstage edge, just inside the monitor runs.
  links.forEach((l, i) => {
    const fy = H - FRONT - (frontLanesUsed + i) * GAP;
    finish(l.key, [l.a, { x: l.a.x, y: fy }, { x: l.b.x, y: fy }, l.b], ['drop', 'front', 'drop'], ['', 'front-links', '']);
  });

  // Every unpatch button on the stage, so tape never lands on one: the XLR runs' and the 1/4" runs'
  // (those are curves drawn elsewhere; their button sits at the middle of the curve).
  const badges: Pt[] = [...cables.values()].map((c) => c.midPoint);
  for (const c of connections) {
    if (c.cableType === 'xlr') continue;
    const a = gearById.get(c.fromInstanceId);
    const b = gearById.get(c.toInstanceId);
    if (!a || !b) continue;
    const pa = getGearCenter(a);
    const pb = getGearCenter(b);
    badges.push({ x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 + 12.5 });
  }

  return { cables, tape: placeTape(segs, inSnake, badges) };
}

/** Gaff strips across each bundle at regular spacing, clear of corners. */
function placeTape(segs: Seg[], hidden: (p: Pt) => boolean, badges: Pt[]): GaffStrip[] {
  const strips: GaffStrip[] = [];
  const groups = new Map<string, Seg[]>();
  for (const s of segs) {
    if (!s.bundle || s.kind === 'hidden' || s.kind === 'drop') continue;
    const horizontal = Math.abs(s.a.y - s.b.y) < 0.5;
    const key = `${s.bundle}|${horizontal ? 'h' : 'v'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  for (const [key, list] of groups) {
    const horizontal = key.endsWith('|h');
    // along = position along the bundle; across = position across it
    const along = (p: Pt) => (horizontal ? p.x : p.y);
    const across = (p: Pt) => (horizontal ? p.y : p.x);
    const spans = list.map((s) => ({ lo: Math.min(along(s.a), along(s.b)), hi: Math.max(along(s.a), along(s.b)), at: across(s.a) }));
    const lo = Math.min(...spans.map((s) => s.lo));
    const hi = Math.max(...spans.map((s) => s.hi));
    const length = hi - lo;
    if (length < 50) continue;
    const count = Math.max(1, Math.floor(length / TAPE_EVERY));
    // A strip at `pos` covers what's under it; returns null if it would hit an unpatch button.
    const stripAt = (pos: number) => {
      const under = spans.filter((s) => pos > s.lo + 18 && pos < s.hi - 18);
      if (under.length === 0) return null;
      const a = Math.min(...under.map((s) => s.at));
      const b = Math.max(...under.map((s) => s.at));
      // button radius ~10, tape half-width ~6, plus room for the tilt and the torn ends
      const blocked = badges.some((p) => Math.abs(along(p) - pos) < 22 && across(p) > a - 20 && across(p) < b + 20);
      return blocked ? null : { a, b };
    };
    for (let i = 0; i < count; i++) {
      const ideal = lo + (length * (i + 0.5)) / count;
      // Slide along the bundle to clear a button; skip this strip if there's no clear spot nearby.
      let pos = ideal;
      let hit = stripAt(pos);
      for (const shift of [26, -26, 52, -52, 78, -78]) {
        if (hit) break;
        pos = ideal + shift;
        hit = stripAt(pos);
      }
      if (!hit) continue;
      const { a, b } = hit;
      const center = horizontal ? { x: pos, y: (a + b) / 2 } : { x: (a + b) / 2, y: pos };
      if (hidden(center)) continue;
      strips.push({
        ...center,
        length: b - a + 14,
        orientation: horizontal ? 'v' : 'h',
        seed: Math.abs(Math.round(center.x * 31 + center.y * 17)) % 9973,
      });
    }
  }
  return strips;
}
