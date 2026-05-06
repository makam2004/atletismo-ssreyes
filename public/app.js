const $ = id => document.getElementById(id);
const filters = ['category', 'event', 'club', 'athlete'];
let refreshTimer = null;

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
  if (!res.ok) throw new Error((await res.json()).error || 'Error');
  return res.json();
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

  if (values.includes(current)) {
    el.value = current;
  }
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
  tb.innerHTML = '';

  if (!hasAnyFilter()) {
    tb.innerHTML = '<tr><td colspan="6" class="muted">Selecciona una categoría, prueba, club o atleta para ver resultados.</td></tr>';
    return;
  }

  const rows = await api('/api/results?' + qs({ limit: 500 }));
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="6" class="muted">No hay datos para estos filtros.</td></tr>';
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.event_group || r.event_name)}</td><td>${escapeHtml(r.surface || '')}</td><td>${escapeHtml(r.athlete_name)}</td><td>${escapeHtml(r.club_name)}</td><td>${escapeHtml(r.mark_raw)}</td>`;
    tb.appendChild(tr);
  });

  if (rows.length >= 500) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="6" class="muted">Mostrando los primeros 500 resultados. Añade más filtros para acotar.</td>';
    tb.appendChild(tr);
  }
}

async function loadRanking() {
  const root = $('ranking');
  root.innerHTML = '';

  if (!hasAnyFilter()) {
    root.innerHTML = '<p class="muted">Selecciona al menos una categoría, prueba, club o atleta para cargar la clasificación.</p>';
    return;
  }

  root.innerHTML = '<p class="muted">Cargando clasificación...</p>';
  const groups = await api('/api/ranking?' + qs());
  root.innerHTML = '';

  if (!groups.length) {
    root.innerHTML = '<p class="muted">No hay datos para estos filtros.</p>';
    return;
  }
  groups.forEach(g => {
    const div = document.createElement('div');
    div.className = 'group';
    div.innerHTML = `<h3>${escapeHtml(g.group)}</h3><div class="tableWrap"><table><thead><tr><th>#</th><th>Atleta</th><th>Club</th><th>Marca</th><th>Superficie</th></tr></thead><tbody>${g.items.map(r => `<tr><td>${r.rank}</td><td>${escapeHtml(r.athlete_name)}</td><td>${escapeHtml(r.club_name)}</td><td>${escapeHtml(r.mark_raw)}</td><td>${escapeHtml(r.surface || '')}</td></tr>`).join('')}</tbody></table></div>`;
    root.appendChild(div);
  });
}

async function refresh() {
  await loadStatus();
  await loadOptions();
  await Promise.all([loadRanking(), loadResults()]);
}

async function refreshAfterFilterChange() {
  $('ranking').innerHTML = '<p class="muted">Actualizando...</p>';
  document.querySelector('#resultsTable tbody').innerHTML = '<tr><td colspan="6" class="muted">Actualizando...</td></tr>';
  await loadOptions();
  await Promise.all([loadRanking(), loadResults()]);
}

function scheduleFilterRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshAfterFilterChange().catch(e => {
      $('statusText').innerHTML = `<span class="error">${escapeHtml(e.message)}</span>`;
    });
  }, 250);
}

filters.forEach(f => $(f).addEventListener('change', scheduleFilterRefresh));

$('syncBtn').addEventListener('click', async () => {
  $('syncBtn').disabled = true;
  $('syncBtn').textContent = 'Actualizando...';
  try {
    await api('/api/sync', { method: 'POST' });
    await refresh();
  } catch (e) {
    alert(e.message);
  } finally {
    $('syncBtn').disabled = false;
    $('syncBtn').textContent = 'Actualizar ahora';
  }
});

refresh().catch(e => {
  $('statusText').innerHTML = `<span class="error">${escapeHtml(e.message)}</span>`;
});
