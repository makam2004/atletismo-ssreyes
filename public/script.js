const clubNameEl = document.getElementById('club-name');
const categoriesEl = document.getElementById('categories');
const filesStatusEl = document.getElementById('files-status');
const filesListEl = document.getElementById('files-list');
const clubFilterEl = document.getElementById('club-filter');
const categoryFilterEl = document.getElementById('category-filter');
const eventFilterEl = document.getElementById('event-filter');
const athleteFilterEl = document.getElementById('athlete-filter');
const resultsBodyEl = document.getElementById('results-body');
const resultsCountEl = document.getElementById('results-count');
const rankingBodyEl = document.getElementById('ranking-body');
const rankingCountEl = document.getElementById('ranking-count');

let appConfig = null;

async function getJson(url, options) {
  const response = await fetch(url, options);
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Request failed');
  return json;
}

function setStatus(text, kind = 'muted') {
  filesStatusEl.textContent = text;
  filesStatusEl.className = `status ${kind}`;
}

function renderFiles(files) {
  filesListEl.innerHTML = '';
  if (!files.length) {
    filesListEl.innerHTML = '<p class="muted">No se han encontrado ficheros compatibles en la carpeta.</p>';
    return;
  }

  files.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-meta">
        <span class="file-name">${file.name}</span>
        <span class="muted">Modificado: ${new Date(file.modifiedTime).toLocaleString('es-ES')}</span>
      </div>
      <button data-file-id="${file.id}">Importar este archivo</button>
    `;

    item.querySelector('button').addEventListener('click', async () => {
      try {
        setStatus(`Importando ${file.name}...`);
        const result = await getJson(`/api/import/file/${file.id}`, { method: 'POST' });
        setStatus(`Importados ${result.importedRows} registros desde ${result.importedFile.name}`, 'success');
        await refreshFilters();
        await loadResults();
        await loadRankings();
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });

    filesListEl.appendChild(item);
  });
}

function fillSelect(select, values, extraOptions = []) {
  const current = select.value;
  select.innerHTML = '';

  extraOptions.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  const validValues = new Set([...extraOptions.map((item) => item.value), ...values]);
  select.value = validValues.has(current) ? current : extraOptions[0]?.value || '';
}

function renderResults(rows) {
  resultsBodyEl.innerHTML = '';
  resultsCountEl.textContent = `${rows.length} resultados`;

  if (!rows.length) {
    resultsBodyEl.innerHTML = '<tr><td colspan="7" class="muted">No hay datos importados o el filtro no devuelve resultados.</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.athlete_name}</td>
      <td>${row.category || ''}</td>
      <td>${row.club_name || ''}</td>
      <td>${row.event_name || ''}</td>
      <td>${row.mark_raw || ''}</td>
      <td>${row.position || ''}</td>
      <td>${row.source_file_name || ''}</td>
    `;
    resultsBodyEl.appendChild(tr);
  });
}

function renderRankings(rows) {
  rankingBodyEl.innerHTML = '';
  rankingCountEl.textContent = `${rows.length} marcas`;

  if (!rows.length) {
    rankingBodyEl.innerHTML = '<tr><td colspan="7" class="muted">No hay ranking disponible todavía.</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.ranking_position || ''}</td>
      <td>${row.event_name || ''}</td>
      <td>${row.athlete_name || ''}</td>
      <td>${row.category || ''}</td>
      <td>${row.club_name || ''}</td>
      <td>${row.mark_raw || ''}</td>
      <td>${row.source_file_name || ''}</td>
    `;
    rankingBodyEl.appendChild(tr);
  });
}

async function loadConfig() {
  appConfig = await getJson('/api/config');
  clubNameEl.textContent = appConfig.clubNameFilter;
  categoriesEl.textContent = appConfig.categoryFilters.join(', ');
}

async function loadFiles() {
  const data = await getJson('/api/files');
  renderFiles(data.files);
  setStatus(`${data.files.length} archivo(s) detectado(s).`);
}

async function refreshFilters() {
  const filters = await getJson('/api/filters');
  fillSelect(clubFilterEl, filters.clubs || [], [
    { value: '', label: 'Club por defecto' },
    { value: '__ALL__', label: 'Todos los clubes' }
  ]);
  fillSelect(categoryFilterEl, filters.categories || [], [{ value: '', label: 'Todas' }]);
  fillSelect(eventFilterEl, filters.events || [], [{ value: '', label: 'Todas' }]);
}

async function loadResults() {
  const params = new URLSearchParams();
  const selectedClub = clubFilterEl.value || '';
  if (selectedClub) {
    params.set('club_name', selectedClub);
  }
  if (categoryFilterEl.value) params.set('category', categoryFilterEl.value);
  if (eventFilterEl.value) params.set('event_name', eventFilterEl.value);
  if (athleteFilterEl.value.trim()) params.set('athlete_name', athleteFilterEl.value.trim());

  const data = await getJson(`/api/athletes?${params.toString()}`);
  renderResults(data.data);
}

async function loadRankings() {
  const params = new URLSearchParams();
  if (categoryFilterEl.value) params.set('category', categoryFilterEl.value);
  if (eventFilterEl.value) params.set('event_name', eventFilterEl.value);
  if (athleteFilterEl.value.trim()) params.set('athlete_name', athleteFilterEl.value.trim());

  const data = await getJson(`/api/rankings?${params.toString()}`);
  renderRankings(data.data);
}

async function applyAllFilters() {
  await loadResults();
  await loadRankings();
}

document.getElementById('refresh-files-btn').addEventListener('click', async () => {
  try {
    setStatus('Actualizando archivos...');
    await loadFiles();
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

document.getElementById('import-latest-btn').addEventListener('click', async () => {
  try {
    setStatus('Importando último Excel...');
    const result = await getJson('/api/import/latest', { method: 'POST' });
    setStatus(`Importados ${result.importedRows} registros desde ${result.importedFile.name}`, 'success');
    await refreshFilters();
    await applyAllFilters();
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

document.getElementById('apply-filters-btn').addEventListener('click', applyAllFilters);
athleteFilterEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') applyAllFilters();
});

(async function init() {
  try {
    await loadConfig();
    await loadFiles();
    await refreshFilters();
    await applyAllFilters();
  } catch (error) {
    setStatus(error.message, 'error');
  }
})();
