/**
 * PCA Municipal 2027
 * Módulo independente da consulta orçamentária.
 * Mantém demandas/DFDs no localStorage do navegador.
 */
import { $, esc, money, normalize, intFmt } from './utils.js';

const STORAGE_KEY = 'paulo_afonso_pca_2027_v1';
const SCHEMA_VERSION = 1;
const PRIORITIES = ['Alta', 'Média', 'Baixa'];
const QUARTERS = ['1º Trimestre', '2º Trimestre', '3º Trimestre', '4º Trimestre'];
const LINKAGES = ['Sim', 'Não', 'A Indicar'];
const CONTRACT_RENEWALS = ['Sim', 'Não', 'A Indicar'];

const objectTypeSuggestions = ['Material', 'Material de Consumo', 'Serviço Comum', 'Engenharia'];

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `pca_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    year: 2027,
    items: [],
    sectors: {},
    updatedAt: new Date().toISOString()
  };
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  let n = raw.replace(/R\$/gi, '').replace(/\s/g, '');
  if (n.includes(',') && n.includes('.')) n = n.replace(/\./g, '').replace(',', '.');
  else if (n.includes(',')) n = n.replace(',', '.');
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(part, total) {
  const t = Number(total) || 0;
  return t > 0 ? ((Number(part) || 0) / t) * 100 : 0;
}

function pctText(value) {
  return `${new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value || 0)}%`;
}

function totalOf(item) {
  return (Number(item.quantity) || 0) * (Number(item.unitValue) || 0);
}

function itemFingerprint(item) {
  return [item.dfdNo,item.orgCode,item.sector,item.objectType,item.description,item.quantity,item.unitMeasure,item.unitValue]
    .map(v => normalize(String(v ?? ''))).join('|');
}

function titleCaseOfficial(name) {
  const small = new Set(['DE','DA','DO','DAS','DOS','E','PARA','A']);
  return String(name || '').toLocaleLowerCase('pt-BR').split(/\s+/).map((w,i)=>{
    const upper = w.toLocaleUpperCase('pt-BR');
    if (i > 0 && small.has(upper)) return w;
    return w ? w[0].toLocaleUpperCase('pt-BR') + w.slice(1) : w;
  }).join(' ');
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function sortNatural(a,b) {
  return String(a).localeCompare(String(b), 'pt-BR', { numeric:true, sensitivity:'base' });
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}

function downloadFile(name, content, type='text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i=0;i<src.length;i++) {
    const c=src[i];
    if (quoted) {
      if (c==='"' && src[i+1]==='"') { field+='"'; i++; }
      else if (c==='"') quoted=false;
      else field+=c;
    } else {
      if (c==='"') quoted=true;
      else if (c===';') { row.push(field); field=''; }
      else if (c==='\n') { row.push(field.replace(/\r$/,'')); rows.push(row); row=[]; field=''; }
      else field+=c;
    }
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/,'')); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

function canonicalHeader(s) {
  return normalize(String(s || '')).replace(/[^a-z0-9]+/g,' ').trim();
}

export function createPCA(organs) {
  const organMap = new Map(organs.map(o => [o.code, o]));
  const organNameMap = new Map(organs.map(o => [normalize(o.name), o]));
  let state = loadState();
  let editingId = null;
  let activeTab = 'overview';
  let toastTimer = null;

  const ui = {
    view: $('viewPCA'),
    tabs: [...document.querySelectorAll('[data-pca-tab]')],
    panels: [...document.querySelectorAll('[data-pca-panel]')],
    newBtn: $('pcaNewBtn'),
    importBtn: $('pcaImportBtn'),
    importInput: $('pcaImportInput'),
    modelBtn: $('pcaModelBtn'),
    search: $('pcaSearch'),
    org: $('pcaOrgFilter'),
    sector: $('pcaSectorFilter'),
    type: $('pcaTypeFilter'),
    priority: $('pcaPriorityFilter'),
    quarter: $('pcaQuarterFilter'),
    reset: $('pcaResetFilters'),
    filterStatus: $('pcaFilterStatus'),
    mItems: $('pcaMItems'),
    mValue: $('pcaMValue'),
    mHigh: $('pcaMHigh'),
    mHighSub: $('pcaMHighSub'),
    mLinked: $('pcaMLinked'),
    mLinkedSub: $('pcaMLinkedSub'),
    linkedBar: $('pcaLinkedBar'),
    quarterGrid: $('pcaQuarterGrid'),
    priorityList: $('pcaPriorityList'),
    orgOverviewBody: $('pcaOrgOverviewBody'),
    overviewMeta: $('pcaOverviewMeta'),
    overviewEmpty: $('pcaOverviewEmpty'),
    itemsBody: $('pcaItemsBody'),
    itemsEmpty: $('pcaItemsEmpty'),
    itemsWrap: $('pcaItemsWrap'),
    itemsMeta: $('pcaItemsMeta'),
    sectorOrg: $('pcaSectorOrg'),
    sectorName: $('pcaSectorName'),
    addSector: $('pcaAddSector'),
    sectorBody: $('pcaSectorBody'),
    sectorEmpty: $('pcaSectorEmpty'),
    sectorWrap: $('pcaSectorWrap'),
    modal: $('pcaModal'),
    modalTitle: $('pcaModalTitle'),
    modalClose: $('pcaModalClose'),
    modalCancel: $('pcaModalCancel'),
    form: $('pcaForm'),
    dfd: $('pcaDfd'),
    formOrg: $('pcaFormOrg'),
    formSector: $('pcaFormSector'),
    formSectorHelp: $('pcaFormSectorHelp'),
    company: $('pcaCompany'),
    contractRenewal: $('pcaContractRenewal'),
    objectType: $('pcaObjectType'),
    objectTypeSuggestions: $('pcaObjectTypeSuggestions'),
    description: $('pcaDescription'),
    quantity: $('pcaQuantity'),
    unitMeasure: $('pcaUnitMeasure'),
    unitValue: $('pcaUnitValue'),
    total: $('pcaCalculatedTotal'),
    priorityForm: $('pcaPriority'),
    quarterForm: $('pcaQuarter'),
    linkageForm: $('pcaLinkage'),
    importModal: $('pcaImportModal'),
    importClose: $('pcaImportClose'),
    importCancel: $('pcaImportCancel'),
    importConfirm: $('pcaImportConfirm'),
    importValid: $('pcaImportValid'),
    importInvalid: $('pcaImportInvalid'),
    importTotal: $('pcaImportTotal'),
    importErrors: $('pcaImportErrors'),
    toast: $('pcaToast')
  };

  let pendingImport = { valid: [], errors: [] };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.items)) return defaultState();
      parsed.sectors = parsed.sectors && typeof parsed.sectors === 'object' ? parsed.sectors : {};
      parsed.year = 2027;
      return parsed;
    } catch (err) {
      console.warn('PCA: não foi possível ler localStorage.', err);
      return defaultState();
    }
  }

  function saveState() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showToast(message, type='ok') {
    clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.toggle('error', type === 'error');
    ui.toast.classList.add('show');
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3200);
  }

  function fillOrgSelect(select, allLabel=null) {
    select.innerHTML = '';
    if (allLabel !== null) {
      const o = document.createElement('option'); o.value='all'; o.textContent=allLabel; select.appendChild(o);
    } else {
      const o = document.createElement('option'); o.value=''; o.textContent='Selecione…'; select.appendChild(o);
    }
    organs.forEach(org => {
      const o=document.createElement('option');
      o.value=org.code;
      o.textContent=`${org.code} — ${titleCaseOfficial(org.name)}`;
      select.appendChild(o);
    });
  }

  function sectorNames(orgCode) {
    const registered = Array.isArray(state.sectors[orgCode]) ? state.sectors[orgCode] : [];
    const used = state.items.filter(i=>i.orgCode===orgCode).map(i=>i.sector);
    return [...new Set([...registered,...used].map(cleanText).filter(Boolean))].sort(sortNatural);
  }

  function ensureSector(orgCode, sector) {
    const s=cleanText(sector);
    if (!orgCode || !s) return;
    const list = sectorNames(orgCode);
    if (!list.some(x=>normalize(x)===normalize(s))) list.push(s);
    state.sectors[orgCode]=list.sort(sortNatural);
  }

  function populateSectorFilter() {
    const orgCode=ui.org.value;
    const current=ui.sector.value;
    ui.sector.innerHTML='<option value="all">Todos os setores</option>';
    let sectors=[];
    if (orgCode==='all') sectors=[...new Set(state.items.map(i=>i.sector).filter(Boolean))].sort(sortNatural);
    else sectors=sectorNames(orgCode);
    sectors.forEach(s=>{
      const o=document.createElement('option');o.value=s;o.textContent=s;ui.sector.appendChild(o);
    });
    ui.sector.value=[...ui.sector.options].some(o=>o.value===current)?current:'all';
  }

  function populateTypeFilter() {
    const current=ui.type.value;
    const types=[...new Set(state.items.map(i=>i.objectType).filter(Boolean))].sort(sortNatural);
    ui.type.innerHTML='<option value="all">Todos os tipos</option>';
    types.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;ui.type.appendChild(o)});
    ui.type.value=[...ui.type.options].some(o=>o.value===current)?current:'all';
  }

  function populateFormSectors(selectedSector = '') {
    const orgCode = ui.formOrg.value;
    const current = cleanText(selectedSector);
    ui.formSector.innerHTML = '';

    if (!orgCode) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Selecione a secretaria primeiro…';
      ui.formSector.appendChild(o);
      ui.formSector.disabled = true;
      if (ui.formSectorHelp) {
        ui.formSectorHelp.textContent =
          'Escolha a secretaria/órgão para carregar os setores cadastrados.';
      }
      return;
    }

    const sectors = sectorNames(orgCode);
    ui.formSector.disabled = false;

    if (!sectors.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Nenhum setor cadastrado para esta secretaria';
      ui.formSector.appendChild(o);
      ui.formSector.disabled = true;
      if (ui.formSectorHelp) {
        ui.formSectorHelp.innerHTML =
          'Cadastre o setor em <strong>Setores / Departamentos</strong> e volte para criar a demanda.';
      }
      return;
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione o setor / departamento…';
    ui.formSector.appendChild(placeholder);

    sectors.forEach((s) => {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = s;
      ui.formSector.appendChild(o);
    });

    if (current && [...ui.formSector.options].some((o) => normalize(o.value) === normalize(current))) {
      const match = [...ui.formSector.options].find((o) => normalize(o.value) === normalize(current));
      ui.formSector.value = match.value;
    } else {
      ui.formSector.value = '';
    }

    if (ui.formSectorHelp) {
      ui.formSectorHelp.textContent = `${sectors.length} setor(es) cadastrado(s) para esta secretaria.`;
    }
  }

  /** @deprecated alias mantido para chamadas existentes */
  function updateFormSectorSuggestions() {
    populateFormSectors(ui.formSector.value);
  }

  function getFilteredItems() {
    const q=normalize(ui.search.value);
    return state.items.filter(item => {
      if (ui.org.value!=='all' && item.orgCode!==ui.org.value) return false;
      if (ui.sector.value!=='all' && normalize(item.sector)!==normalize(ui.sector.value)) return false;
      if (ui.type.value!=='all' && item.objectType!==ui.type.value) return false;
      if (ui.priority.value!=='all' && item.priority!==ui.priority.value) return false;
      if (ui.quarter.value!=='all' && item.quarter!==ui.quarter.value) return false;
      if (q) {
        const hay=normalize([item.dfdNo,item.orgName,item.sector,item.objectType,item.description,item.company,item.contractRenewal,item.unitMeasure,item.priority,item.quarter,item.budgetLink].join(' '));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderMetrics(items) {
    const total=items.reduce((s,i)=>s+totalOf(i),0);
    const high=items.filter(i=>i.priority==='Alta').length;
    const linked=items.filter(i=>i.budgetLink==='Sim').length;
    ui.mItems.textContent=intFmt.format(items.length);
    ui.mValue.textContent=money(total);
    ui.mHigh.textContent=intFmt.format(high);
    ui.mHighSub.textContent=items.length?`${pctText(pct(high,items.length))} dos itens filtrados`:'Nenhuma demanda cadastrada';
    ui.mLinked.textContent=pctText(pct(linked,items.length));
    ui.mLinkedSub.textContent=items.length?`${linked} de ${items.length} itens com vinculação “Sim”`:'Nenhuma demanda cadastrada';
    ui.linkedBar.style.width=`${Math.min(100,pct(linked,items.length))}%`;
  }

  function renderQuarter(items) {
    const totalValue=items.reduce((s,i)=>s+totalOf(i),0);
    ui.quarterGrid.innerHTML=QUARTERS.map(q=>{
      const list=items.filter(i=>i.quarter===q);
      const value=list.reduce((s,i)=>s+totalOf(i),0);
      return `<div class="pca-quarter">
        <div class="pca-quarter-top"><span class="pca-quarter-name">${esc(q)}</span><span class="pca-quarter-count">${list.length} ${list.length===1?'item':'itens'}</span></div>
        <div class="pca-quarter-value">${money(value)}</div>
        <div class="pca-quarter-pct">${pctText(pct(value,totalValue))} do valor estimado</div>
        <div class="track"><div class="fill" style="width:${Math.min(100,pct(value,totalValue))}%"></div></div>
      </div>`;
    }).join('');
  }

  function renderPriorities(items) {
    const total=items.length;
    const classMap={'Alta':'high','Média':'medium','Baixa':'low'};
    ui.priorityList.innerHTML=PRIORITIES.map(p=>{
      const list=items.filter(i=>i.priority===p);
      const v=pct(list.length,total);
      return `<div class="pca-priority-row">
        <div class="pca-priority-label"><span class="pca-priority-dot ${classMap[p]}"></span>${p}</div>
        <div class="pca-priority-track"><div class="pca-priority-fill" style="width:${Math.min(100,v)}%"></div></div>
        <div class="pca-priority-value">${list.length} · ${pctText(v)}</div>
      </div>`;
    }).join('');
  }

  function renderOrgOverview(items) {
    const totals = organs.map(org=>{
      const list=items.filter(i=>i.orgCode===org.code);
      return {
        org,
        sectors:new Set(list.map(i=>i.sector).filter(Boolean)).size,
        count:list.length,
        value:list.reduce((s,i)=>s+totalOf(i),0),
        high:list.filter(i=>i.priority==='Alta').length,
        linked:list.filter(i=>i.budgetLink==='Sim').length
      };
    }).filter(x=>x.count>0);
    totals.sort((a,b)=>b.value-a.value || sortNatural(a.org.code,b.org.code));
    ui.overviewMeta.textContent=totals.length?`${totals.length} órgãos com demandas cadastradas`:'Nenhum órgão com demandas';
    ui.overviewEmpty.classList.toggle('hidden', totals.length !== 0);
    ui.orgOverviewBody.closest('.pca-overview-wrap').classList.toggle('hidden', totals.length === 0);
    ui.orgOverviewBody.innerHTML=totals.map(x=>`<tr>
      <td><div class="pca-org-code">${esc(x.org.code)}</div><div class="pca-org-name">${esc(titleCaseOfficial(x.org.name))}</div></td>
      <td class="num">${x.sectors}</td>
      <td class="num">${x.count}</td>
      <td class="num"><strong>${money(x.value)}</strong></td>
      <td class="num">${x.high}</td>
      <td class="num">${pctText(pct(x.linked,x.count))}</td>
      <td class="num"><button class="pca-icon-btn" type="button" data-pca-open-org="${esc(x.org.code)}">Abrir</button></td>
    </tr>`).join('');
  }

  function priorityBadge(p) {
    const cls=p==='Alta'?'high':p==='Média'?'medium':'low';
    return `<span class="pca-badge ${cls}">${esc(p)}</span>`;
  }
  function linkageBadge(v) {
    const cls=v==='Sim'?'yes':v==='Não'?'no':'pending';
    return `<span class="pca-badge ${cls}">${esc(v)}</span>`;
  }

  function renderItems(items) {
    const sorted=[...items].sort((a,b)=>sortNatural(a.orgCode,b.orgCode)||sortNatural(a.sector,b.sector)||sortNatural(a.dfdNo,b.dfdNo)||new Date(a.createdAt)-new Date(b.createdAt));
    ui.itemsMeta.textContent=`${sorted.length} ${sorted.length===1?'item':'itens'} · ${money(sorted.reduce((s,i)=>s+totalOf(i),0))}`;
    ui.itemsBody.innerHTML=sorted.map(item=>`<tr>
      <td><div class="pca-dfd">${esc(item.dfdNo)}</div></td>
      <td><div class="pca-org-code">${esc(item.orgCode)}</div><div class="pca-org-name">${esc(titleCaseOfficial(item.orgName))}</div><div class="pca-subline">${esc(item.sector)}</div></td>
      <td><span class="pca-badge type">${esc(item.objectType)}</span></td>
      <td><div class="pca-desc">${esc(item.description)}</div></td>
      <td>${item.company ? esc(item.company) : '<span class="pca-subline">—</span>'}</td>
      <td>${linkageBadge(item.contractRenewal || 'A Indicar')}</td>
      <td class="num">${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(item.quantity)}</td>
      <td>${esc(item.unitMeasure)}</td>
      <td class="num">${money(item.unitValue)}</td>
      <td class="num"><strong>${money(totalOf(item))}</strong></td>
      <td>${priorityBadge(item.priority)}</td>
      <td><span class="pca-badge quarter">${esc(item.quarter)}</span></td>
      <td>${linkageBadge(item.budgetLink)}</td>
      <td><div class="pca-row-actions">
        <button class="pca-icon-btn" type="button" data-pca-edit="${esc(item.id)}">Editar</button>
        <button class="pca-icon-btn" type="button" data-pca-duplicate="${esc(item.id)}">Duplicar</button>
        <button class="pca-icon-btn danger" type="button" data-pca-delete="${esc(item.id)}">Excluir</button>
      </div></td>
    </tr>`).join('');
    ui.itemsWrap.classList.toggle('hidden',sorted.length===0);
    ui.itemsEmpty.classList.toggle('hidden',sorted.length!==0);
  }

  function renderSectors() {
    const orgCode=ui.sectorOrg.value;
    const list=orgCode?sectorNames(orgCode):[];
    const org=organMap.get(orgCode);
    ui.sectorBody.innerHTML=list.map(s=>{
      const items=state.items.filter(i=>i.orgCode===orgCode && normalize(i.sector)===normalize(s));
      const val=items.reduce((sum,i)=>sum+totalOf(i),0);
      return `<tr>
        <td><div class="pca-sector-name">${esc(s)}</div></td>
        <td class="num">${items.length}</td>
        <td class="num">${money(val)}</td>
        <td class="num"><button class="pca-icon-btn danger" type="button" data-pca-sector-delete="${esc(s)}" ${items.length?'disabled title="Setor possui demandas e não pode ser removido"':''}>Remover</button></td>
      </tr>`;
    }).join('');
    ui.sectorWrap.classList.toggle('hidden',list.length===0);
    ui.sectorEmpty.classList.toggle('hidden',list.length!==0);
    if (org) ui.sectorEmpty.innerHTML=`<strong>Nenhum setor cadastrado</strong>Cadastre os setores/departamentos reais de ${esc(titleCaseOfficial(org.name))}. Nenhum nome é criado automaticamente pelo sistema.`;
  }

  function render() {
    populateSectorFilter();
    populateTypeFilter();
    const items=getFilteredItems();
    renderMetrics(items);
    renderQuarter(items);
    renderPriorities(items);
    renderOrgOverview(items);
    renderItems(items);
    renderSectors();
    ui.filterStatus.textContent=state.items.length===items.length
      ? `${state.items.length} ${state.items.length===1?'item cadastrado':'itens cadastrados'} na base local`
      : `${items.length} de ${state.items.length} itens exibidos`;
  }

  function setTab(tab) {
    activeTab=tab;
    ui.tabs.forEach(b=>b.classList.toggle('active',b.dataset.pcaTab===tab));
    ui.panels.forEach(p=>p.classList.toggle('hidden',p.dataset.pcaPanel!==tab));
    if (tab==='sectors') renderSectors();
  }

  function clearErrors() {
    ui.form.querySelectorAll('.control.invalid').forEach(x=>x.classList.remove('invalid'));
    ui.form.querySelectorAll('.pca-field-error').forEach(x=>x.classList.remove('show'));
  }

  function flag(field,msg) {
    field.classList.add('invalid');
    const err=field.closest('.field')?.querySelector('.pca-field-error');
    if (err) { err.textContent=msg; err.classList.add('show'); }
  }

  function validateForm() {
    clearErrors();
    let ok=true;
    const required=[
      [ui.dfd,'Informe o Nº do DFD / Item.'],[ui.formOrg,'Selecione a secretaria/órgão.'],[ui.formSector,'Selecione o setor/departamento cadastrado.'],
      [ui.objectType,'Informe o tipo de objeto.'],[ui.description,'Descreva o item.'],[ui.quantity,'Informe uma quantidade maior que zero.'],
      [ui.unitMeasure,'Informe a unidade de medida.'],[ui.unitValue,'Informe o valor unitário estimado.'],[ui.priorityForm,'Selecione a prioridade.'],
      [ui.quarterForm,'Selecione o trimestre.'],[ui.contractRenewal,'Informe se há renovação de contrato.'],[ui.linkageForm,'Selecione a vinculação orçamentária.']
    ];
    required.forEach(([f,msg])=>{ if (!cleanText(f.value)) {flag(f,msg);ok=false;} });
    if (ui.formOrg.value && !sectorNames(ui.formOrg.value).length) {
      flag(ui.formSector,'Cadastre ao menos um setor para esta secretaria.');
      ok=false;
    }
    if (toNumber(ui.quantity.value)<=0){flag(ui.quantity,'A quantidade deve ser maior que zero.');ok=false;}
    if (toNumber(ui.unitValue.value)<0){flag(ui.unitValue,'O valor unitário não pode ser negativo.');ok=false;}
    return ok;
  }

  function updateCalculatedTotal() {
    ui.total.textContent=money(toNumber(ui.quantity.value)*toNumber(ui.unitValue.value));
  }

  function resetForm() {
    editingId=null;
    ui.form.reset();
    clearErrors();
    ui.modalTitle.textContent='Nova demanda / item do PCA';
    ui.total.textContent=money(0);
    ui.formOrg.value = ui.org.value !== 'all' ? ui.org.value : '';
    populateFormSectors();
  }

  function openModal(item=null) {
    resetForm();
    if (item) {
      editingId=item.id;
      ui.modalTitle.textContent='Editar demanda / item do PCA';
      ui.dfd.value=item.dfdNo;
      ui.formOrg.value=item.orgCode;
      populateFormSectors(item.sector);
      ui.objectType.value=item.objectType;
      ui.description.value=item.description;
      ui.quantity.value=item.quantity;
      ui.unitMeasure.value=item.unitMeasure;
      ui.unitValue.value=item.unitValue;
      ui.priorityForm.value=item.priority;
      ui.quarterForm.value=item.quarter;
      ui.company.value=item.company || '';
      ui.contractRenewal.value=item.contractRenewal || '';
      ui.linkageForm.value=item.budgetLink;
      updateCalculatedTotal();
    }
    ui.modal.classList.remove('hidden');
    setTimeout(()=>ui.dfd.focus(),30);
  }

  function closeModal(){ui.modal.classList.add('hidden');clearErrors();}

  function saveForm(event) {
    event.preventDefault();
    if (!validateForm()) return;
    const org=organMap.get(ui.formOrg.value);
    if (!org) { flag(ui.formOrg,'Secretaria/órgão inválido.'); return; }
    const sector=cleanText(ui.formSector.value);
    ensureSector(org.code,sector);
    const now=new Date().toISOString();
    const base={
      dfdNo:cleanText(ui.dfd.value),orgCode:org.code,orgName:org.name,sector,
      objectType:cleanText(ui.objectType.value),description:cleanText(ui.description.value),
      quantity:toNumber(ui.quantity.value),unitMeasure:cleanText(ui.unitMeasure.value),unitValue:toNumber(ui.unitValue.value),
      company:cleanText(ui.company.value),
      contractRenewal:ui.contractRenewal.value,
      priority:ui.priorityForm.value,quarter:ui.quarterForm.value,budgetLink:ui.linkageForm.value,updatedAt:now
    };
    const duplicate = state.items.find(i => i.id !== editingId && itemFingerprint(i) === itemFingerprint(base));
    if (duplicate) {
      showToast(`Já existe uma demanda idêntica (${duplicate.dfdNo}). Revise antes de salvar.`, 'error');
      return;
    }
    if (editingId) {
      const idx=state.items.findIndex(i=>i.id===editingId);
      if (idx>=0) state.items[idx]={...state.items[idx],...base};
      showToast('Demanda atualizada com sucesso.');
    } else {
      state.items.push({id:createId(),...base,createdAt:now});
      showToast('Demanda adicionada ao PCA.');
    }
    saveState();
    closeModal();
    render();
  }

  function deleteItem(id) {
    const item=state.items.find(i=>i.id===id); if(!item)return;
    if (!confirm(`Excluir ${item.dfdNo} — ${item.description}?\n\nEsta ação não pode ser desfeita.`)) return;
    state.items=state.items.filter(i=>i.id!==id);
    saveState();render();showToast('Demanda excluída.');
  }

  function duplicateItem(id) {
    const item=state.items.find(i=>i.id===id); if(!item)return;
    const now=new Date().toISOString();
    state.items.push({...item,id:createId(),dfdNo:`${item.dfdNo} — cópia`,createdAt:now,updatedAt:now});
    ensureSector(item.orgCode,item.sector);saveState();render();showToast('Item duplicado. Revise a identificação do DFD.');
  }

  function addSector() {
    const orgCode=ui.sectorOrg.value;
    const name=cleanText(ui.sectorName.value);
    if (!orgCode){showToast('Selecione uma secretaria/órgão.', 'error');return;}
    if (!name){showToast('Informe o nome real do setor/departamento.', 'error');return;}
    const existing=sectorNames(orgCode);
    if(existing.some(s=>normalize(s)===normalize(name))){showToast('Este setor já está cadastrado.', 'error');return;}
    state.sectors[orgCode]=[...(state.sectors[orgCode]||[]),name].sort(sortNatural);
    ui.sectorName.value='';saveState();render();populateFormSectors(name);showToast('Setor cadastrado.');
  }

  function removeSector(name) {
    const orgCode=ui.sectorOrg.value;
    const used=state.items.some(i=>i.orgCode===orgCode&&normalize(i.sector)===normalize(name));
    if(used){showToast('O setor possui demandas e não pode ser removido.', 'error');return;}
    state.sectors[orgCode]=(state.sectors[orgCode]||[]).filter(s=>normalize(s)!==normalize(name));
    saveState();render();showToast('Setor removido.');
  }

  function resetFilters() {
    ui.search.value='';ui.org.value='all';populateSectorFilter();ui.sector.value='all';ui.type.value='all';ui.priority.value='all';ui.quarter.value='all';render();
  }

  function exportCSV() {
    const items=getFilteredItems();
    if(!items.length){showToast('Não há itens no filtro atual para exportar.', 'error');return;}
    const headers=['Nº do DFD / Item','Secretaria Requisitante','Setor / Departamento','Tipo de Objeto','Descrição do Item','Empresa','Renovação de Contrato','Quantidade Estimada','Unidade de Medida','Valor Unitário Estimado','Valor Total Estimado','Grau de Prioridade','Trimestre Estimado','Vinculação Orçamentária'];
    const rows=items.map(i=>[i.dfdNo,i.orgName,i.sector,i.objectType,i.description,i.company||'',i.contractRenewal||'A Indicar',String(i.quantity).replace('.',','),i.unitMeasure,i.unitValue.toFixed(2).replace('.',','),totalOf(i).toFixed(2).replace('.',','),i.priority,i.quarter,i.budgetLink]);
    const csv='\uFEFF'+[headers,...rows].map(r=>r.map(csvEscape).join(';')).join('\r\n');
    downloadFile(`PCA_2027_${new Date().toISOString().slice(0,10)}.csv`,csv,'text/csv;charset=utf-8');
    showToast(`${items.length} item(ns) exportado(s) em CSV.`);
  }

  function downloadModel() {
    const headers=['Nº do DFD / Item','Secretaria Requisitante','Setor / Departamento','Tipo de Objeto','Descrição do Item','Empresa','Renovação de Contrato','Quantidade Estimada','Unidade de Medida','Valor Unitário Estimado','Valor Total Estimado','Grau de Prioridade','Trimestre Estimado','Vinculação Orçamentária'];
    const csv='\uFEFF'+headers.map(csvEscape).join(';')+'\r\n';
    downloadFile('MODELO_IMPORTACAO_PCA_2027.csv',csv,'text/csv;charset=utf-8');
    showToast('Modelo CSV baixado.');
  }

  function matchOrgByName(name) {
    const norm=normalize(name);
    if(organNameMap.has(norm)) return organNameMap.get(norm);
    const withoutCode=norm.replace(/^\d+\s*[-–—]\s*/,'').trim();
    for(const org of organs){if(normalize(org.name)===withoutCode)return org;}
    return null;
  }

  function parseImportRow(obj,rowNumber) {
    const errors=[];
    const dfd=cleanText(obj.dfd);
    const org=matchOrgByName(obj.org);
    const sector=cleanText(obj.sector);
    const objectType=cleanText(obj.type);
    const description=cleanText(obj.description);
    const company=cleanText(obj.company);
    const renewal=cleanText(obj.renewal);
    const quantity=toNumber(obj.quantity);
    const unit=cleanText(obj.unit);
    const unitValue=toNumber(obj.unitValue);
    const priority=cleanText(obj.priority);
    const quarter=cleanText(obj.quarter);
    const link=cleanText(obj.linkage);
    if(!dfd) errors.push('DFD/Item vazio');
    if(!org) errors.push('Secretaria/órgão não reconhecido');
    if(!sector) errors.push('Setor/Departamento vazio');
    if(!objectType) errors.push('Tipo de Objeto vazio');
    if(!description) errors.push('Descrição vazia');
    if(!(quantity>0)) errors.push('Quantidade inválida');
    if(!unit) errors.push('Unidade de Medida vazia');
    if(unitValue<0 || String(obj.unitValue??'').trim()==='') errors.push('Valor Unitário inválido');
    if(!PRIORITIES.some(x=>normalize(x)===normalize(priority))) errors.push('Prioridade inválida');
    if(!QUARTERS.some(x=>normalize(x)===normalize(quarter))) errors.push('Trimestre inválido');
    if(renewal && !CONTRACT_RENEWALS.some(x=>normalize(x)===normalize(renewal))) errors.push('Renovação de Contrato inválida');
    if(!LINKAGES.some(x=>normalize(x)===normalize(link))) errors.push('Vinculação inválida');
    if(errors.length) return {error:`Linha ${rowNumber}: ${errors.join('; ')}`};
    const exact=(list,val)=>list.find(x=>normalize(x)===normalize(val));
    const now=new Date().toISOString();
    return {item:{
      id:createId(),dfdNo:dfd,orgCode:org.code,orgName:org.name,sector,objectType,description,
      company,
      contractRenewal:renewal?exact(CONTRACT_RENEWALS,renewal):'A Indicar',
      quantity,unitMeasure:unit,unitValue,
      priority:exact(PRIORITIES,priority),quarter:exact(QUARTERS,quarter),budgetLink:exact(LINKAGES,link),
      createdAt:now,updatedAt:now
    }};
  }

  async function handleImportFile(file) {
    if(!file)return;
    try{
      const text=await file.text();
      const rows=parseCSV(text);
      if(rows.length<2) throw new Error('O CSV está vazio ou contém apenas o cabeçalho.');
      const headers=rows[0].map(canonicalHeader);
      const aliases={
        dfd:['n do dfd item','no do dfd item','nº do dfd item','identificacao','identificação'],
        org:['secretaria requisitante','secretaria'],sector:['setor departamento','setor'],type:['tipo de objeto','tipo do objeto'],
        description:['descricao do item','descrição do item','descricao','descrição'],
        company:['empresa','razao social','razão social','fornecedor'],
        renewal:['renovacao de contrato','renovação de contrato','renovacao','renovação'],
        quantity:['quantidade estimada','quantidade'],unit:['unidade de medida'],
        unitValue:['valor unitario estimado','valor unitário estimado'],priority:['grau de prioridade','prioridade'],quarter:['trimestre estimado','trimestre'],linkage:['vinculacao orcamentaria','vinculação orçamentária','vinculacao orçamentaria']
      };
      const idx={};
      for(const [key,names] of Object.entries(aliases)) idx[key]=headers.findIndex(h=>names.map(canonicalHeader).includes(h));
      const required=['dfd','org','sector','type','description','quantity','unit','unitValue','priority','quarter','linkage'];
      const missing=required.filter(k=>idx[k]<0);
      if(missing.length) throw new Error(`Cabeçalho incompatível. Use o botão “Baixar modelo CSV” antes de preencher a planilha.`);
      const valid=[],errors=[];
      const seen=new Set(state.items.map(itemFingerprint));
      rows.slice(1).forEach((r,n)=>{
        const obj={};Object.keys(idx).forEach(k=>obj[k]=r[idx[k]]??'');
        const parsed=parseImportRow(obj,n+2);
        if(parsed.error) { errors.push(parsed.error); return; }
        const fp=itemFingerprint(parsed.item);
        if(seen.has(fp)) { errors.push(`Linha ${n+2}: demanda idêntica já existe na base ou no próprio arquivo`); return; }
        seen.add(fp);valid.push(parsed.item);
      });
      pendingImport={valid,errors};
      ui.importValid.textContent=valid.length;ui.importInvalid.textContent=errors.length;ui.importTotal.textContent=rows.length-1;
      ui.importErrors.innerHTML=errors.length?`<strong>Linhas não importáveis:</strong><br>${errors.slice(0,20).map(esc).join('<br>')}${errors.length>20?`<br>… e mais ${errors.length-20}`:''}`:'Todas as linhas passaram pela validação.';
      ui.importConfirm.disabled=valid.length===0;
      ui.importModal.classList.remove('hidden');
    }catch(err){showToast(err.message||'Falha ao ler CSV.','error');}
    finally{ui.importInput.value='';}
  }

  function confirmImport() {
    if(!pendingImport.valid.length)return;
    pendingImport.valid.forEach(item=>{state.items.push(item);ensureSector(item.orgCode,item.sector)});
    saveState();ui.importModal.classList.add('hidden');const n=pendingImport.valid.length;pendingImport={valid:[],errors:[]};render();showToast(`${n} item(ns) importado(s) com sucesso.`);
  }

  function bind() {
    fillOrgSelect(ui.org,'Todas as secretarias / órgãos');
    fillOrgSelect(ui.formOrg,null);
    fillOrgSelect(ui.sectorOrg,null);
    objectTypeSuggestions.forEach(v=>{const o=document.createElement('option');o.value=v;ui.objectTypeSuggestions.appendChild(o)});
    PRIORITIES.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;ui.priorityForm.appendChild(o)});
    QUARTERS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;ui.quarterForm.appendChild(o)});
    LINKAGES.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;ui.linkageForm.appendChild(o)});
    CONTRACT_RENEWALS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;ui.contractRenewal.appendChild(o)});
    PRIORITIES.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;ui.priority.appendChild(o)});
    QUARTERS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;ui.quarter.appendChild(o)});

    ui.tabs.forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.pcaTab)));
    ui.newBtn.addEventListener('click',()=>openModal());
    ui.modalClose.addEventListener('click',closeModal);ui.modalCancel.addEventListener('click',closeModal);
    ui.modal.addEventListener('click',e=>{if(e.target===ui.modal)closeModal()});
    ui.form.addEventListener('submit',saveForm);
    ui.formOrg.addEventListener('change',()=>{ui.formSector.value='';populateFormSectors()});
    ui.quantity.addEventListener('input',updateCalculatedTotal);ui.unitValue.addEventListener('input',updateCalculatedTotal);

    [ui.search,ui.org,ui.sector,ui.type,ui.priority,ui.quarter].forEach(el=>{
      const event=el===ui.search?'input':'change';
      el.addEventListener(event,()=>{if(el===ui.org)populateSectorFilter();render()});
    });
    ui.reset.addEventListener('click',resetFilters);
    ui.modelBtn.addEventListener('click',downloadModel);
    ui.importBtn.addEventListener('click',()=>ui.importInput.click());ui.importInput.addEventListener('change',()=>handleImportFile(ui.importInput.files?.[0]));
    ui.importClose.addEventListener('click',()=>ui.importModal.classList.add('hidden'));ui.importCancel.addEventListener('click',()=>ui.importModal.classList.add('hidden'));ui.importConfirm.addEventListener('click',confirmImport);
    ui.importModal.addEventListener('click',e=>{if(e.target===ui.importModal)ui.importModal.classList.add('hidden')});
    ui.addSector.addEventListener('click',addSector);ui.sectorName.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addSector()}});ui.sectorOrg.addEventListener('change',renderSectors);

    ui.view.addEventListener('click',e=>{
      const edit=e.target.closest('[data-pca-edit]');if(edit){const item=state.items.find(i=>i.id===edit.dataset.pcaEdit);if(item)openModal(item);return;}
      const del=e.target.closest('[data-pca-delete]');if(del){deleteItem(del.dataset.pcaDelete);return;}
      const dup=e.target.closest('[data-pca-duplicate]');if(dup){duplicateItem(dup.dataset.pcaDuplicate);return;}
      const orgBtn=e.target.closest('[data-pca-open-org]');if(orgBtn){ui.org.value=orgBtn.dataset.pcaOpenOrg;populateSectorFilter();setTab('items');render();return;}
      const secDel=e.target.closest('[data-pca-sector-delete]');if(secDel&&!secDel.disabled){removeSector(secDel.dataset.pcaSectorDelete);return;}
      const emptyNew=e.target.closest('[data-pca-empty-new]');if(emptyNew)openModal();
    });

    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!ui.modal.classList.contains('hidden'))closeModal();if(!ui.importModal.classList.contains('hidden'))ui.importModal.classList.add('hidden')}});

    render();setTab(activeTab);
  }

  return { bind, render, exportCSV, getState:()=>state };
}
