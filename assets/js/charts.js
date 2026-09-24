/** Gráficos SVG compactos — estética moderna, sem bibliotecas externas. */

import { esc, money, pctText } from './utils.js';

export const PALETTE = [
  '#0e5aa7', '#20865f', '#38a1d6', '#c98518', '#5b6abf',
  '#2a9d8f', '#e76f51', '#457b9d', '#6a4c93', '#118ab2',
  '#ef476f', '#06d6a0', '#ffd166', '#073b4c', '#8d99ae',
  '#3d5a80', '#ee6c4d', '#293241', '#98c1d9'
];

const BLUE = '#0e5aa7';
const GREEN = '#20865f';
const AMBER = '#c98518';
const MUTED = '#6a7a90';
const RED = '#b94d55';

function shortName(name, max = 22) {
  const s = String(name || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function codeLabel(row) {
  return row.code || shortName(row.label, 10);
}

/** Agrega Top N + “Demais” para evitar gráficos intermináveis. */
export function topN(rows, n, valueFn) {
  const sorted = [...rows].sort((a, b) => valueFn(b) - valueFn(a));
  if (sorted.length <= n) return sorted;
  const head = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const outros = {
    code: '',
    label: `Demais (${rest.length})`,
    name: `Demais (${rest.length})`,
    initial: rest.reduce((a, r) => a + (r.initial || 0), 0),
    updated: rest.reduce((a, r) => a + (r.updated || 0), 0),
    balance: rest.reduce((a, r) => a + (r.balance || 0), 0),
    value: rest.reduce((a, r) => a + valueFn(r), 0),
    isOther: true
  };
  return [...head, outros];
}

/** Barra empilhada 100% — visão de composição moderna. */
export function stackedShare(rows, opts = {}) {
  const { height = 56, formatShare = true } = opts;
  const total = rows.reduce((a, r) => a + Math.max(0, r.value), 0) || 1;
  const width = 100;

  let x = 0;
  const segs = rows
    .map((r, i) => {
      const w = (Math.max(0, r.value) / total) * width;
      const seg = `<rect class="chart-bar" data-code="${esc(r.code || '')}" x="${x}" y="0" width="${Math.max(0.15, w)}" height="18" fill="${PALETTE[i % PALETTE.length]}" rx="0">
        <title>${esc(r.label)}: ${esc(r.meta || '')}</title>
      </rect>`;
      x += w;
      return seg;
    })
    .join('');

  const legend = rows
    .slice(0, 8)
    .map((r, i) => {
      const share = (Math.max(0, r.value) / total) * 100;
      return `<li><i class="chart-swatch" style="background:${PALETTE[i % PALETTE.length]}"></i>
        <span class="leg-code">${esc(codeLabel(r))}</span>
        <span class="leg-val">${formatShare ? esc(pctText(share)) : esc(r.meta || '')}</span>
      </li>`;
    })
    .join('');

  const more = rows.length > 8 ? `<li class="leg-more">+${rows.length - 8} itens</li>` : '';

  return `<div class="stacked-wrap">
    <svg viewBox="0 0 ${width} 18" preserveAspectRatio="none" class="stacked-svg" height="${height}" role="img">${segs}</svg>
    <ul class="stacked-legend">${legend}${more}</ul>
  </div>`;
}

/** Barras verticais compactas (Top N). */
export function verticalBars(rows, opts = {}) {
  const { width = 640, height = 220, padL = 36, padR = 12, padT = 18, padB = 56, format = (v) => money(v) } = opts;
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const gap = 6;
  const bw = Math.max(10, (plotW - gap * (rows.length + 1)) / rows.length);

  const grid = [0.25, 0.5, 0.75, 1]
    .map((t) => {
      const y = padT + plotH * (1 - t);
      return `<line class="chart-grid" x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}"></line>`;
    })
    .join('');

  const bars = rows
    .map((r, i) => {
      const h = Math.max(2, (r.value / max) * plotH);
      const x = padL + gap + i * (bw + gap);
      const y = padT + plotH - h;
      const color = r.isOther ? '#94a3b8' : PALETTE[i % PALETTE.length];
      const clickable = r.isOther ? '' : `class="chart-bar" data-code="${esc(r.code || '')}" role="button" tabindex="0"`;
      return `<g ${clickable || 'class="chart-bar-static"'}>
        <rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="5" fill="${color}">
          <title>${esc(r.label)} — ${esc(r.meta || format(r.value))}</title>
        </rect>
        <text class="chart-tick" x="${x + bw / 2}" y="${height - 34}" text-anchor="middle">${esc(codeLabel(r))}</text>
        <text class="chart-mini" x="${x + bw / 2}" y="${y - 5}" text-anchor="middle">${esc(r.meta || format(r.value))}</text>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">${grid}${bars}</svg>`;
}

/** Ranking em “lollipop” compacto (% disponível). */
export function lollipopRank(rows, opts = {}) {
  const { width = 640, rowH = 22, padL = 118, padR = 52, padT = 6 } = opts;
  const height = padT + rows.length * rowH + 6;
  const barW = width - padL - padR;

  const bars = rows
    .map((r, i) => {
      const y = padT + i * rowH + 10;
      const p = r.value;
      const w = p === null ? 0 : Math.min(100, Math.max(0, p)) / 100 * barW;
      const color = rankColor(p);
      const clickable = r.isOther ? '' : `class="chart-bar" data-code="${esc(r.code || '')}" role="button" tabindex="0"`;
      return `<g ${clickable || ''}>
        <text class="chart-label" x="${padL - 8}" y="${y + 3}" text-anchor="end">${esc(codeLabel(r))}</text>
        <line class="chart-axis" x1="${padL}" y1="${y}" x2="${padL + barW}" y2="${y}"></line>
        <line x1="${padL}" y1="${y}" x2="${padL + w}" y2="${y}" stroke="${color}" stroke-width="2.5"></line>
        <circle cx="${padL + w}" cy="${y}" r="4.5" fill="${color}"></circle>
        <text class="chart-value" x="${padL + barW + 6}" y="${y + 3}">${p === null ? '—' : esc(pctText(p))}</text>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">${bars}</svg>`;
}

/** Comparativo compacto: faixa empilhada disponível/não disponível por item. */
export function availabilityStrips(rows, opts = {}) {
  const { width = 640, rowH = 26, padL = 118, padR = 8, padT = 8 } = opts;
  const height = padT + rows.length * rowH + 8;
  const barW = width - padL - padR;

  const header = `<text class="chart-mini" x="${padL}" y="${padT + 2}" fill="${MUTED}">0%</text>
    <text class="chart-mini" x="${padL + barW}" y="${padT + 2}" text-anchor="end" fill="${MUTED}">100%</text>`;

  const bars = rows
    .map((r, i) => {
      const y = padT + 10 + i * rowH;
      const p = r.updated > 0 ? (r.balance / r.updated) * 100 : 0;
      const wAvail = Math.max(0, Math.min(100, p)) / 100 * barW;
      const clickable = r.isOther ? '' : `class="chart-bar" data-code="${esc(r.code || '')}" role="button" tabindex="0"`;
      return `<g ${clickable || ''}>
        <text class="chart-label" x="${padL - 8}" y="${y + 10}" text-anchor="end">${esc(codeLabel(r))}</text>
        <rect x="${padL}" y="${y}" width="${barW}" height="12" rx="6" fill="#e8eef5"></rect>
        <rect x="${padL}" y="${y}" width="${Math.max(0, wAvail)}" height="12" rx="6" fill="${GREEN}"></rect>
        <title>${esc(r.label)} — ${esc(pctText(p))} disponível</title>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">${header}${bars}</svg>
    <div class="chart-legend">
      <span><i class="chart-swatch" style="background:${GREEN}"></i>Disponível</span>
      <span><i class="chart-swatch" style="background:#e8eef5"></i>Não disponível</span>
    </div>`;
}

/** Donut menor e mais limpo. */
export function donutChart(available, unavailable, opts = {}) {
  const { size = 168, thickness = 22 } = opts;
  const total = available + unavailable;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2 - 2;
  const c = 2 * Math.PI * r;
  const availPct = total > 0 ? available / total : 0;
  const availLen = c * availPct;
  const unavailLen = c - availLen;

  return `<div class="donut-block">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8eef5" stroke-width="${thickness}"></circle>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GREEN}" stroke-width="${thickness}"
        stroke-dasharray="${availLen} ${c}" transform="rotate(-90 ${cx} ${cy})"></circle>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${BLUE}" stroke-width="${thickness}"
        stroke-dasharray="${unavailLen} ${c}" stroke-dashoffset="${-availLen}" transform="rotate(-90 ${cx} ${cy})"></circle>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="20" font-weight="800" fill="#10233f">${esc(
        total === 0 ? '—' : pctText(availPct * 100)
      )}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10" fill="${MUTED}">disponível</text>
    </svg>
    <div class="donut-stats">
      <div><span class="dot" style="background:${GREEN}"></span><div><small>Disponível</small><strong>${esc(money(available))}</strong></div></div>
      <div><span class="dot" style="background:${BLUE}"></span><div><small>Não disponível</small><strong>${esc(money(unavailable))}</strong></div></div>
    </div>
  </div>`;
}

/** Variação compacta — valores em coluna fixa à direita para não sobrepor as barras. */
export function variationCompact(rows, opts = {}) {
  const usable = rows.filter((r) => r.value !== null && Number.isFinite(r.value));
  if (usable.length < 2) return '';

  const { width = 720, rowH = 26, padL = 168, padR = 78, padT = 8 } = opts;
  const vals = usable.map((r) => r.value);
  const maxAbs = Math.max(...vals.map((v) => Math.abs(v)), 1);
  const plotW = width - padL - padR;
  const mid = padL + plotW / 2;
  const half = plotW / 2;
  const height = padT + usable.length * rowH + 8;
  const valueX = width - 8;

  const axis = `<line class="chart-axis" x1="${mid}" y1="${padT}" x2="${mid}" y2="${height - 2}"></line>`;
  const bars = usable
    .map((r, i) => {
      const y = padT + i * rowH + 12;
      // leave a small gap so the bar never reaches the value column
      const w = Math.min(half * 0.92, (Math.abs(r.value) / maxAbs) * half * 0.92);
      const x = r.value >= 0 ? mid : mid - w;
      const fill = r.value >= 0 ? GREEN : RED;
      const label = shortName(r.label || r.code, 22);
      return `<g class="chart-bar" data-code="${esc(r.code || '')}" role="button" tabindex="0">
        <text class="chart-label" x="${padL - 10}" y="${y + 3}" text-anchor="end">${esc(label)}</text>
        <rect x="${x}" y="${y - 5}" width="${Math.max(2, w)}" height="10" rx="4" fill="${fill}">
          <title>${esc(r.label || r.code)}: ${r.value >= 0 ? '+' : ''}${esc(pctText(r.value))}</title>
        </rect>
        <text class="chart-value" x="${valueX}" y="${y + 3}" text-anchor="end">${r.value >= 0 ? '+' : ''}${esc(pctText(r.value))}</text>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">${axis}${bars}</svg>`;
}

export function rankColor(p) {
  if (p === null) return MUTED;
  if (p >= 75) return GREEN;
  if (p >= 25) return AMBER;
  return RED;
}

export { BLUE, GREEN, AMBER, MUTED, RED };
