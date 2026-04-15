# Atletismo · SS. Reyes - CC. Menorca

Aplicación lista para desplegar en Render y conectarse con Supabase. Importa resultados desde un Excel/CSV/Google Sheet, filtra por categorías `U12F` y `U12M`, y muestra:

- resultados filtrados del club o de cualquier club
- clasificación completa por prueba con la mejor marca de cada atleta

## Qué incluye

- `Dockerfile` listo para Render
- `package-lock.json` generado
- backend Express en CommonJS para evitar problemas de ESM
- soporte para importación con:
  - `GOOGLE_SERVICE_ACCOUNT_JSON` + `DRIVE_FOLDER_ID`, o
  - `PUBLIC_FILE_URL`, o
  - `PUBLIC_FILE_ID`
- interfaz web simple en `public/index.html`
- SQL para Supabase en `supabase/schema.sql`

## Variables de entorno

Obligatorias para guardar datos:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Filtros de negocio:

- `CLUB_NAME_FILTER=SS. Reyes - CC. Menorca`
- `CATEGORY_FILTERS=U12F,U12M`

Opciones de importación. Basta una de estas rutas:

### Opción A · Google Drive con cuenta de servicio
- `DRIVE_FOLDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

### Opción B · Fichero público directo
- `PUBLIC_FILE_URL`

### Opción C · Fichero público por id de Google Drive
- `PUBLIC_FILE_ID`

## Despliegue en Render

Recomendado: **Web Service con Docker**.

- Dockerfile Path: `./Dockerfile`
- Docker Build Context Directory: `.`
- No pongas Docker Command

## Supabase

1. Crea un proyecto.
2. Entra en SQL Editor.
3. Ejecuta `supabase/schema.sql`.
4. Copia:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_...`)

## Google Drive

Si la carpeta no es tuya o no quieres cuenta de servicio, usa `PUBLIC_FILE_URL` o `PUBLIC_FILE_ID` del fichero concreto.

## Endpoints

- `GET /health`
- `GET /api/config`
- `GET /api/results`
- `GET /api/rankings`
- `POST /api/import`

## Importación

La app intenta detectar columnas con nombres como:

- Atleta / Nombre
- Categoría
- Club / Licencia
- Prueba
- Marca / Tiempo
- Puesto

Si tu Excel usa otros nombres, habría que ajustar `src/excelParser.js`.
