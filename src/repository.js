const { createClient } = require('@supabase/supabase-js');

function createRepository(config) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return null;
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async health() {
      const { error } = await supabase.from('athlete_results').select('id', { count: 'exact', head: true });
      if (error) throw error;
      return true;
    },

    async replaceImport(rows, sourceFileName) {
      const { error: deleteError } = await supabase
        .from('athlete_results')
        .delete()
        .eq('source_file_name', sourceFileName);
      if (deleteError) throw deleteError;

      if (!rows.length) {
        return { inserted: 0 };
      }

      const { error: insertError } = await supabase.from('athlete_results').insert(rows);
      if (insertError) throw insertError;

      return { inserted: rows.length };
    },

    async listResults(filters) {
      let query = supabase
        .from('athlete_results')
        .select('*')
        .order('event_name', { ascending: true })
        .order('mark_seconds', { ascending: true, nullsFirst: false })
        .order('athlete_name', { ascending: true });

      if (filters.category) query = query.eq('category', filters.category);
      if (filters.club) query = query.ilike('club_name', filters.club);
      if (filters.event) query = query.ilike('event_name', `%${filters.event}%`);
      if (filters.athlete) query = query.ilike('athlete_name', `%${filters.athlete}%`);

      const { data, error } = await query.limit(5000);
      if (error) throw error;
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
      if (filters.event) query = query.ilike('event_name', `%${filters.event}%`);

      const { data, error } = await query.limit(10000);
      if (error) throw error;

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
        const eventCompare = String(a.ranking_event_name).localeCompare(String(b.ranking_event_name));
        if (eventCompare !== 0) return eventCompare;
        return a.ranking_position - b.ranking_position;
      });

      return rankings;
    },
  };
}

module.exports = { createRepository };
