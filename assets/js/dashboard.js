/** Dashboards analíticos — layout compacto e gráficos condicionais. */

import {
  $,
  clamp,
  deltaBadge,
  esc,
  money,
  pct,
  pctText,
  shareBadge,
  sharePct,
  sum,
  variation
} from './utils.js';
import {
  availabilityStrips,
  donutChart,
  lollipopRank,
  stackedShare,
  topN,
  variationCompact,
  verticalBars
} from './charts.js';

const MIN_COMPARE = 2;
const TOP_BARS = 10;
const TOP_RANK = 12;

/**
 * @param {object[]} organs
 */
export function createDashboard(organs) {
  const orgSelect = $('dashOrgSelect');
  const unitSelect = $('dashUnitSelect');
  const metricSelect = $('dashMetric');
  const municipalInitial = sum(organs, 'initial');

  function activeOrg() {
    return organs.find((o) => o.code === orgSelect.value) || null;
  }

  function populateOrgSelect() {
    orgSelect.innerHTML =
      '<option value="all">Todos os órgãos (visão municipal)</option>' +
      organs.map((o) => `<option value="${esc(o.code)}">${esc(o.code)} — ${esc(o.name)}</option>`).join('');
  }

  function populateUnitSelect() {
    const o = activeOrg();
    if (!o) {
      unitSelect.innerHTML = '<option value="all">Todas as unidades</option>';
      unitSelect.disabled = true;
      return;
    }
    unitSelect.disabled = false;
    const prev = unitSelect.value;
    unitSelect.innerHTML =
      '<option value="all">Todas as unidades do órgão</option>' +
      o.units.map((u) => `<option value="${esc(u.code)}">${esc(u.code)} — ${esc(u.name)}</option>`).join('');
    if ([...unitSelect.options].some((x) => x.value === prev)) unitSelect.value = prev;
  }

  function level() {
    const o = activeOrg();
    if (!o) return 'municipal';
    if (unitSelect.value === 'all') return 'orgao';
    return 'unidade';
  }

  function scopeRecord() {
    const o = activeOrg();
    if (!o) {
      return {
        initial: sum(organs, 'initial'),
        updated: sum(organs, 'updated'),
        balance: sum(organs, 'balance')
      };
    }
    if (unitSelect.value === 'all') return o;
    return o.units.find((u) => u.code === unitSelect.value) || o;
  }

  function childRows() {
    const o = activeOrg();
    if (!o) {
      return organs.map((x) => ({
        code: x.code,
        label: `${x.code} — ${x.name}`,
        name: x.name,
        initial: x.initial,
        updated: x.updated,
        balance: x.balance
      }));
    }
    if (unitSelect.value === 'all') {
      return o.units.map((u) => ({
        code: u.code,
        label: `${u.code} — ${u.name}`,
        name: u.name,
        initial: u.initial,
        updated: u.updated,
        balance: u.balance
      }));
    }
    const u = o.units.find((x) => x.code === unitSelect.value);
    if (!u) return [];
    return u.actions.map((a) => ({
      code: a.code,
      label: `${a.code} — ${a.name}`,
      name: a.name,
      initial: a.initial,
      updated: a.updated,
      balance: a.balance
    }));
  }

  function metricValue(row) {
    const m = metricSelect.value;
    if (m === 'initial') return row.initial;
    if (m === 'balance') return row.balance;
    if (m === 'pct') {
      const p = pct(row.balance, row.updated);
      return p === null ? 0 : p;
    }
    return row.updated;
  }

  function metricLabel() {
    const m = metricSelect.value;
    if (m === 'initial') return 'Dotação Inicial';
    if (m === 'balance') return 'Saldo Disponível';
    if (m === 'pct') return '% Disponível';
    return 'Dotação Atualizada';
  }

  function formatMetric(v) {
    return metricSelect.value === 'pct' ? pctText(v) : money(v);
  }

  function shortMoney(v) {
    const n = Number(v) || 0;
    const abs = Math.abs(n);
    if (abs >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
    if (abs >= 1e3) return `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
    return money(n);
  }

  function setCard(id, visible) {
    const el = $(id);
    if (el) el.classList.toggle('hidden', !visible);
  }

  function renderKpis() {
    const rec = scopeRecord();
    const p = pct(rec.balance, rec.updated);
    const committed = rec.updated - rec.balance;
    const cp = p === null ? null : 100 - p;
    const vUpdated = variation(rec.initial, rec.updated);
    const shareInit = sharePct(rec.initial, municipalInitial);

    $('dInitial').textContent = money(rec.initial);
    $('dUpdated').textContent = money(rec.updated);
    $('dBalance').textContent = money(rec.balance);
    $('dCommitted').textContent = money(committed);
    $('dInitialDelta').innerHTML = shareBadge(shareInit, {
      title: 'Participação na Dotação Inicial municipal'
    });
    $('dUpdatedDelta').innerHTML = deltaBadge(vUpdated, {
      title: 'Variação da Dotação Atualizada em relação à Inicial'
    });
    $('dInitialSub').textContent = 'Participação no total inicial municipal';
    $('dVariation').textContent =
      vUpdated === 0 ? 'Sem alteração frente à inicial' : 'Variação frente à dotação inicial';
    $('dBalancePct').textContent = `${pctText(p)} da dotação atualizada`;
    $('dCommittedPct').textContent = `${pctText(cp)} da dotação atualizada`;
    $('dBalanceBar').style.width = `${clamp(p)}%`;
    $('dCommittedBar').style.width = `${clamp(cp)}%`;
  }

  function updateHint() {
    const lv = level();
    const o = activeOrg();
    if (lv === 'municipal') {
      $('dashHint').textContent =
        'Comparativo municipal. Clique em um código/barra para abrir a secretaria.';
    } else if (lv === 'orgao') {
      $('dashHint').textContent = `${o.name}: clique em uma unidade para ver as ações. Gráficos com um único item são ocultados.`;
    } else {
      const u = o.units.find((x) => x.code === unitSelect.value);
      $('dashHint').textContent = `Ações de ${u ? u.name : 'unidade'}. Comparações só aparecem quando há 2+ itens.`;
    }
  }

  function bindClicks(root) {
    if (!root) return;
    root.querySelectorAll('.chart-bar[data-code]').forEach((el) => {
      const go = () => {
        const code = el.getAttribute('data-code');
        if (!code) return;
        const lv = level();
        if (lv === 'municipal') {
          orgSelect.value = code;
          populateUnitSelect();
          render();
        } else if (lv === 'orgao') {
          unitSelect.value = code;
          render();
        }
      };
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  function renderCharts() {
    const rows = childRows();
    const canCompare = rows.length >= MIN_COMPARE;
    const totalUpdated = sum(rows, 'updated') || 1;
    const lv = level();
    const entity = lv === 'municipal' ? 'órgão' : lv === 'orgao' ? 'unidade' : 'ação';

    // Donut sempre (é do escopo, não série de barras)
    const rec = scopeRecord();
    $('chartDonut').innerHTML = donutChart(rec.balance, Math.max(0, rec.updated - rec.balance));
    setCard('cardDonut', true);

    // Comparativos: só com 2+ itens
    setCard('cardShare', canCompare);
    setCard('cardBars', canCompare);
    setCard('cardAvail', canCompare);
    setCard('cardRank', canCompare);
    setCard('cardVariation', canCompare);
    setCard('cardTable', rows.length > 0);

    $('tableDashSub').textContent =
      rows.length === 1
        ? 'Detalhe do item selecionado'
        : `Comparação detalhada por ${entity}`;

    if (!canCompare) {
      $('dashEmptyCompare')?.classList.remove('hidden');
      if (rows.length === 1) {
        renderTable(rows, totalUpdated);
      } else {
        $('dashTableBody').innerHTML = '';
      }
      return;
    }

    $('dashEmptyCompare')?.classList.add('hidden');

    const valueFn = (r) => (r.value != null ? r.value : metricValue(r));
    const prepared = rows.map((r) => {
      const v = metricValue(r);
      const share = (r.updated / totalUpdated) * 100;
      return {
        ...r,
        value: v,
        meta:
          metricSelect.value === 'pct'
            ? formatMetric(v)
            : `${shortMoney(v)} · ${pctText(share)}`
      };
    });

    // Composição sempre pela Dotação Atualizada (participação real no orçamento)
    const stackSource = rows.map((r) => ({
      ...r,
      value: r.updated,
      meta: `${shortMoney(r.updated)} · ${pctText((r.updated / totalUpdated) * 100)}`
    }));
    const stackRows = topN(stackSource, TOP_BARS, (r) => r.value);
    $('chartShareTitle').textContent = `Composição — Dotação Atualizada`;
    $('chartShareSub').textContent = `Participação relativa por ${entity} (Top ${Math.min(TOP_BARS, rows.length)})`;
    const shareEl = $('chartShare');
    shareEl.innerHTML = stackedShare(stackRows);
    bindClicks(shareEl);

    const barRows = topN(prepared, 8, valueFn).map((r) => ({
      ...r,
      meta: metricSelect.value === 'pct' ? formatMetric(r.value) : shortMoney(r.value)
    }));
    $('chartBarsTitle').textContent = `Top ${barRows.filter((r) => !r.isOther).length} — ${metricLabel()}`;
    $('chartBarsSub').textContent = `Comparação direta por ${entity}`;
    const barsEl = $('chartBars');
    barsEl.innerHTML = verticalBars(barRows, {
      format: metricSelect.value === 'pct' ? formatMetric : shortMoney
    });
    bindClicks(barsEl);

    const stripSource = [...rows]
      .sort((a, b) => b.updated - a.updated)
      .slice(0, TOP_RANK);
    $('chartAvailTitle').textContent = `% disponível por ${entity}`;
    $('chartAvailSub').textContent = 'Faixa compacta: verde = saldo ainda disponível';
    const availEl = $('chartAvail');
    availEl.innerHTML = availabilityStrips(stripSource);
    bindClicks(availEl);

    const rankRows = [...rows]
      .map((r) => ({
        ...r,
        value: pct(r.balance, r.updated)
      }))
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
      .slice(0, TOP_RANK);
    $('chartRankTitle').textContent = `Ranking de disponibilidade`;
    $('chartRankSub').textContent = `Maior % disponível por ${entity}`;
    const rankEl = $('chartRank');
    rankEl.innerHTML = lollipopRank(rankRows);
    bindClicks(rankEl);

    const varRows = [...rows]
      .map((r) => ({ ...r, value: variation(r.initial, r.updated) }))
      .filter((r) => r.value !== null)
      .sort((a, b) => Math.abs(b.value || 0) - Math.abs(a.value || 0))
      .slice(0, 10)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const varHtml = variationCompact(varRows);
    const showVar = Boolean(varHtml) && varRows.length >= MIN_COMPARE;
    setCard('cardVariation', showVar);
    if (showVar) {
      $('chartVariation').innerHTML = varHtml;
      bindClicks($('chartVariation'));
    }

    renderTable(rows, totalUpdated);
  }

  function renderTable(rows, totalUpdated) {
    const body = $('dashTableBody');
    const sorted = [...rows].sort((a, b) => b.updated - a.updated);
    body.innerHTML = sorted
      .map((r) => {
        const p = pct(r.balance, r.updated);
        const share = (r.updated / (totalUpdated || 1)) * 100;
        const v = variation(r.initial, r.updated);
        return `<tr>
        <td class="org-cell"><div class="code">${esc(r.code)}</div><div class="name">${esc(r.name)}</div></td>
        <td class="num">${money(r.initial)}</td>
        <td class="num">${money(r.updated)}</td>
        <td class="num">${money(r.balance)}</td>
        <td class="num">${pctText(p)}</td>
        <td class="num">${pctText(share)}</td>
        <td class="num">${v === null ? 'N/A' : `${v >= 0 ? '+' : ''}${pctText(v)}`}</td>
      </tr>`;
      })
      .join('');
  }

  function render() {
    renderKpis();
    updateHint();
    renderCharts();
  }

  function bind() {
    orgSelect.addEventListener('change', () => {
      unitSelect.value = 'all';
      populateUnitSelect();
      render();
    });
    unitSelect.addEventListener('change', render);
    metricSelect.addEventListener('change', render);
  }

  return {
    populateOrgSelect,
    populateUnitSelect,
    bind,
    render
  };
}
