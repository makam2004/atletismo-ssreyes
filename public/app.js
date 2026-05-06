const $ = id => document.getElementById(id);
const filters = ['category', 'event', 'club', 'athlete'];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function qs() {
  const p = new URLSearchParams();
  filters.forEach(f => {
    const el = $(f);
    const v = el ? el.value : '';
    if (v) p.set(f, v);
  });
  return p.toString();
}

function optionsQs() {
  // Para cargar desplegables dependientes, especialmente pruebas según categoría.
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
  const rows = await api('/api/results?' + qs());
  const tb = document.querySelector('#resultsTable tbody');
  tb.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.event_group || r.event_name)}</td><td>${escapeHtml(r.surface || '')}</td><td>${escapeHtml(r.athlete_name)}</td><td>${escapeHtml(r.club_name)}</td><td>${escapeHtml(r.mark_raw)}</td>`;
    tb.appendChild(tr);
  });
}

async function loadRanking() {
  const groups = await api('/api/ranking?' + qs());
  const root = $('ranking');
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
  await loadRanking();
  await loadResults();
}

async function refreshAfterFilterChange(changedFilter) {
  // Si cambia la categoría, puede cambiar la lista de pruebas FEM/MASC.
  // Si la prueba ya no existe para esa categoría, fillSelect la deja en "Todos".
  await loadOptions();
  await loadRanking();
  await loadResults();
}

filters.forEach(f => $(f).addEventListener('change', () => {
  refreshAfterFilterChange(f).catch(e => {
    $('statusText').innerHTML = `<span class="error">${escapeHtml(e.message)}</span>`;
  });
}));

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
