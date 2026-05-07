# Atletismo Supabase + Google Drive

Aplicación para sincronizar automáticamente el Excel más reciente de una carpeta de Google Drive propia, volcar los datos en Supabase y consultar resultados/rankings desde una web en Render.

## Versión v9

Incluye mejoras de rendimiento:

- paginación real de resultados y rankings;
- tabla `ranking_results` con ranking precalculado durante cada sincronización;
- filtros más rápidos desde Supabase;
- pruebas agrupadas AL/PC;
- concursos ordenados de mayor a menor;
- carreras ordenadas de menor a mayor;
- categorías dinámicas y pruebas filtradas por género.

## Variables de entorno en Render

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DRIVE_FOLDER_ID=...
GOOGLE_SERVICE_ACCOUNT_JSON={JSON completo}
CLUB_NAME_FILTER=SS. Reyes - CC. Menorca
AUTO_SYNC_ON_BOOT=true
AUTO_SYNC_INTERVAL_MINUTES=30
```

`CATEGORY_FILTERS` puede eliminarse o dejarse vacío si quieres importar todas las categorías.

## Supabase

Ejecuta `supabase/schema.sql` en SQL Editor.

Si ya tienes datos, no hace falta borrar tablas. Ejecuta el schema actualizado y después pulsa **Actualizar ahora** en la web para regenerar `ranking_results`.

Si quieres empezar de cero:

```sql
drop table if exists public.athlete_results cascade;
drop table if exists public.sync_status cascade;
drop table if exists public.ranking_results cascade;
```

Luego ejecuta `supabase/schema.sql` y sincroniza de nuevo.
