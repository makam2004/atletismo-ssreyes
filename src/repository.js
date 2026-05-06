const supabase = require('./supabase');

const PAGE_SIZE = 1000;
const RESULTS_LIMIT_DEFAULT = 300;
const OPTIONS_CACHE_MS = 60 * 1000;

let optionsRowsCache = {
  expiresAt: 0,
  rows: null
};

function cleanValue(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\s+/g, ' ');
  return text || null;
}

function sortEs(values) {
  return values.sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }));
}

function normalizeText(value) {
  return cleanValue(value)
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase() || '';
}

function getEventSurface(eventName) {
  const event = cleanValue(eventName) || '';
  const match = event.match(/(?:\s|\.)(AL|PC)$/i);
  return match ? match[1].toUpperCase() : null;
}

function getEventGroup(eventName) {
  const event = cleanValue(eventName) || '';
  if (!event) return null;
  return cleanValue(event.replace(/(?:\s|\.)(AL|PC)$/i, ''));
}

function getEventGender(eventName) {
  const event = normalizeText(getEventGroup(eventName) || eventName);
  if (event.includes('fem')) return 'F';
  if (event.includes('masc')) return 'M';
  return null;
}

function isFieldEvent(eventName) {
  const event = normalizeText(getEventGroup(eventName) || eventName);
  const fieldEventKeywords = [
    'altura',
    'longitud',
    'peso',
    'pelota',
    'jabalina',
    'disco',
    'martillo',
    'triple',
    'pertiga'
  ];
  return fieldEventKeywords.some(keyword => event.includes(keyword));
}

function compareMarks(a, b, eventName) {
  const aValue = a?.mark_value;
  const bValue = b?.mark_value;
  const aMissing = aValue === null || aValue === undefined;
  const bMissing = bValue === null || bValue === undefined;

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  return isFieldEvent(eventName) ? bValue - aValue : aValue - bValue;
}

function isBetterMark(candidate, current, eventName) {
  if (!current) return true;
  return compareMarks(candidate, current, eventName) < 0;
}

function getCategoryGender(category) {
  const value = cleanValue(category) || '';
  if (/F$/i.test(value)) return 'F';
  if (/M$/i.test(value)) return 'M';
  return null;
}

function eventMatchesCategoryGender(eventName, category) {
  const gender = getCategoryGender(category);
  if (!gender) return true;
  const eventGender = getEventGender(eventName);
  if (!eventGender) return true;
  return eventGender === gender;
}

function decorateRow(row) {
  return {
    ...row,
    event_group: cleanValue(row.event_group) || getEventGroup(row.event_name),
    surface: cleanValue(row.surface) || getEventSurface(row.event_name),
    event_gender: cleanValue(row.event_gender) || getEventGender(row.event_name)
  };
}

function applyFilters(query, filters = {}) {
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.club) query = query.eq('club_name', filters.club);
  if (filters.event) query = query.eq('event_group', filters.event);
  if (filters.athlete) query = query.eq('athlete_name', filters.athlete);
  return query;
}

async function fetchAllRows({ columns = '*', filters = {}, orderBy = null, maxPages = 200 } = {}) {
  let all = [];

  for (let page = 0; page < maxPages; page += 1) {
    let query = supabase
      .from('athlete_results')
      .select(columns)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    query = applyFilters(query, filters);

    if (orderBy) {
      for (const order of orderBy) {
        query = query.order(order.column, order.options || {});
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    all = all.concat(rows);

    if (rows.length < PAGE_SIZE) break;
  }

  return all;
}

function enrichRowsForStorage(rows) {
  return rows.map(row => ({
    ...row,
    event_group: cleanValue(row.event_group) || getEventGroup(row.event_name),
    surface: cleanValue(row.surface) || getEventSurface(row.event_name),
    event_gender: cleanValue(row.event_gender) || getEventGender(row.event_name)
  }));
}

function clearOptionsCache() {
  optionsRowsCache = { expiresAt: 0, rows: null };
}

async function replaceSourceRows(sourceFileId, rows) {
  const { error: delError } = await supabase
    .from('athlete_results')
    .delete()
    .eq('source_file_id', sourceFileId);
  if (delError) throw delError;

  const enrichedRows = enrichRowsForStorage(rows);

  if (!enrichedRows.length) {
    clearOptionsCache();
    return { inserted: 0 };
  }

  const chunkSize = 500;
  let inserted = 0;

  for (let i = 0; i < enrichedRows.length; i += chunkSize) {
    const chunk = enrichedRows.slice(i, i + chunkSize);
    const { error } = await supabase.from('athlete_results').insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }

  clearOptionsCache();
  return { inserted };
}

async function getCachedOptionRows() {
  const now = Date.now();
  if (optionsRowsCache.rows && optionsRowsCache.expiresAt > now) {
    return optionsRowsCache.rows;
  }

  const rows = await fetchAllRows({
    columns: 'category,club_name,event_group,event_name,event_gender,athlete_name',
    orderBy: [{ column: 'category', options: { ascending: true } }],
    maxPages: 300
  });

  const decorated = rows.map(decorateRow);
  optionsRowsCache = {
    rows: decorated,
    expiresAt: now + OPTIONS_CACHE_MS
  };
  return decorated;
}

async function getOptions(filters = {}) {
  const rows = await getCachedOptionRows();

  const uniqueFromRows = (sourceRows, field) => sortEs([
    ...new Set(
      sourceRows
        .map(row => cleanValue(row[field]))
        .filter(Boolean)
    )
  ]);

  const categories = uniqueFromRows(rows, 'category');

  let eventRows = rows;
  if (filters.category) {
    eventRows = eventRows.filter(row => cleanValue(row.category) === cleanValue(filters.category));
    const gender = getCategoryGender(filters.category);
    if (gender) eventRows = eventRows.filter(row => !row.event_gender || row.event_gender === gender);
  }

  const events = sortEs([
    ...new Set(
      eventRows
        .map(row => cleanValue(row.event_group) || getEventGroup(row.event_name))
        .filter(Boolean)
    )
  ]);

  let optionRows = rows;
  if (filters.category) optionRows = optionRows.filter(row => cleanValue(row.category) === cleanValue(filters.category));
  if (filters.event) optionRows = optionRows.filter(row => (cleanValue(row.event_group) || getEventGroup(row.event_name)) === cleanValue(filters.event));
  if (filters.club) optionRows = optionRows.filter(row => cleanValue(row.club_name) === cleanValue(filters.club));

  return {
    categories,
    clubs: uniqueFromRows(optionRows, 'club_name'),
    events,
    athletes: uniqueFromRows(optionRows, 'athlete_name')
  };
}

async function getResults(filters = {}) {
  const limit = Number(filters.limit || RESULTS_LIMIT_DEFAULT);

  let query = supabase
    .from('athlete_results')
    .select('*')
    .limit(Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : RESULTS_LIMIT_DEFAULT);

  query = applyFilters(query, filters);
  query = query
    .order('event_group', { ascending: true })
    .order('mark_value', { ascending: true, nullsFirst: false });

  const { data, error } = await query;
  if (error) throw error;

  return (data || [])
    .map(decorateRow)
    .sort((a, b) => {
      const byEvent = String(a.event_group || '').localeCompare(String(b.event_group || ''), 'es', { numeric: true, sensitivity: 'base' });
      if (byEvent !== 0) return byEvent;
      const byMark = compareMarks(a, b, a.event_group || a.event_name || b.event_group || b.event_name);
      if (byMark !== 0) return byMark;
      return String(a.athlete_name || '').localeCompare(String(b.athlete_name || ''), 'es');
    });
}

async function getRanking(filters = {}) {
  // Evita traer toda la base en la pantalla inicial. Primero se debe acotar por categoría o prueba.
  if (!filters.category && !filters.event && !filters.club && !filters.athlete) {
    return [];
  }

  const rows = (await fetchAllRows({
    columns: '*',
    filters,
    orderBy: [
      { column: 'event_group', options: { ascending: true } },
      { column: 'mark_value', options: { ascending: true, nullsFirst: false } }
    ],
    maxPages: 300
  })).map(decorateRow);

  const best = new Map();

  for (const row of rows) {
    const category = cleanValue(row.category) || '';
    const eventGroup = cleanValue(row.event_group) || '';
    const athleteName = cleanValue(row.athlete_name) || '';
    const clubName = cleanValue(row.club_name) || '';
    const key = `${category}|${eventGroup}|${athleteName}|${clubName}`;
    const current = best.get(key);

    if (isBetterMark(row, current, eventGroup || row.event_name)) {
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
          const byMark = compareMarks(a, b, a.event_group || a.event_name || b.event_group || b.event_name);
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
  getEventSurface,
  isFieldEvent,
  eventMatchesCategoryGender
};
