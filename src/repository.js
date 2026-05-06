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

function getEventSurface(eventName) {
  const event = cleanValue(eventName) || '';
  const match = event.match(/(?:\s|\.)(AL|PC)$/i);
  return match ? match[1].toUpperCase() : null;
}

function getEventGroup(eventName) {
  const event = cleanValue(eventName) || '';
  if (!event) return null;

  // Agrupa pruebas que terminan en AL o PC.
  // Ejemplos:
  // 60m FEM. AL  -> 60m FEM.
  // 60m FEM. PC  -> 60m FEM.
  // Altura MASC. AL -> Altura MASC.
  return cleanValue(event.replace(/(?:\s|\.)(AL|PC)$/i, ''));
}

function decorateRow(row) {
  return {
    ...row,
    event_group: getEventGroup(row.event_name),
    surface: getEventSurface(row.event_name)
  };
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
    // El filtro de prueba se aplica después en memoria porque ahora el desplegable usa prueba agrupada.
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

  const events = sortEs([
    ...new Set(
      rows
        .map(row => getEventGroup(row.event_name))
        .filter(Boolean)
    )
  ]);

  return {
    categories: unique('category'),
    clubs: unique('club_name'),
    events,
    athletes: unique('athlete_name')
  };
}

async function getResults(filters = {}) {
  let rows = await fetchAllRows({
    columns: '*',
    filters,
    orderBy: [
      { column: 'event_name', options: { ascending: true } },
      { column: 'mark_value', options: { ascending: true, nullsFirst: false } }
    ]
  });

  rows = rows.map(decorateRow);

  if (filters.event) {
    rows = rows.filter(row => row.event_group === filters.event);
  }

  return rows.sort((a, b) => {
    const byEvent = String(a.event_group || '').localeCompare(String(b.event_group || ''), 'es', { numeric: true, sensitivity: 'base' });
    if (byEvent !== 0) return byEvent;
    const byMark = (a.mark_value ?? Infinity) - (b.mark_value ?? Infinity);
    if (byMark !== 0) return byMark;
    return String(a.athlete_name || '').localeCompare(String(b.athlete_name || ''), 'es');
  });
}

async function getRanking(filters = {}) {
  const rows = await getResults(filters);
  const best = new Map();

  for (const row of rows) {
    const category = cleanValue(row.category) || '';
    const eventGroup = cleanValue(row.event_group) || '';
    const athleteName = cleanValue(row.athlete_name) || '';
    const clubName = cleanValue(row.club_name) || '';
    const key = `${category}|${eventGroup}|${athleteName}|${clubName}`;
    const current = best.get(key);
    const rowValue = row.mark_value ?? Infinity;
    const currentValue = current?.mark_value ?? Infinity;

    if (!current || rowValue < currentValue) {
      best.set(key, row);
    }
  }

  const grouped = {};
  for (const row of best.values()) {
    const key = `${row.category || 'Sin categoría'} - ${row.event_group || 'Sin prueba'}`;
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
  saveSyncStatus,
  getEventGroup,
  getEventSurface
};
