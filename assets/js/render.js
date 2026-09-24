/** Consulta dos PCAs enviados — totais por secretaria e detalhamento de demandas. */

import { $, esc, money, normalize, intFmt } from './utils.js';

/**
 * @param {{ organs: object[], total: number, itemCount: number }} db
 * @param {object} ui
 */
export function createRenderer(db, ui) {
  const { orgSelect, unitSelect, search, overviewSection, detailSection } = ui;
  const organs = db.organs || [];

  function activeOrg() {
    return organs.find((o) => o.code === orgSelect.value) || null;
  }

  function sortedOrgans() {
    return [...organs].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
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

  function canonicalType(raw) {
    const n = normalize(raw).replace(/\s+/g, ' ').trim();
    if (!n || n === '-' || n === '—') return '';
    if (n.includes('mat') && (n.includes('serv') || n.includes('serv.'))) return 'Serviço Material';
    if (n.includes('comum')) return 'Serviço Comum';
    if (n === 'servico' || n === 'servicos') return 'Serviço';
    if (n.includes('engenharia')) return 'Engenharia';
    if (n.includes('material')) return 'Material';
    return String(raw).trim();
  }

  function canonicalPriority(raw) {
    const n = normalize(raw).trim();
    if (!n || n === '-' || n === '—') return '';
    if (n.startsWith('alta')) return 'Alta';
    if (n.startsWith('media')) return 'Média';
    if (n.startsWith('baixa')) return 'Baixa';
    return String(raw).trim();
  }

  function companyKind(raw) {
    const n = normalize(raw).replace(/\s+/g, ' ').trim();
    if (!n || n === '-' || n === '—') return 'empty';
    if (n === 'nsa' || n === 'nao se aplica' || n.includes('nao se aplica')) return 'na';
    return 'named';
  }

  function fillSelect(select, options, placeholder) {
    const prev = select.value || 'all';
    select.innerHTML =
      `<option value="all">${esc(placeholder)}</option>` +
      options.map((label) => `<option value="${esc(label)}">${esc(label)}</option>`).join('');
    select.value = [...select.options].some((o) => o.value === prev) ? prev : 'all';
  }

  function sectorNames(org) {
    const names = new Set();
    for (const s of org.sectors || []) if (s.name) names.add(s.name);
    for (const i of org.items || []) if (i.sector && i.sector !== '—') names.add(i.sector);
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function syncConsultaBar() {
    const bar = $('consultaFilterBar');
    const onConsulta = !$('viewConsulta').classList.contains('hidden');
    bar.classList.toggle('hidden', !onConsulta);
    if (!onConsulta) return;

    const org = activeOrg();
    const tipo = $('itemTipo');
    const prioridade = $('itemPrioridade');
    const empresa = $('itemEmpresa');
    const valor = $('itemValor');
    if (!org) {
      fillSelect(tipo, [], 'Todos os tipos');
      fillSelect(prioridade, [], 'Todas');
      tipo.disabled = true;
      prioridade.disabled = true;
      empresa.disabled = true;
      valor.disabled = true;
      return;
    }
    tipo.disabled = false;
    prioridade.disabled = false;
    empresa.disabled = false;
    valor.disabled = false;

    const types = [...new Set((org.items || []).map((i) => canonicalType(i.objectType)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
    const priorityOrder = ['Alta', 'Média', 'Baixa'];
    const priorities = [...new Set((org.items || []).map((i) => canonicalPriority(i.priority)).filter(Boolean))].sort(
      (a, b) => {
        const ia = priorityOrder.indexOf(a);
        const ib = priorityOrder.indexOf(b);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return a.localeCompare(b, 'pt-BR');
      }
    );
    fillSelect(tipo, types, 'Todos os tipos');
    fillSelect(prioridade, priorities, 'Todas');
  }

  function resetDetailFilters() {
    $('itemTipo').value = 'all';
    $('itemEmpresa').value = 'all';
    $('itemPrioridade').value = 'all';
    $('itemValor').value = 'desc';
    $('itemSetor').value = 'all';
  }

  function filteredItems() {
    const q = normalize(search.value);
    let items = scopeItems();
    const tipo = $('itemTipo').value;
    const empresa = $('itemEmpresa').value;
    const prioridade = $('itemPrioridade').value;
    if (tipo !== 'all') items = items.filter((i) => canonicalType(i.objectType) === tipo);
    if (empresa === 'named') items = items.filter((i) => companyKind(i.company) === 'named');
    if (empresa === 'na') items = items.filter((i) => companyKind(i.company) === 'na');
    if (prioridade !== 'all') items = items.filter((i) => canonicalPriority(i.priority) === prioridade);
    if (q) {
      items = items.filter((i) =>
        normalize(
          [i.dfdNo, i.sector, i.objectType, i.description, i.company, i.priority, i.period, i.budgetLink].join(' ')
        ).includes(q)
      );
    }
    const valor = $('itemValor').value === 'asc' ? 'asc' : 'desc';
    items.sort((a, b) => {
      const delta = (Number(a.total) || 0) - (Number(b.total) || 0);
      if (delta !== 0) return valor === 'asc' ? delta : -delta;
      return String(a.dfdNo || '').localeCompare(String(b.dfdNo || ''), 'pt-BR', { numeric: true });
    });
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
    const sectors = sectorNames(o);
    unitSelect.innerHTML =
      '<option value="all">Todos os setores</option>' +
      sectors.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
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
    populateUnitSelect();
    syncConsultaBar();
    renderScope();
    if (!activeOrg()) renderOverview();
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

  return { populateOrgSelect, populateUnitSelect, render, renderOverview, renderDetail, exportCSV, resetDetailFilters };
}
