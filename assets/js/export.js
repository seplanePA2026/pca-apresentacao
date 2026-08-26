/** Exportação CSV e impressão. */

import { pct } from './utils.js';

function csvEscape(v) {
  const s = String(v ?? '');
  return `"${s.replaceAll('"', '""')}"`;
}

/**
 * @param {object[]} organs
 * @param {{ activeOrg: Function, activeUnits: Function, unitSelect: HTMLSelectElement }} ctx
 */
export function selectedRowsForCSV(organs, ctx) {
  const o = ctx.activeOrg();
  const rows = [];
  const orgs = o ? [o] : organs;
  for (const org of orgs) {
    const units = o ? ctx.activeUnits() : org.units;
    for (const u of units) {
      for (const a of u.actions) {
        for (const i of a.items) {
          rows.push({
            orgao: `${org.code} - ${org.name}`,
            local: `${u.code} - ${u.name}`,
            acao: `${a.code} - ${a.name}`,
            elemento: i.code,
            fonte: i.source,
            especificacao: i.name,
            inicial: i.initial,
            atualizada: i.updated,
            saldo: i.balance,
            percentual: pct(i.balance, i.updated)
          });
        }
      }
    }
  }
  return rows;
}

/**
 * @param {object[]} organs
 * @param {{ activeOrg: Function, activeUnits: Function, unitSelect: HTMLSelectElement }} ctx
 */
export function exportCSV(organs, ctx) {
  const rows = selectedRowsForCSV(organs, ctx);
  const header = [
    'Secretaria/Órgão',
    'Local/Unidade',
    'Ação',
    'Elemento',
    'Fonte',
    'Especificação',
    'Dotação Inicial',
    'Dotação Atualizada',
    'Saldo Disponível',
    '% Disponível'
  ];
  const lines = [header.map(csvEscape).join(';')];
  rows.forEach((r) =>
    lines.push(
      [
        r.orgao,
        r.local,
        r.acao,
        r.elemento,
        r.fonte,
        r.especificacao,
        r.inicial.toFixed(2).replace('.', ','),
        r.atualizada.toFixed(2).replace('.', ','),
        r.saldo.toFixed(2).replace('.', ','),
        r.percentual === null ? '' : r.percentual.toFixed(2).replace('.', ',')
      ]
        .map(csvEscape)
        .join(';')
    )
  );
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const o = ctx.activeOrg();
  const u = o && ctx.unitSelect.value !== 'all' ? ctx.activeUnits()[0] : null;
  a.download = `pca_${o ? o.code : 'todos'}${u ? '_' + u.code : ''}_agosto_2026.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function printPage() {
  window.print();
}
