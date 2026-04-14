import { supabase } from './supabase.js';

const TABLE = 'athlete_marks';

export async function replaceImportedFile(fileId, rows) {
  const { error: deleteError } = await supabase.from(TABLE).delete().eq('source_file_id', fileId);
  if (deleteError) throw deleteError;

  if (!rows.length) {
    return { inserted: 0 };
  }

  const { error: insertError } = await supabase.from(TABLE).insert(rows);
  if (insertError) throw insertError;

  return { inserted: rows.length };
}

function escapeLike(value) {
  return String(value).replace(/[%_]/g, (match) => `\\${match}`);
}

function buildBaseQuery(filters = {}) {
  let query = supabase.from(TABLE).select('*');

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.club_name) query = query.ilike('club_name', filters.club_name);
  if (filters.athlete_name) query = query.ilike('athlete_name', `%${escapeLike(filters.athlete_name)}%`);
  if (filters.event_name) query = query.ilike('event_name', `%${escapeLike(filters.event_name)}%`);

  return query;
}

export async function getAthleteMarks(filters = {}) {
  const { data, error } = await buildBaseQuery(filters)
    .order('athlete_name', { ascending: true })
    .order('mark_value_seconds', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data;
}

export async function getBestMarksRanking(filters = {}) {
  const { data, error } = await buildBaseQuery(filters)
    .not('mark_value_seconds', 'is', null)
    .order('event_name', { ascending: true })
    .order('mark_value_seconds', { ascending: true })
    .order('athlete_name', { ascending: true });

  if (error) throw error;

  const bestByAthleteAndEvent = new Map();

  for (const row of data) {
    const key = `${row.event_name || ''}__${row.athlete_name || ''}`;
    const current = bestByAthleteAndEvent.get(key);
    if (!current || (row.mark_value_seconds ?? Infinity) < (current.mark_value_seconds ?? Infinity)) {
      bestByAthleteAndEvent.set(key, row);
    }
  }

  const ranking = Array.from(bestByAthleteAndEvent.values())
    .sort((a, b) => {
      const byEvent = String(a.event_name || '').localeCompare(String(b.event_name || ''));
      if (byEvent !== 0) return byEvent;
      const byMark = (a.mark_value_seconds ?? Infinity) - (b.mark_value_seconds ?? Infinity);
      if (byMark !== 0) return byMark;
      return String(a.athlete_name || '').localeCompare(String(b.athlete_name || ''));
    });

  let currentEvent = null;
  let currentRank = 0;
  let previousMark = null;
  let eventCounter = 0;

  const ranked = ranking.map((row) => {
    if (row.event_name !== currentEvent) {
      currentEvent = row.event_name;
      currentRank = 0;
      previousMark = null;
      eventCounter = 0;
    }

    eventCounter += 1;
    if (previousMark === null || row.mark_value_seconds !== previousMark) {
      currentRank = eventCounter;
      previousMark = row.mark_value_seconds;
    }

    return {
      ...row,
      ranking_position: currentRank
    };
  });

  const limit = Number(filters.limit || 0);
  if (limit > 0) {
    const counts = new Map();
    return ranked.filter((row) => {
      const key = row.event_name || '';
      const count = counts.get(key) || 0;
      if (count >= limit) return false;
      counts.set(key, count + 1);
      return true;
    });
  }

  return ranked;
}

export async function getDistinctFilterValues() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('category, club_name, event_name')
    .order('category', { ascending: true });

  if (error) throw error;

  return {
    categories: [...new Set(data.map((row) => row.category).filter(Boolean))],
    clubs: [...new Set(data.map((row) => row.club_name).filter(Boolean))],
    events: [...new Set(data.map((row) => row.event_name).filter(Boolean))]
  };
}
