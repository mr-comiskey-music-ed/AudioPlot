import { jsPDF } from 'jspdf';
import { StudioProjectState, RubricEvaluation, PlacedGear, GearDefinition } from '../types';
import { getGearById } from '../data/gearCatalog';
import { getGearBoxDimensions } from '../components/canvas/canvasMath';
import { calculateXlrCablesCount } from '../utils/cableUtils';
import { resolveTaskId, taskTitle } from '../data/challenges';

/**
 * PDF export: a printable stage plot drawn straight from the student's project
 * data (not a screenshot), plus an input list, equipment list and grade summary.
 * Laid out like a real stage plot / tech rider. Works the same for a student's
 * own plot and for a plot the teacher loads from a code.
 */

export interface PdfExportOptions {
  filename?: string;
  includeGradingRubric?: boolean;
  includePatchList?: boolean;
  includeEquipmentManifest?: boolean;
  onProgress?: (status: string) => void;
  download?: boolean;
}

type RGB = [number, number, number];
const C = {
  ink: [17, 24, 39] as RGB,
  text: [31, 41, 55] as RGB,
  muted: [107, 114, 128] as RGB,
  faint: [156, 163, 175] as RGB,
  line: [209, 213, 219] as RGB,
  panel: [243, 244, 246] as RGB,
  white: [255, 255, 255] as RGB,
  accent: [234, 88, 12] as RGB,
  good: [5, 150, 105] as RGB,
  warn: [217, 119, 6] as RGB,
  bad: [225, 29, 72] as RGB,
  mic: [30, 41, 59] as RGB,
  di: [15, 118, 110] as RGB,
  unpatched: [156, 163, 175] as RGB,
};
const CABLE: Record<string, { color: RGB; label: string }> = {
  xlr: { color: [234, 88, 12], label: 'XLR (mic) cable' },
  quarter_inch: { color: [2, 132, 199], label: '1/4" instrument cable' },
  speaker: { color: [22, 163, 74], label: 'Speaker cable' },
};
const STAND_LABELS: Record<string, string> = {
  amp_low: 'Floor / short stand',
  seated_instrument: 'Seated boom',
  standing_vocal: 'Standing boom',
  drum_overhead: 'Overhead boom',
  clipped: 'Clip-on (no stand)',
  mounted: 'Mounted (no stand)',
};
const NO_STAND = new Set(['clipped', 'mounted']);

const hexToRgb = (hex?: string): RGB => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [100, 116, 139];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (c: RGB, withWhite: number): RGB => c.map((v) => Math.round(v + (255 - v) * withWhite)) as RGB;
const darken = (c: RGB, by: number): RGB => c.map((v) => Math.round(v * (1 - by))) as RGB;
const humanize = (id?: string) => (id ? id.replace(/_/g, ' ').replace(/^\w/, (ch) => ch.toUpperCase()) : '');
const isMarker = (def?: GearDefinition) => def?.category === 'microphone' || def?.category === 'di_box';

// ---------- Project helpers ----------
function gearName(item: PlacedGear | undefined) {
  if (!item) return '';
  const def = getGearById(item.gearId);
  return item.label?.trim() || def?.name || item.gearId;
}

/** Input channel for a mic/DI: from the snake cable, the mixer, or the gear itself. */
function channelOf(project: StudioProjectState, item: PlacedGear): number | null {
  const viaSnake = (project.connections || []).find(
    (c) =>
      (c.fromInstanceId === item.instanceId && c.toInstanceId.startsWith('snake_in_')) ||
      (c.toInstanceId === item.instanceId && c.fromInstanceId.startsWith('snake_in_'))
  );
  if (viaSnake) {
    const id = viaSnake.toInstanceId.startsWith('snake_in_') ? viaSnake.toInstanceId : viaSnake.fromInstanceId;
    const n = parseInt(id.replace('snake_in_', ''), 10);
    if (!Number.isNaN(n)) return n;
  }
  const ch = (project.mixerChannels || []).find((c) => c.assignedGearInstanceId === item.instanceId);
  if (ch) return ch.channelNumber;
  return item.assignedChannel ?? null;
}

/** What a mic or DI is picking up: its latched source, or an instrument cabled into it. */
function sourceOf(project: StudioProjectState, item: PlacedGear): PlacedGear | undefined {
  const gear = project.placedGear || [];
  if (item.latchedSourceInstanceId) return gear.find((g) => g.instanceId === item.latchedSourceInstanceId);
  const conn = (project.connections || []).find(
    (c) =>
      (c.toInstanceId === item.instanceId || c.fromInstanceId === item.instanceId) && c.cableType === 'quarter_inch'
  );
  const otherId = conn ? (conn.toInstanceId === item.instanceId ? conn.fromInstanceId : conn.toInstanceId) : null;
  return otherId ? gear.find((g) => g.instanceId === otherId) : undefined;
}

function boxDims(project: StudioProjectState, item: PlacedGear) {
  const src = item.latchedSourceInstanceId
    ? (project.placedGear || []).find((g) => g.instanceId === item.latchedSourceInstanceId)
    : undefined;
  const onDrum = !!src && (src.gearId.includes('drum') || src.gearId === 'inst_hi_hat');
  return getGearBoxDimensions(item.gearId, !!item.latchedSourceInstanceId, item.customScale, item.customWidth, item.customHeight, onDrum);
}

// ---------- Main ----------
export async function generateStudioPlotPdf(
  project: StudioProjectState,
  evaluation: RubricEvaluation,
  options: PdfExportOptions = {}
): Promise<{ doc: jsPDF; blob: Blob; filename: string }> {
  const { filename, includeGradingRubric = true, includePatchList = true, includeEquipmentManifest = true, onProgress } = options;
  onProgress?.('Drawing stage plot...');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const isStudio = project.environment !== 'live_stage';
  const student = project.studentName?.trim() || 'Student';
  const title = project.title?.trim() || (isStudio ? 'Studio Recording Session Plot' : 'Live Stage Plot');
  const challenge = taskTitle(resolveTaskId(project.activeChallengeId, project.environment));
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const setText = (size: number, color: RGB = C.text, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  // ======================= PAGE 1: STAGE PLOT (landscape) =======================
  let W = doc.internal.pageSize.getWidth();
  let H = doc.internal.pageSize.getHeight();
  const M = 12;

  // Header
  setText(16, C.ink, 'bold');
  doc.text(title, M, M + 4);
  setText(9, C.muted);
  const sub = [
    student,
    project.period ? `Period ${project.period}` : '',
    isStudio ? 'Recording Studio' : 'Live Stage',
    challenge || '',
    dateStr,
  ]
    .filter(Boolean)
    .join('   •   ');
  doc.text(sub, M, M + 10);
  const scoreColor = evaluation.isSandbox ? C.line : evaluation.percentage >= 90 ? C.good : evaluation.percentage >= 70 ? C.warn : C.bad;
  doc.setFillColor(...scoreColor);
  doc.roundedRect(W - M - 34, M - 2, 34, 13, 2, 2, 'F');
  setText(evaluation.isSandbox ? 9 : 12, evaluation.isSandbox ? C.text : C.white, 'bold');
  doc.text(
    evaluation.isSandbox ? 'NOT GRADED' : `${evaluation.percentage}%  ${evaluation.gradeLetter}`,
    W - M - 17,
    M + 6.3,
    { align: 'center' }
  );

  // Frame
  const fx = M, fy = M + 15, fw = W - 2 * M, fh = H - fy - 26;
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.4);
  doc.setFillColor(252, 252, 253);
  doc.roundedRect(fx, fy, fw, fh, 2, 2, 'FD');

  // Snake (top center) with input sockets 1..8 and, on stage, outputs
  const inputs = Math.max(8, (project.mixerChannels || []).length);
  const outputs = isStudio ? [] : [
    { id: 'snake_out_mon1', label: 'MON 1' },
    { id: 'snake_out_mon2', label: 'MON 2' },
    { id: 'snake_out_main_l', label: 'MAIN L' },
    { id: 'snake_out_main_r', label: 'MAIN R' },
  ];
  const sockW = 8.5, outW = 12;
  const snakeW = 8 + inputs * sockW + (outputs.length ? 4 + outputs.length * outW : 0);
  const snakeX = fx + (fw - snakeW) / 2, snakeY = fy + 4, snakeH = 15;
  doc.setFillColor(...C.panel);
  doc.setDrawColor(...C.faint);
  doc.setLineWidth(0.3);
  doc.roundedRect(snakeX, snakeY, snakeW, snakeH, 1.5, 1.5, 'FD');
  setText(6, C.muted, 'bold');
  doc.text(isStudio ? 'STUDIO SNAKE (INPUTS)' : 'STAGE SNAKE', snakeX + snakeW / 2, snakeY + 3.4, { align: 'center' });
  const socketPos = new Map<string, { x: number; y: number }>();
  for (let n = 1; n <= inputs; n++) {
    const cx = snakeX + 4 + sockW * (n - 0.5), cy = snakeY + 9.5;
    socketPos.set(`snake_in_${n}`, { x: cx, y: cy + 3 });
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.faint);
    doc.circle(cx, cy, 3, 'FD');
    setText(7, C.ink, 'bold');
    doc.text(String(n), cx, cy + 1.2, { align: 'center' });
  }
  outputs.forEach((o, i) => {
    const ox = snakeX + 8 + inputs * sockW + i * outW, oy = snakeY + 6.5;
    socketPos.set(o.id, { x: ox + (outW - 2) / 2, y: oy + 6 });
    doc.setFillColor(...C.white);
    doc.roundedRect(ox, oy, outW - 2, 6, 1, 1, 'FD');
    setText(5, C.ink, 'bold');
    doc.text(o.label, ox + (outW - 2) / 2, oy + 3.9, { align: 'center' });
  });

  // Room orientation labels
  setText(7, C.muted, 'bold');
  if (isStudio) {
    doc.setFillColor(224, 242, 254);
    doc.rect(fx + fw / 2 - 45, fy + fh - 6, 90, 4.5, 'F');
    setText(6.5, [3, 105, 161], 'bold');
    doc.text('CONTROL ROOM WINDOW', fx + fw / 2, fy + fh - 2.7, { align: 'center' });
  } else {
    doc.text('UPSTAGE (BACK OF STAGE)', fx + 4, fy + 5);
    doc.setFillColor(238, 242, 255);
    doc.rect(fx + fw / 2 - 50, fy + fh - 6, 100, 4.5, 'F');
    setText(6.5, [67, 56, 202], 'bold');
    doc.text('AUDIENCE / FRONT OF HOUSE', fx + fw / 2, fy + fh - 2.7, { align: 'center' });
  }

  // Fit the student's layout into the drawing area, keeping its proportions
  const gear = project.placedGear || [];
  const area = { x: fx + 6, y: snakeY + snakeH + 6, w: fw - 12, h: fy + fh - 9 - (snakeY + snakeH + 6) };
  const boxes = gear.map((g) => ({ g, def: getGearById(g.gearId), ...boxDims(project, g) }));
  const pos = new Map<string, { cx: number; cy: number; w: number; h: number }>();
  if (boxes.length) {
    const minX = Math.min(...boxes.map((b) => b.g.x)), minY = Math.min(...boxes.map((b) => b.g.y));
    const maxX = Math.max(...boxes.map((b) => b.g.x + b.width)), maxY = Math.max(...boxes.map((b) => b.g.y + b.height));
    const scale = Math.min(area.w / Math.max(1, maxX - minX), area.h / Math.max(1, maxY - minY), 0.4);
    const offX = area.x + (area.w - (maxX - minX) * scale) / 2, offY = area.y + (area.h - (maxY - minY) * scale) / 2;
    for (const b of boxes) {
      pos.set(b.g.instanceId, {
        cx: offX + (b.g.x - minX + b.width / 2) * scale,
        cy: offY + (b.g.y - minY + b.height / 2) * scale,
        w: b.width * scale,
        h: b.height * scale,
      });
    }
  } else {
    setText(11, C.faint, 'italic');
    doc.text('No equipment has been placed yet.', fx + fw / 2, area.y + area.h / 2, { align: 'center' });
  }

  // Mic/DI markers: nudge apart any that overlap so every number stays readable
  const R = 3.3;
  const markers = boxes
    .filter((b) => isMarker(b.def))
    .map((b) => ({ id: b.g.instanceId, sourceId: sourceOf(project, b.g)?.instanceId, p: { ...pos.get(b.g.instanceId)! } }));
  const solid = boxes.filter((b) => !isMarker(b.def)).map((b) => ({ id: b.g.instanceId, ...pos.get(b.g.instanceId)! }));
  for (let iter = 0; iter < 40; iter++) {
    let moved = false;
    // Keep markers off other equipment's labels (sitting on their own source is fine)
    for (const m of markers) {
      for (const b of solid) {
        if (b.id === m.sourceId) continue;
        const left = b.cx - b.w / 2 - R - 0.5, right = b.cx + b.w / 2 + R + 0.5;
        const top = b.cy - b.h / 2 - R - 0.5, bot = b.cy + b.h / 2 + R + 0.5;
        if (m.p.cx > left && m.p.cx < right && m.p.cy > top && m.p.cy < bot) {
          const exits = [
            { d: m.p.cx - left, x: left, y: m.p.cy },
            { d: right - m.p.cx, x: right, y: m.p.cy },
            { d: m.p.cy - top, x: m.p.cx, y: top },
            { d: bot - m.p.cy, x: m.p.cx, y: bot },
          ].sort((a, b2) => a.d - b2.d)[0];
          m.p.cx = exits.x;
          m.p.cy = exits.y;
          moved = true;
        }
      }
    }
    for (let i = 0; i < markers.length; i++)
      for (let j = i + 1; j < markers.length; j++) {
        const a = markers[i].p, b = markers[j].p;
        let dx = b.cx - a.cx, dy = b.cy - a.cy;
        const d = Math.hypot(dx, dy), min = R * 2 + 0.8;
        if (d < min) {
          if (d < 0.01) { dx = 1; dy = 0; }
          const push = (min - Math.max(d, 0.01)) / 2, ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
          a.cx -= ux * push; a.cy -= uy * push; b.cx += ux * push; b.cy += uy * push;
          moved = true;
        }
      }
    if (!moved) break;
  }
  for (const m of markers) {
    m.p.cx = Math.min(area.x + area.w - R, Math.max(area.x + R, m.p.cx));
    m.p.cy = Math.min(area.y + area.h - R, Math.max(area.y + R, m.p.cy));
    pos.set(m.id, m.p);
  }
  const pointOf = (id: string) => {
    const p = pos.get(id);
    if (p) return { x: p.cx, y: p.cy };
    return socketPos.get(id) ?? null;
  };

  // Cables first, so equipment sits on top of them
  for (const c of project.connections || []) {
    const a = pointOf(c.fromInstanceId), b = pointOf(c.toInstanceId);
    if (!a || !b) continue;
    const style = CABLE[c.cableType] ?? CABLE.xlr;
    doc.setDrawColor(...mix(style.color, 0.25));
    doc.setLineWidth(0.45);
    doc.line(a.x, a.y, b.x, b.y);
  }

  // Instruments, amps, monitors, speakers: labeled boxes
  for (const b of boxes) {
    if (isMarker(b.def)) continue;
    const p = pos.get(b.g.instanceId)!;
    const base = hexToRgb(b.def?.color);
    const x = p.cx - p.w / 2, y = p.cy - p.h / 2;
    doc.setFillColor(...mix(base, 0.85));
    doc.setDrawColor(...darken(base, 0.15));
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, p.w, p.h, 1.5, 1.5, 'FD');
    const name = gearName(b.g);
    const generic = b.def?.name && name !== b.def.name ? b.def.name : '';
    // Largest font that fits in two lines
    let size = 8.5;
    let lines: string[] = [];
    for (; size >= 5; size -= 0.5) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      lines = doc.splitTextToSize(name, p.w - 2);
      const wordsFit = name.split(/\s+/).every((w) => doc.getTextWidth(w) <= p.w - 2);
      if (wordsFit && lines.length <= 2 && lines.length * size * 0.42 + (generic ? 3 : 0) < p.h - 1) break;
    }
    lines = lines.slice(0, 2);
    const blockH = lines.length * size * 0.38 + (generic ? 3 : 0);
    let ty = p.cy - blockH / 2 + size * 0.3;
    setText(size, C.ink, 'bold');
    for (const l of lines) {
      doc.text(l, p.cx, ty, { align: 'center' });
      ty += size * 0.38;
    }
    if (generic) {
      setText(5, C.muted);
      doc.text(doc.splitTextToSize(generic, p.w - 2)[0], p.cx, ty + 0.8, { align: 'center' });
    }
  }

  // Mic & DI markers on top, numbered with their input channel
  for (const b of boxes) {
    if (!isMarker(b.def)) continue;
    const p = pos.get(b.g.instanceId)!;
    const ch = channelOf(project, b.g);
    const fill = ch == null ? C.unpatched : b.def?.category === 'di_box' ? C.di : C.mic;
    doc.setFillColor(...fill);
    doc.setDrawColor(...C.white);
    doc.setLineWidth(0.5);
    if (b.def?.category === 'di_box') doc.roundedRect(p.cx - R, p.cy - R, R * 2, R * 2, 0.8, 0.8, 'FD');
    else doc.circle(p.cx, p.cy, R, 'FD');
    setText(ch != null && ch >= 10 ? 6.5 : 8, C.white, 'bold');
    doc.text(ch == null ? '-' : String(ch), p.cx, p.cy + 1.1, { align: 'center' });
  }

  // Name & type tags beside each mic/DI, placed where they cover nothing else
  type Rect = { x: number; y: number; w: number; h: number };
  const overlap = (a: Rect, b: Rect) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const obstacles: Rect[] = [
    ...solid.map((b) => ({ x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h })),
    ...markers.map((m) => ({ x: m.p.cx - R, y: m.p.cy - R, w: R * 2, h: R * 2 })),
    { x: snakeX, y: snakeY, w: snakeW, h: snakeH },
  ];
  const placedTags: Rect[] = [];
  for (const b of boxes) {
    if (!isMarker(b.def)) continue;
    const p = pos.get(b.g.instanceId)!;
    const chNum = channelOf(project, b.g);
    const name = `${chNum != null ? `${chNum} · ` : ''}${b.def?.name || b.g.gearId}`;
    const kind =
      b.def?.category === 'di_box' ? 'Direct input'
      : b.def?.transducerType === 'condenser_large' ? 'Large-diaphragm condenser'
      : b.def?.transducerType === 'condenser_small' ? 'Small-diaphragm condenser'
      : b.def?.transducerType === 'dynamic' ? 'Dynamic'
      : '';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    const w1 = doc.getTextWidth(name);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    const w2 = kind ? doc.getTextWidth(kind) : 0;
    const tw = Math.max(w1, w2) + 2, th = kind ? 5.6 : 3.4;
    const gap = R + 0.6;
    const candidates: Rect[] = [
      { x: p.cx + gap, y: p.cy - th / 2, w: tw, h: th }, // right
      { x: p.cx - gap - tw, y: p.cy - th / 2, w: tw, h: th }, // left
      { x: p.cx - tw / 2, y: p.cy + gap, w: tw, h: th }, // below
      { x: p.cx - tw / 2, y: p.cy - gap - th, w: tw, h: th }, // above
      { x: p.cx + gap * 0.7, y: p.cy + gap * 0.7, w: tw, h: th }, // below right
      { x: p.cx - gap * 0.7 - tw, y: p.cy + gap * 0.7, w: tw, h: th }, // below left
      { x: p.cx + gap * 0.7, y: p.cy - gap * 0.7 - th, w: tw, h: th }, // above right
      { x: p.cx - gap * 0.7 - tw, y: p.cy - gap * 0.7 - th, w: tw, h: th }, // above left
    ];
    const inArea = (r: Rect) => r.x >= fx + 1 && r.x + r.w <= fx + fw - 1 && r.y >= fy + 1 && r.y + r.h <= fy + fh - 7;
    const cost = (r: Rect) =>
      (inArea(r) ? 0 : 1e6) +
      obstacles.reduce((s, o) => s + overlap(r, o), 0) * 3 + // equipment and markers
      placedTags.reduce((s, o) => s + overlap(r, o), 0) * 10; // other tags matter most
    const tag = candidates.reduce((best, c) => (cost(c) < cost(best) ? c : best), candidates[0]);
    placedTags.push(tag);
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.roundedRect(tag.x, tag.y, tag.w, tag.h, 0.8, 0.8, 'FD');
    setText(6, C.ink, 'bold');
    doc.text(name, tag.x + 1, tag.y + 2.5);
    if (kind) {
      setText(5, C.muted);
      doc.text(kind, tag.x + 1, tag.y + 4.8);
    }
  }

  // Legend
  let lx = M, ly = fy + fh + 6;
  setText(7, C.muted, 'bold');
  doc.text('KEY', lx, ly + 1);
  lx += 9;
  const legendItem = (draw: () => void, label: string, width: number) => {
    draw();
    setText(7, C.text);
    doc.text(label, lx + 6, ly + 1);
    lx += width;
  };
  legendItem(() => { doc.setFillColor(...C.mic); doc.circle(lx + 2, ly, 2, 'F'); setText(5.5, C.white, 'bold'); doc.text('3', lx + 2, ly + 0.7, { align: 'center' }); }, 'Microphone (number = input channel)', 52);
  legendItem(() => { doc.setFillColor(...C.di); doc.roundedRect(lx, ly - 2, 4, 4, 0.5, 0.5, 'F'); }, 'DI box', 20);
  legendItem(() => { doc.setFillColor(...C.unpatched); doc.circle(lx + 2, ly, 2, 'F'); }, 'Not patched', 25);
  legendItem(() => { doc.setFillColor(235, 235, 240); doc.setDrawColor(...C.faint); doc.roundedRect(lx, ly - 2, 5, 4, 0.6, 0.6, 'FD'); }, 'Instrument / amp / monitor', 42);
  for (const [, s] of Object.entries(CABLE)) {
    legendItem(() => { doc.setDrawColor(...mix(s.color, 0.25)); doc.setLineWidth(0.8); doc.line(lx, ly, lx + 5, ly); }, s.label, s.label.length * 1.35 + 10);
  }

  // ======================= PAGE 2+: INPUT LIST, EQUIPMENT, GRADE (portrait) =======================
  onProgress?.('Writing input & equipment lists...');
  doc.addPage('letter', 'portrait');
  W = doc.internal.pageSize.getWidth();
  H = doc.internal.pageSize.getHeight();
  let y = M + 4;
  const bottom = H - 16;
  const ensure = (needed: number) => {
    if (y + needed > bottom) {
      doc.addPage('letter', 'portrait');
      y = M + 4;
    }
  };
  const heading = (label: string) => {
    ensure(14);
    setText(12, C.ink, 'bold');
    doc.text(label, M, y);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.6);
    doc.line(M, y + 1.8, M + doc.getTextWidth(label), y + 1.8);
    y += 7;
  };

  setText(9, C.muted);
  doc.text(`${title}   •   ${student}`, M, y);
  y += 8;

  // ---- Input list ----
  if (includePatchList) {
    heading('Input List');
    const cols = [
      { label: 'CH', w: 10 },
      { label: 'SOURCE', w: 42 },
      { label: 'MIC / DI', w: 48 },
      { label: 'STAND', w: 30 },
      { label: '+48V', w: 22 },
      { label: 'NOTES', w: W - 2 * M - 152 },
    ];
    const drawRow = (cells: string[], opts: { header?: boolean; muted?: boolean; colors?: (RGB | null)[] } = {}) => {
      doc.setFont('helvetica', opts.header ? 'bold' : 'normal');
      doc.setFontSize(opts.header ? 7 : 8);
      const wrapped = cells.map((c, i) => doc.splitTextToSize(c || '', cols[i].w - 2) as string[]);
      const rowH = Math.max(6, Math.max(...wrapped.map((w) => w.length)) * 3.4 + 2.6);
      ensure(rowH);
      if (opts.header) {
        doc.setFillColor(...C.panel);
        doc.rect(M, y - 4, W - 2 * M, rowH, 'F');
      }
      let x = M + 1;
      wrapped.forEach((lines, i) => {
        const color = opts.colors?.[i] ?? (opts.header ? C.muted : opts.muted ? C.faint : C.text);
        doc.setTextColor(...color);
        doc.setFont('helvetica', opts.header || i === 0 ? 'bold' : 'normal');
        doc.text(lines, x, y);
        x += cols[i].w;
      });
      doc.setDrawColor(...C.line);
      doc.setLineWidth(0.2);
      doc.line(M, y - 4 + rowH, W - M, y - 4 + rowH);
      y += rowH;
    };
    drawRow(cols.map((c) => c.label), { header: true });

    const micAndDi = gear.filter((g) => isMarker(getGearById(g.gearId)));
    const patched = new Set<string>();
    for (let n = 1; n <= inputs; n++) {
      const item = micAndDi.find((g) => channelOf(project, g) === n);
      const ch = (project.mixerChannels || []).find((c) => c.channelNumber === n);
      if (!item) {
        drawRow([String(n), '—', '', '', ch?.phantomPower ? 'ON' : '', ''], { muted: true });
        continue;
      }
      patched.add(item.instanceId);
      const def = getGearById(item.gearId);
      const src = sourceOf(project, item);
      const needs48 = !!def?.requiresPhantomPower;
      const on48 = !!ch?.phantomPower;
      const p48 = on48 ? 'ON' : needs48 ? 'OFF (needs +48V)' : 'off';
      const stand = def?.category === 'di_box' ? '' : STAND_LABELS[item.standHeight || ''] || 'Not set';
      const notes = [
        item.micPlacement ? humanize(item.micPlacement) : '',
        item.hasPopFilter ? 'Pop filter' : '',
        item.hasShockmount ? 'Shockmount' : '',
        ch && ch.label && ch.label !== `CH ${n}` ? `Console label: ${ch.label}` : '',
      ].filter(Boolean).join('; ');
      drawRow(
        [String(n), src ? gearName(src) : 'No source chosen', `${def?.name || item.gearId}${def?.model ? ` — ${def.model}` : ''}`, stand, p48, notes],
        { colors: [null, src ? null : C.bad, null, stand === 'Not set' ? C.warn : null, !on48 && needs48 ? C.bad : on48 ? C.good : C.faint, null] }
      );
    }
    const unpatched = micAndDi.filter((g) => !patched.has(g.instanceId));
    for (const item of unpatched) {
      const def = getGearById(item.gearId);
      const src = sourceOf(project, item);
      drawRow(['—', src ? gearName(src) : 'No source chosen', def?.name || item.gearId, STAND_LABELS[item.standHeight || ''] || '', '', 'Not patched to an input'], {
        colors: [C.bad, null, null, null, null, C.bad],
      });
    }
    y += 6;
  }

  // ---- Equipment list ----
  if (includeEquipmentManifest) {
    heading('Equipment List');
    const counts = (items: PlacedGear[], key: (g: PlacedGear) => string) => {
      const m = new Map<string, number>();
      for (const g of items) m.set(key(g), (m.get(key(g)) || 0) + 1);
      return [...m.entries()].map(([name, qty]) => ({ name, qty }));
    };
    const byCat = (...cats: string[]) => gear.filter((g) => cats.includes(getGearById(g.gearId)?.category || ''));
    const nameKey = (g: PlacedGear) => {
      const d = getGearById(g.gearId);
      return d ? `${d.name}${d.model ? ` (${d.model})` : ''}` : g.gearId;
    };
    const mics = byCat('microphone');
    const standItems = mics.filter((g) => !NO_STAND.has(g.standHeight || ''));
    const placedStands = byCat('stand').length;
    const conns = project.connections || [];
    const sections: { title: string; rows: { name: string; qty: number }[] }[] = [
      { title: 'Instruments & Sources', rows: counts(byCat('instrument'), nameKey) },
      { title: 'Amplifiers', rows: counts(byCat('amplifier'), nameKey) },
      { title: 'Microphones', rows: counts(mics, nameKey) },
      { title: 'DI Boxes', rows: counts(byCat('di_box'), nameKey) },
      { title: 'Monitoring & PA', rows: counts(byCat('monitor_speaker'), nameKey) },
      {
        title: 'Stands',
        rows: [
          ...counts(standItems, (g) => (g.standHeight ? STAND_LABELS[g.standHeight] || humanize(g.standHeight) : 'Mic stand (height not set)')),
          ...(placedStands ? [{ name: 'Extra mic stands', qty: placedStands }] : []),
        ],
      },
      {
        title: 'Accessories',
        rows: [
          { name: 'Pop filters', qty: gear.filter((g) => g.hasPopFilter).length + byCat('accessory').length },
          { name: 'Shockmounts', qty: gear.filter((g) => g.hasShockmount).length },
        ].filter((r) => r.qty > 0),
      },
      {
        title: 'Cables',
        rows: [
          { name: 'XLR (mic) cables', qty: calculateXlrCablesCount(conns, project.mixerChannels || [], gear) },
          { name: '1/4" instrument cables', qty: conns.filter((c) => c.cableType === 'quarter_inch').length },
          { name: 'Speaker cables', qty: conns.filter((c) => c.cableType === 'speaker').length },
        ].filter((r) => r.qty > 0),
      },
    ].filter((s) => s.rows.length);

    if (!sections.length) {
      setText(9, C.faint, 'italic');
      doc.text('No equipment placed.', M, y);
      y += 8;
    }
    // Two columns of sections
    const colW = (W - 2 * M - 8) / 2;
    const sectionH = (s: { rows: unknown[] }) => 6 + s.rows.length * 4.6 + 3;
    const half = Math.ceil(sections.length / 2);
    const columns = [sections.slice(0, half), sections.slice(half)];
    const colHeights = columns.map((col) => col.reduce((h, s) => h + sectionH(s), 0));
    ensure(Math.min(Math.max(...colHeights), bottom - M));
    const startY = y;
    let maxY = y;
    columns.forEach((col, ci) => {
      let cy = startY;
      const cx = M + ci * (colW + 8);
      for (const s of col) {
        setText(8, C.accent, 'bold');
        doc.text(s.title.toUpperCase(), cx, cy);
        cy += 4.6;
        for (const r of s.rows) {
          setText(8.5, C.ink, 'bold');
          doc.text(`${r.qty}`, cx + 6, cy, { align: 'right' });
          doc.text('×', cx + 7.2, cy);
          setText(8.5, C.text);
          doc.text(doc.splitTextToSize(r.name, colW - 14)[0], cx + 11, cy);
          cy += 4.6;
        }
        cy += 3;
      }
      maxY = Math.max(maxY, cy);
    });
    y = maxY + 4;
  }

  // ---- Grade summary ----
  if (includeGradingRubric) {
    heading(evaluation.isSandbox ? 'Setup Checks (Sandbox, not graded)' : 'Grade Summary');
    ensure(10);
    setText(11, evaluation.isSandbox ? C.muted : scoreColor, 'bold');
    doc.text(
      evaluation.isSandbox
        ? 'Built in the open sandbox. Checks below show what is working; no grade is given.'
        : `${evaluation.totalScore} / ${evaluation.maxTotalScore} points   •   ${evaluation.percentage}%   •   ${evaluation.gradeLetter}`,
      M,
      y
    );
    y += 7;
    for (const cat of Object.values(evaluation.categories)) {
      if (!cat) continue;
      ensure(5.5);
      const na = cat.status === 'not_applicable';
      const full = !na && cat.score >= cat.maxScore;
      setText(8.5, na ? C.faint : C.text);
      doc.text(cat.name, M + 2, y);
      setText(8.5, na ? C.faint : full ? C.good : C.warn, 'bold');
      doc.text(na ? 'N/A' : `${cat.score} / ${cat.maxScore}`, W - M - 2, y, { align: 'right' });
      doc.setDrawColor(...C.panel);
      doc.setLineWidth(0.2);
      doc.line(M, y + 1.8, W - M, y + 1.8);
      y += 5.5;
    }
    const bullets = (label: string, items: string[], color: RGB) => {
      if (!items.length) return;
      y += 3;
      ensure(9);
      setText(9, color, 'bold');
      doc.text(label, M, y);
      y += 5;
      for (const item of items.slice(0, 10)) {
        setText(8.5, C.text);
        const lines = doc.splitTextToSize(item, W - 2 * M - 6) as string[];
        ensure(lines.length * 3.8 + 1);
        doc.text('•', M + 1, y);
        doc.text(lines, M + 5, y);
        y += lines.length * 3.8 + 1;
      }
    };
    bullets('Issues to fix', evaluation.criticalIssues || [], C.bad);
    bullets('Suggestions', evaluation.suggestions || [], C.warn);
    bullets('What went well', evaluation.positives || [], C.good);
  }

  // Footers on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    setText(7, C.faint);
    doc.text(`AudioPlot   •   ${student}   •   ${dateStr}`, M, ph - 7);
    doc.text(`Page ${i} of ${total}`, pw - M, ph - 7, { align: 'right' });
  }

  const finalFilename =
    filename ||
    `AudioPlot-${student.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'assignment'}-${isStudio ? 'studio' : 'stage'}-${new Date().toISOString().slice(0, 10)}.pdf`;
  if (options.download) {
    onProgress?.('Downloading PDF file...');
    doc.save(finalFilename);
  }
  const blob = doc.output('blob');
  return { doc, blob, filename: finalFilename };
}

export async function exportStudioPlotToPdf(
  project: StudioProjectState,
  evaluation: RubricEvaluation,
  options: PdfExportOptions = {}
): Promise<void> {
  await generateStudioPlotPdf(project, evaluation, { ...options, download: true });
}
