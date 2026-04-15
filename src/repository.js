const { createClient } = require('@supabase/supabase-js');

function createRepository(config) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return null;
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  function enrichTableError(error) {
    if (!error) return error;
    const message = String(error.message || error.details || error.hint || '');
    if (message.includes("Could not find the table 'public.athlete_results'")) {
      error.message = "Falta la tabla public.athlete_results en Supabase. Ejecuta el archivo supabase/schema.sql en SQL Editor y vuelve a desplegar o sincronizar.";
    }
    return error;
  }

  return {
    async health() {
      const { error } = await supabase.from('athlete_results').select('id', { count: 'exact', head: true });
      if (error) throw enrichTableError(error);
      return true;
    },

    async replaceAll(rows, sourceFileName) {
      const { error: deleteError } = await supabase
        .from('athlete_results')
        .delete()
        .not('id', 'is', null);
      if (deleteError) throw enrichTableError(deleteError);

      if (!rows.length) {
        return { inserted: 0 };
      }

      const payload = rows.map((row) => ({ ...row, source_file_name: sourceFileName }));
      const { error: insertError } = await supabase.from('athlete_results').insert(payload);
      if (insertError) throw enrichTableError(insertError);

      return { inserted: payload.length };
    },

    async listResults(filters) {
      let query = supabase
        .from('athlete_results')
        .select('*')
        .order('event_name', { ascending: true })
        .order('mark_seconds', { ascending: true, nullsFirst: false })
        .order('athlete_name', { ascending: true });

      if (filters.category) query = query.eq('category', filters.category);
      if (filters.club) query = query.ilike('club_name', filters.club.includes('%') ? filters.club : `%${filters.club}%`);
      if (filters.event) query = query.eq('event_name', filters.event);
      if (filters.athlete) query = query.eq('athlete_name', filters.athlete);

      const { data, error } = await query.limit(5000);
      if (error) throw enrichTableError(error);
      return data || [];
    },

    async getRankings(filters) {
      let query = supabase
        .from('athlete_results')
        .select('*')
        .not('mark_seconds', 'is', null)
        .order('event_name', { ascending: true })
        .order('mark_seconds', { ascending: true })
        .order('athlete_name', { ascending: true });

      if (filters.category) query = query.eq('category', filters.category);
      if (filters.event) query = query.eq('event_name', filters.event);

      const { data, error } = await query.limit(10000);
      if (error) throw enrichTableError(error);

      const byEventAthlete = new Map();
      for (const row of data || []) {
        const key = `${row.event_name}__${row.athlete_name}`;
        const current = byEventAthlete.get(key);
        if (!current || (row.mark_seconds ?? Number.MAX_SAFE_INTEGER) < (current.mark_seconds ?? Number.MAX_SAFE_INTEGER)) {
          byEventAthlete.set(key, row);
        }
      }

      const grouped = new Map();
      for (const row of byEventAthlete.values()) {
        const key = row.event_name;
        const list = grouped.get(key) || [];
        list.push(row);
        grouped.set(key, list);
      }

      const rankings = [];
      for (const [eventName, rows] of grouped.entries()) {
        rows.sort((a, b) => (a.mark_seconds ?? Number.MAX_SAFE_INTEGER) - (b.mark_seconds ?? Number.MAX_SAFE_INTEGER));
        rows.forEach((row, index) => {
          rankings.push({ ...row, ranking_position: index + 1, ranking_event_name: eventName });
        });
      }

      rankings.sort((a, b) => {
        const eventCompare = String(a.ranking_event_name).localeCompare(String(b.ranking_event_name), 'es');
        if (eventCompare !== 0) return eventCompare;
        return a.ranking_position - b.ranking_position;
      });

      return rankings;
    },

    async getFilterOptions() {
      const { data, error } = await supabase
        .from('athlete_results')
        .select('category, event_name, athlete_name, club_name')
        .limit(10000);

      if (error) throw enrichTableError(error);

      const rows = data || [];
      const uniq = (values) => [...new Set(values.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

      return {
        categories: uniq(rows.map((r) => r.category)),
        events: uniq(rows.map((r) => r.event_name)),
        athletes: uniq(rows.map((r) => r.athlete_name)),
        clubs: uniq(rows.map((r) => r.club_name)),
      };
    },
  };
}

module.exports = { createRepository };
