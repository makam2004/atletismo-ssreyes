const $ = id => document.getElementById(id);
const filters = ['category', 'event', 'club', 'athlete'];
let refreshTimer = null;
let resultsPage = 1;
let rankingPage = 1;
const pageSize = 100;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function hasAnyFilter() {
  return filters.some(f => $(f)?.value);
}

function qs(extra = {}) {
  const p = new URLSearchParams();
  filters.forEach(f => {
    const el = $(f);
    const v = el ? el.value : '';
    if (v) p.set(f, v);
  });
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  return p.toString();
}

function optionsQs() {
  const p = new URLSearchParams();
  ['category', 'event', 'club'].forEach(f => {
    const el = $(f);
    const v = el ? el.value : '';
    if (v) p.set(f, v);
  });
  return p.toString();
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

function fillSelect(id, values) {
  const el = $(id);
  const current = el.value;
  const label = id === 'category' ? 'Todas' : 'Todos';
  el.innerHTML = `<option value="">${label}</option>`;
  values.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    el.appendChild(o);
  });
  if (values.includes(current)) el.value = current;
}

function pagerHtml(kind, meta) {
  const page = meta.page || 1;
  const totalPages = meta.totalPages || 1;
  const total = meta.total || 0;
  const disabledPrev = page <= 1 ? 'disabled' : '';
  const disabledNext = page >= totalPages ? 'disabled' : '';
  return `
    <div class="pager">
      <button class="secondaryBtn" data-page-kind="${kind}" data-page-dir="prev" ${disabledPrev}>Anterior</button>
      <span>Página <b>${page}</b> de <b>${totalPages}</b> · ${total} registros</span>
      <button class="secondaryBtn" data-page-kind="${kind}" data-page-dir="next" ${disabledNext}>Siguiente</button>
    </div>`;
}

function bindPagerButtons(metaResults, metaRanking) {
  document.querySelectorAll('[data-page-kind]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.pageKind;
      const dir = btn.dataset.pageDir;
      if (kind === 'results') {
        const max = metaResults.totalPages || 1;
        resultsPage = Math.min(Math.max(resultsPage + (dir === 'next' ? 1 : -1), 1), max);
        loadResults().catch(showError);
      }
      if (kind === 'ranking') {
        const max = metaRanking.totalPages || 1;
        rankingPage = Math.min(Math.max(rankingPage + (dir === 'next' ? 1 : -1), 1), max);
        loadRanking().catch(showError);
      }
    });
  });
}

function showError(e) {
  $('statusText').innerHTML = `<span class="error">${escapeHtml(e.message)}</span>`;
}

async function loadStatus() {
  const data = await api('/api/status');
  const s = data.status;
  if (!s) {
    $('statusText').innerHTML = 'Todavía no hay sincronización registrada.';
    return;
  }
  $('statusText').innerHTML = s.last_error
    ? `<span class="error">Error: ${escapeHtml(s.last_error)}</span>`
    : `<span class="ok">OK</span> · Archivo: <b>${escapeHtml(s.source_file_name || '-')}</b> · Filas: <b>${s.imported_rows || 0}</b> · Última sync: ${escapeHtml(s.last_success_at || '-')}`;
}

async function loadOptions() {
  const query = optionsQs();
  const o = await api('/api/options' + (query ? `?${query}` : ''));
  fillSelect('category', o.categories || []);
  fillSelect('event', o.events || []);
  fillSelect('club', o.clubs || []);
  fillSelect('athlete', o.athletes || []);
}

async function loadResults() {
  const tb = document.querySelector('#resultsTable tbody');
  const pager = $('resultsPager');
  tb.innerHTML = '';
  pager.innerHTML = '';

  if (!hasAnyFilter()) {
    tb.innerHTML = '<tr><td colspan="6" class="muted">Selecciona una categoría, prueba, club o atleta para ver resultados.</td></tr>';
    return { page: 1, totalPages: 1, total: 0 };
  }

  const data = await api('/api/results?' + qs({ page: resultsPage, pageSize }));
  const rows = data.rows || [];
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="6" class="muted">No hay datos para estos filtros.</td></tr>';
    return data;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.event_group || r.event_name)}</td><td>${escapeHtml(r.surface || '')}</td><td>${escapeHtml(r.athlete_name)}</td><td>${escapeHtml(r.club_name)}</td><td>${escapeHtml(r.mark_raw)}</td>`;
    tb.appendChild(tr);
  });
  pager.innerHTML = pagerHtml('results', data);
  return data;
}

async function loadRanking() {
  const root = $('ranking');
  const pager = $('rankingPager');
  root.innerHTML = '';
  pager.innerHTML = '';

  if (!hasAnyFilter()) {
    root.innerHTML = '<p class="muted">Selecciona al menos una categoría, prueba, club o atleta para cargar la clasificación.</p>';
    return { page: 1, totalPages: 1, total: 0 };
  }

  root.innerHTML = '<p class="muted">Cargando clasificación...</p>';
  const data = await api('/api/ranking?' + qs({ page: rankingPage, pageSize }));
  const groups = data.groups || [];
  root.innerHTML = '';

  if (!groups.length) {
    root.innerHTML = '<p class="muted">No hay datos para estos filtros.</p>';
    return data;
  }

  groups.forEach(g => {
    const div = document.createElement('div');
    div.className = 'group';
    div.innerHTML = `<h3>${escapeHtml(g.group)}</h3><div class="tableWrap"><table><thead><tr><th>#</th><th>Atleta</th><th>Club</th><th>Marca</th><th>Superficie</th></tr></thead><tbody>${g.items.map(r => `<tr><td>${r.rank}</td><td>${escapeHtml(r.athlete_name)}</td><td>${escapeHtml(r.club_name)}</td><td>${escapeHtml(r.mark_raw)}</td><td>${escapeHtml(r.surface || '')}</td></tr>`).join('')}</tbody></table></div>`;
    root.appendChild(div);
  });
  pager.innerHTML = pagerHtml('ranking', data);
  return data;
}

async function refresh() {
  await loadStatus();
  await loadOptions();
  const [rankingMeta, resultsMeta] = await Promise.all([loadRanking(), loadResults()]);
  bindPagerButtons(resultsMeta || {}, rankingMeta || {});
}

async function refreshAfterFilterChange() {
  resultsPage = 1;
  rankingPage = 1;
  $('ranking').innerHTML = '<p class="muted">Actualizando...</p>';
  document.querySelector('#resultsTable tbody').innerHTML = '<tr><td colspan="6" class="muted">Actualizando...</td></tr>';
  await loadOptions();
  const [rankingMeta, resultsMeta] = await Promise.all([loadRanking(), loadResults()]);
  bindPagerButtons(resultsMeta || {}, rankingMeta || {});
}

function scheduleFilterRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshAfterFilterChange().catch(showError), 350);
}

filters.forEach(f => $(f).addEventListener('change', scheduleFilterRefresh));

$('syncBtn').addEventListener('click', async () => {
  $('syncBtn').disabled = true;
  $('syncBtn').textContent = 'Actualizando...';
  try {
    await api('/api/sync', { method: 'POST' });
    resultsPage = 1;
    rankingPage = 1;
    await refresh();
  } catch (e) {
    alert(e.message);
  } finally {
    $('syncBtn').disabled = false;
    $('syncBtn').textContent = 'Actualizar ahora';
  }
});

refresh().catch(showError);
