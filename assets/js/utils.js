/** Utilitários de formatação e cálculo orçamentário. */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const intFmt = new Intl.NumberFormat('pt-BR');

export function $(id) {
  return document.getElementById(id);
}

export function pct(balance, updated) {
  return updated !== 0 ? (balance / updated) * 100 : null;
}

export function clamp(v) {
  return Math.max(0, Math.min(100, v || 0));
}

export function money(v) {
  return brl.format(Number(v || 0));
}

export function pctText(v) {
  return v === null || !Number.isFinite(v) ? '—' : `${num.format(v)}%`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[c]));
}

export function cents(v) {
  return Math.round((Number(v) || 0) * 100);
}

export function sum(list, key) {
  return list.reduce((a, x) => a + (Number(x[key]) || 0), 0);
}

export function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function variation(initial, updated) {
  const i = Number(initial) || 0;
  const u = Number(updated) || 0;
  if (Math.abs(u - i) < 0.005) return 0;
  if (i === 0) return null;
  return ((u - i) / i) * 100;
}

/** Participação de um valor na soma total (ex.: item ÷ total da ação). */
export function sharePct(part, total) {
  const t = Number(total) || 0;
  if (t === 0) return null;
  return ((Number(part) || 0) / t) * 100;
}

/**
 * Badge de participação no total (sem seta de alta/baixa).
 */
export function shareBadge(value, opts = {}) {
  const title = opts.title ? ` title="${esc(opts.title)}"` : '';
  if (value === null || !Number.isFinite(value)) {
    return `<span class="delta-badge delta-na"${title}>N/A</span>`;
  }
  return `<span class="delta-badge delta-share"${title}>${num.format(value)}%</span>`;
}

/**
 * Badge com seta ↑/↓ e percentual de variação (atualizada vs inicial).
 */
export function deltaBadge(value, opts = {}) {
  const title = opts.title ? ` title="${esc(opts.title)}"` : '';
  if (value === null || !Number.isFinite(value)) {
    return `<span class="delta-badge delta-na"${title}>N/A</span>`;
  }
  if (Math.abs(value) < 0.005) {
    return `<span class="delta-badge delta-flat"${title}><span class="delta-arrow">→</span> 0,00%</span>`;
  }
  if (value > 0) {
    return `<span class="delta-badge delta-up"${title}><span class="delta-arrow">↑</span> +${num.format(value)}%</span>`;
  }
  return `<span class="delta-badge delta-down"${title}><span class="delta-arrow">↓</span> ${num.format(value)}%</span>`;
}

export function moneyWithShare(amount, share, title) {
  return `<span class="money-delta"><span class="money-delta-val">${money(amount)}</span>${shareBadge(share, { title })}</span>`;
}

export function moneyWithDelta(amount, deltaPct, title) {
  return `<span class="money-delta"><span class="money-delta-val">${money(amount)}</span>${deltaBadge(deltaPct, { title })}</span>`;
}

export function availabilityClass(p, balance) {
  if (balance === 0) return 'zero';
  if (p === null) return 'zero';
  if (p < 25) return 'low';
  if (p < 75) return 'mid';
  return '';
}

export function itemCountForUnits(units) {
  return units.reduce((t, u) => t + u.actions.reduce((a, x) => a + x.items.length, 0), 0);
}

export function actionCountForUnits(units) {
  return units.reduce((t, u) => t + u.actions.length, 0);
}
