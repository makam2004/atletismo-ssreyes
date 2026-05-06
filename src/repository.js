const supabase = require('./supabase');

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
  const { data, error } = await supabase
    .from('athlete_results')
    .select('category,club_name,event_name,athlete_name')
    .order('event_name', { ascending: true });
  if (error) throw error;
  const unique = field => [...new Set((data || []).map(r => r[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  return {
    categories: unique('category'),
    clubs: unique('club_name'),
    events: unique('event_name'),
    athletes: unique('athlete_name')
  };
}

async function getResults(filters) {
  let q = supabase.from('athlete_results').select('*').order('event_name').order('mark_value', { ascending: true, nullsFirst: false });
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.club) q = q.ilike('club_name', `%${filters.club}%`);
  if (filters.event) q = q.eq('event_name', filters.event);
  if (filters.athlete) q = q.ilike('athlete_name', `%${filters.athlete}%`);
  const { data, error } = await q.limit(2000);
  if (error) throw error;
  return data || [];
}

async function getRanking(filters) {
  const rows = await getResults(filters);
  const best = new Map();
  for (const r of rows) {
    const key = `${r.category}|${r.event_name}|${r.athlete_name}|${r.club_name}`;
    const current = best.get(key);
    const better = !current || ((r.mark_value ?? Infinity) < (current.mark_value ?? Infinity));
    if (better) best.set(key, r);
  }
  const grouped = {};
  for (const r of best.values()) {
    const key = `${r.category} - ${r.event_name}`;
    grouped[key] ||= [];
    grouped[key].push(r);
  }
  return Object.entries(grouped).map(([group, items]) => ({
    group,
    items: items.sort((a,b)=>(a.mark_value ?? Infinity)-(b.mark_value ?? Infinity)).map((r,i)=>({ ...r, rank: i+1 }))
  })).sort((a,b)=>a.group.localeCompare(b.group,'es'));
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
  const { error } = await supabase.from('sync_status').upsert({ id: 1, ...status, updated_at: new Date().toISOString() });
  if (error) throw error;
}

module.exports = { replaceSourceRows, getOptions, getResults, getRanking, getSyncStatus, saveSyncStatus };
