/** Consulta dos PCAs enviados — totais por secretaria e detalhamento de demandas. */

import { $, esc, money, normalize, intFmt } from './utils.js';

/**
 * @param {{ organs: object[], total: number, itemCount: number }} db
 * @param {object} ui
 */
export function createRenderer(db, ui) {
  const { orgSelect, unitSelect, search, sort, overviewSection, localsSection, detailSection } = ui;
  const organs = db.organs || [];

  function activeOrg() {
    return organs.find((o) => o.code === orgSelect.value) || null;
  }

  function sortedOrgans() {
    const list = [...organs];
    const mode = sort.value;
    list.sort((a, b) => {
      if (mode === 'totalAsc') return a.total - b.total;
      if (mode === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      if (mode === 'itemsDesc') return b.itemCount - a.itemCount || b.total - a.total;
      return b.total - a.total;
    });
    return list;
  }

  function scopeTotal() {
    const o = activeOrg();
    if (!o) return db.total;
    if (unitSelect.value === 'all') return o.total;
    const sector = (o.sectors || []).find((s) => s.name === unitSelect.value);
    return sector ? sector.total : o.total;
  }

  function scopeItems() {
    const o = activeOrg();
    if (!o) return organs.flatMap((x) => x.items || []);
    if (unitSelect.value === 'all') return o.items || [];
    return (o.items || []).filter((i) => (i.sector || '—') === unitSelect.value);
  }

  function filteredItems() {
    const q = normalize(search.value);
    let items = scopeItems();
    if (q) {
      items = items.filter((i) =>
        normalize(
          [i.dfdNo, i.sector, i.objectType, i.description, i.company, i.priority, i.period, i.budgetLink].join(' ')
        ).includes(q)
      );
    }
    return items;
  }

  function populateOrgSelect() {
    orgSelect.innerHTML =
      '<option value="all">Todas as secretarias</option>' +
      sortedOrgans()
        .map((o) => `<option value="${esc(o.code)}">${esc(o.code)} — ${esc(o.name)}</option>`)
        .join('');
  }

  function populateUnitSelect() {
    const o = activeOrg();
    if (!o) {
      unitSelect.innerHTML = '<option value="all">Todos os setores</option>';
      unitSelect.disabled = true;
      return;
    }
    unitSelect.disabled = false;
    const prev = unitSelect.value;
    const sectors = [...(o.sectors || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    unitSelect.innerHTML =
      '<option value="all">Todos os setores</option>' +
      sectors.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
    if ([...unitSelect.options].some((x) => x.value === prev)) unitSelect.value = prev;
  }

  function renderScope() {
    const total = scopeTotal();
    const o = activeOrg();
    $('mInitial').textContent = money(total);
    if (!o) {
      $('mInitialSub').textContent = `${intFmt.format(db.itemCount)} itens em ${organs.length} secretarias / órgãos`;
    } else if (unitSelect.value === 'all') {
      $('mInitialSub').textContent = `${intFmt.format(o.itemCount)} itens em ${o.name}`;
    } else {
      const sector = (o.sectors || []).find((s) => s.name === unitSelect.value);
      $('mInitialSub').textContent = `${intFmt.format(sector?.itemCount || 0)} itens no setor selecionado`;
    }
  }

  function renderOverview() {
    const body = $('overviewBody');
    const list = sortedOrgans();
    body.innerHTML = list
      .map(
        (o) => `<tr>
      <td class="org-cell"><div class="code">${esc(o.code)}</div><div class="name">${esc(o.name)}</div></td>
      <td class="num">${money(o.total)}</td>
      <td class="num">${intFmt.format(o.itemCount)}</td>
      <td class="num"><button class="row-btn open-org" data-code="${esc(o.code)}" type="button">Abrir</button></td>
    </tr>`
      )
      .join('');
    $('overviewMeta').textContent = `${list.length} secretarias • ${money(db.total)} no total`;
    body.querySelectorAll('.open-org').forEach((b) =>
      b.addEventListener('click', () => {
        orgSelect.value = b.dataset.code;
        unitSelect.value = 'all';
        populateUnitSelect();
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
    );
  }

  function renderLocals() {
    const o = activeOrg();
    if (!o) {
      localsSection.classList.add('hidden');
      return;
    }
    localsSection.classList.remove('hidden');
    const cards = $('localCards');
    const allActive = unitSelect.value === 'all';
    const blocks = [
      `<button class="local-card ${allActive ? 'active' : ''}" data-unit="all" type="button">
    <div class="code">TODOS</div><div class="name">Todos os setores</div>
    <div class="summary"><span>${money(o.total)}</span><span>${intFmt.format(o.itemCount)} itens</span></div>
  </button>`
    ];
    for (const s of o.sectors || []) {
      blocks.push(`<button class="local-card ${unitSelect.value === s.name ? 'active' : ''}" data-unit="${esc(
        s.name
      )}" type="button">
      <div class="code">${esc(s.name.slice(0, 18))}</div><div class="name">${esc(s.name)}</div>
      <div class="summary"><span>${money(s.total)}</span><span>${intFmt.format(s.itemCount)} itens</span></div>
    </button>`);
    }
    cards.innerHTML = blocks.join('');
    $('localsMeta').textContent = `${(o.sectors || []).length} ${(o.sectors || []).length === 1 ? 'setor' : 'setores'}`;
    cards.querySelectorAll('.local-card').forEach((c) =>
      c.addEventListener('click', () => {
        unitSelect.value = c.dataset.unit;
        render();
      })
    );
  }

  function renderDetail() {
    const o = activeOrg();
    if (!o) {
      detailSection.classList.add('hidden');
      return;
    }
    detailSection.classList.remove('hidden');
    const items = filteredItems();
    const total = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
    $('detailSubtitle').textContent =
      unitSelect.value === 'all' ? o.name : `${o.name} • ${unitSelect.value}`;
    $('detailMeta').textContent = `${intFmt.format(items.length)} itens • ${money(total)}`;

    const body = $('actionGroups');
    const empty = $('emptyState');
    if (!items.length) {
      body.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    body.innerHTML = items
      .map(
        (i) => `<tr>
      <td><div class="code">${esc(i.dfdNo || '—')}</div></td>
      <td>${esc(i.sector || '—')}</td>
      <td>${esc(i.objectType || '—')}</td>
      <td>${esc(i.description || '—')}</td>
      <td>${esc(i.company || '—')}</td>
      <td class="num">${i.quantity ? intFmt.format(i.quantity) : '—'}${i.unitMeasure ? ` ${esc(i.unitMeasure)}` : ''}</td>
      <td class="num">${money(i.total || 0)}</td>
      <td>${esc(i.priority || '—')}</td>
      <td>${esc(i.period || '—')}</td>
    </tr>`
      )
      .join('');
  }

  function renderVisibility() {
    const o = activeOrg();
    overviewSection.classList.toggle('hidden', !!o);
  }

  function render() {
    renderVisibility();
    renderScope();
    if (!activeOrg()) renderOverview();
    renderLocals();
    renderDetail();
  }

  function exportCSV() {
    const items = activeOrg() ? filteredItems() : organs.flatMap((o) => o.items || []);
    const headers = [
      'Nº do DFD / Item',
      'Secretaria',
      'Setor / Departamento',
      'Tipo de Objeto',
      'Descrição',
      'Empresa',
      'Renovação de Contrato',
      'Quantidade',
      'Unidade',
      'Valor Unitário',
      'Valor Total',
      'Prioridade',
      'Período',
      'Vinculação Orçamentária'
    ];
    const rows = items.map((i) => [
      i.dfdNo,
      i.orgName,
      i.sector,
      i.objectType,
      i.description,
      i.company,
      i.contractRenewal,
      i.quantity,
      i.unitMeasure,
      i.unitValue,
      i.total,
      i.priority,
      i.period,
      i.budgetLink
    ]);
    const escCell = (v) => {
      const s = String(v ?? '');
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv =
      '\uFEFF' +
      [headers, ...rows].map((r) => r.map(escCell).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PCAs_Enviados_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { populateOrgSelect, populateUnitSelect, render, renderOverview, renderDetail, exportCSV };
}
