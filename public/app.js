const $ = id => document.getElementById(id);
const filters = ['category','event','club','athlete'];

function qs(){
  const p = new URLSearchParams();
  filters.forEach(f=>{ const v=$(f).value; if(v) p.set(f,v); });
  return p.toString();
}
async function api(path, opts){
  const res = await fetch(path, opts);
  if(!res.ok) throw new Error((await res.json()).error || 'Error');
  return res.json();
}
function fillSelect(id, values){
  const el=$(id); const current=el.value; el.innerHTML='<option value="">Todos</option>';
  if(id==='category') el.innerHTML='<option value="">Todas</option>';
  values.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o); });
  if(values.includes(current)) el.value=current;
}
async function loadStatus(){
  const data = await api('/api/status');
  const s=data.status;
  if(!s){ $('statusText').innerHTML='Todavía no hay sincronización registrada.'; return; }
  $('statusText').innerHTML = s.last_error
    ? `<span class="error">Error: ${s.last_error}</span>`
    : `<span class="ok">OK</span> · Archivo: <b>${s.source_file_name || '-'}</b> · Filas: <b>${s.imported_rows || 0}</b> · Última sync: ${s.last_success_at || '-'}`;
}
async function loadOptions(){
  const o = await api('/api/options');
  fillSelect('category', o.categories || []); fillSelect('event', o.events || []); fillSelect('club', o.clubs || []); fillSelect('athlete', o.athletes || []);
}
async function loadResults(){
  const rows = await api('/api/results?' + qs());
  const tb = document.querySelector('#resultsTable tbody'); tb.innerHTML='';
  rows.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.category||''}</td><td>${r.event_name||''}</td><td>${r.athlete_name||''}</td><td>${r.club_name||''}</td><td>${r.mark_raw||''}</td>`; tb.appendChild(tr); });
}
async function loadRanking(){
  const groups = await api('/api/ranking?' + qs());
  const root=$('ranking'); root.innerHTML='';
  if(!groups.length){ root.innerHTML='<p class="muted">No hay datos para estos filtros.</p>'; return; }
  groups.forEach(g=>{
    const div=document.createElement('div'); div.className='group';
    div.innerHTML=`<h3>${g.group}</h3><div class="tableWrap"><table><thead><tr><th>#</th><th>Atleta</th><th>Club</th><th>Marca</th></tr></thead><tbody>${g.items.map(r=>`<tr><td>${r.rank}</td><td>${r.athlete_name||''}</td><td>${r.club_name||''}</td><td>${r.mark_raw||''}</td></tr>`).join('')}</tbody></table></div>`;
    root.appendChild(div);
  });
}
async function refresh(){ await loadStatus(); await loadOptions(); await loadRanking(); await loadResults(); }
filters.forEach(f=>$(f).addEventListener('change',()=>{ loadRanking(); loadResults(); }));
$('syncBtn').addEventListener('click', async()=>{ $('syncBtn').disabled=true; $('syncBtn').textContent='Actualizando...'; try{ await api('/api/sync',{method:'POST'}); await refresh(); }catch(e){ alert(e.message); } finally{ $('syncBtn').disabled=false; $('syncBtn').textContent='Actualizar ahora'; }});
refresh().catch(e=>{ $('statusText').innerHTML=`<span class="error">${e.message}</span>`; });
