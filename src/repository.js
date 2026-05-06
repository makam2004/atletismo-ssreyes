const supabase = require('./supabase');

const PAGE_SIZE = 1000;

function cleanValue(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\s+/g, ' ');
  return text || null;
}

function sortEs(values) {
  return values.sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }));
}

async function fetchAllRows({ columns = '*', filters = {}, orderBy = null, maxPages = 200 } = {}) {
  let all = [];

  for (let page = 0; page < maxPages; page += 1) {
    let query = supabase
      .from('athlete_results')
      .select(columns)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (orderBy) {
      for (const order of orderBy) {
        query = query.order(order.column, order.options || {});
      }
    }

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.club) query = query.eq('club_name', filters.club);
    if (filters.event) query = query.eq('event_name', filters.event);
    if (filters.athlete) query = query.eq('athlete_name', filters.athlete);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    all = all.concat(rows);

    if (rows.length < PAGE_SIZE) break;
  }

  return all;
}

async function replaceSourceRows(sourceFileId, rows) {
  const { error: delError } = await supabase
    .from('athlete_results')
    .delete()
    .eq('source_file_id', sourceFileId);
  if (delError) throw delError;

  if (!rows.length) return { inserted: 0 };
  const chunkSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('athlete_results').insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }

  return { inserted };
}

async function getOptions() {
  // Importante: Supabase/PostgREST devuelve por defecto solo una página de resultados.
  // Si hay más de 1000 filas, algunas pruebas podían no aparecer en los desplegables.
  // Por eso aquí paginamos todas las filas y construimos los valores únicos en servidor.
  const rows = await fetchAllRows({
    columns: 'category,club_name,event_name,athlete_name',
    orderBy: [{ column: 'event_name', options: { ascending: true } }]
  });

  const unique = field => sortEs([
    ...new Set(
      rows
        .map(row => cleanValue(row[field]))
        .filter(Boolean)
    )
  ]);

  return {
    categories: unique('category'),
    clubs: unique('club_name'),
    events: unique('event_name'),
    athletes: unique('athlete_name')
  };
}

async function getResults(filters = {}) {
  const rows = await fetchAllRows({
    columns: '*',
    filters,
    orderBy: [
      { column: 'event_name', options: { ascending: true } },
      { column: 'mark_value', options: { ascending: true, nullsFirst: false } }
    ]
  });

  return rows;
}

async function getRanking(filters = {}) {
  const rows = await getResults(filters);
  const best = new Map();

  for (const row of rows) {
    const category = cleanValue(row.category) || '';
    const eventName = cleanValue(row.event_name) || '';
    const athleteName = cleanValue(row.athlete_name) || '';
    const clubName = cleanValue(row.club_name) || '';
    const key = `${category}|${eventName}|${athleteName}|${clubName}`;
    const current = best.get(key);
    const rowValue = row.mark_value ?? Infinity;
    const currentValue = current?.mark_value ?? Infinity;

    if (!current || rowValue < currentValue) {
      best.set(key, row);
    }
  }

  const grouped = {};
  for (const row of best.values()) {
    const key = `${row.category || 'Sin categoría'} - ${row.event_name || 'Sin prueba'}`;
    grouped[key] ||= [];
    grouped[key].push(row);
  }

  return Object.entries(grouped)
    .map(([group, items]) => ({
      group,
      items: items
        .sort((a, b) => {
          const byMark = (a.mark_value ?? Infinity) - (b.mark_value ?? Infinity);
          if (byMark !== 0) return byMark;
          return String(a.athlete_name || '').localeCompare(String(b.athlete_name || ''), 'es');
        })
        .map((row, index) => ({ ...row, rank: index + 1 }))
    }))
    .sort((a, b) => a.group.localeCompare(b.group, 'es', { numeric: true, sensitivity: 'base' }));
}

async function getSyncStatus() {
  const { data, error } = await supabase
    .from('sync_status')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveSyncStatus(status) {
  const { error } = await supabase
    .from('sync_status')
    .upsert({ id: 1, ...status, updated_at: new Date().toISOString() });
  if (error) throw error;
}

module.exports = {
  replaceSourceRows,
  getOptions,
  getResults,
  getRanking,
  getSyncStatus,
  saveSyncStatus
};
