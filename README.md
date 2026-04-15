# Atletismo · app con sincronización automática

Aplicación Node + Express preparada para Render y Supabase.

## Qué hace
- Lee automáticamente un Excel/CSV/Google Sheet desde una fuente configurada.
- Guarda los resultados en `public.athlete_results` en Supabase.
- Muestra filtros por categoría, club, prueba y atleta.
- Genera la clasificación completa de mejores tiempos por prueba.
- Sincroniza al arrancar y después de forma periódica.

## Variables de entorno

Obligatorias:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

De negocio:
- `CLUB_NAME_FILTER=SS. Reyes - CC. Menorca`
- `CATEGORY_FILTERS=U12F,U12M`

Fuente de datos: usa una de estas opciones.

### Opción simple
- `PUBLIC_FILE_URL=https://...`

### Opción simple por id público
- `PUBLIC_FILE_ID=<google-file-id>`

### Opción avanzada: carpeta de Drive + cuenta de servicio
- `DRIVE_FOLDER_ID=<folder-id>`
- `GOOGLE_SERVICE_ACCOUNT_JSON=<json completo>`

Opcionales:
- `AUTO_SYNC_ON_BOOT=true`
- `AUTO_SYNC_INTERVAL_MINUTES=30`

## Supabase
Antes de usar la app, ejecuta `supabase/schema.sql` en SQL Editor.

La tabla que necesita la app es `public.athlete_results`.

## Render
Usar Web Service con Docker.

### Dockerfile Path
`./Dockerfile`

### Docker Build Context Directory
`.`

## Funcionamiento recomendado
Si la URL pública siempre apunta al Excel más reciente, usa `PUBLIC_FILE_URL`.

Si lo que cambia es el archivo dentro de una carpeta y necesitas coger siempre el último automáticamente, usa `DRIVE_FOLDER_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON`.
