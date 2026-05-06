# App Atletismo: Google Drive → Supabase → Rankings

Esta app importa automáticamente el Excel más reciente de una carpeta de Google Drive a Supabase y muestra una web con filtros y rankings.

## 1. Crear tablas en Supabase

1. Entra en Supabase.
2. Abre tu proyecto.
3. Ve a **SQL Editor**.
4. Pega el contenido de `supabase/schema.sql`.
5. Pulsa **Run**.
6. Comprueba en **Table Editor** que existen:
   - `athlete_results`
   - `sync_status`

## 2. Crear cuenta de servicio de Google

1. Entra en Google Cloud Console.
2. Crea un proyecto nuevo o usa uno existente.
3. Activa **Google Drive API**.
4. Ve a **IAM & Admin → Service Accounts**.
5. Crea una cuenta de servicio.
6. En **Keys**, crea una clave tipo **JSON**.
7. Descarga el JSON.
8. Copia el email `client_email` del JSON.
9. En Google Drive, comparte tu carpeta del Excel con ese email como lector.

## 3. Variables de entorno en Render

Obligatorias:

```text
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxx
DRIVE_FOLDER_ID=ID_DE_TU_CARPETA_DE_DRIVE
GOOGLE_SERVICE_ACCOUNT_JSON={JSON_COMPLETO_DE_GOOGLE}
CATEGORY_FILTERS=U12F,U12M
CLUB_NAME_FILTER=SS. Reyes - CC. Menorca
AUTO_SYNC_ON_BOOT=true
AUTO_SYNC_INTERVAL_MINUTES=30
```

Notas:
- `DRIVE_FOLDER_ID` es solo el ID de la carpeta, no la URL entera.
- `GOOGLE_SERVICE_ACCOUNT_JSON` debe ser el JSON completo de Google.
- No subas el JSON a GitHub.

## 4. Render

Usa despliegue Docker:

- Dockerfile Path: `./Dockerfile`
- Docker Build Context Directory: `.`
- Docker Command: vacío

## 5. Cómo funciona

- Al arrancar, la app busca el Excel/Google Sheet/CSV más reciente en `DRIVE_FOLDER_ID`.
- Lo importa a Supabase.
- Cada `AUTO_SYNC_INTERVAL_MINUTES` repite la comprobación.
- Si el archivo no cambió, no reimporta.
- Desde la web puedes pulsar **Actualizar ahora** para forzar importación.

## 6. Rutas útiles

- `/` web principal
- `/health` comprueba si la app vive
- `/api/status` estado de sincronización
- `/api/sync` fuerza sincronización con POST
- `/api/options` opciones de filtros
- `/api/results` resultados filtrados
- `/api/ranking` ranking por prueba

## 7. Si importa 0 filas

Normalmente significa que los nombres de columnas del Excel no coinciden. La app intenta detectar:

- Categoría: `categoria`, `categoría`, `category`, `cat`
- Atleta: `atleta`, `nombre atleta`, `deportista`, `nombre y apellidos`, `nombre`
- Club: `licencia`, `club`, `nombre comercial del club`, `equipo`, `entidad`
- Prueba: `prueba`, `event`, `disciplina`, `modalidad`, `carrera`
- Marca: `marca`, `tiempo`, `resultado`, `mark`, `time`

Si tu Excel usa otros nombres, edita `src/parser.js` y añade esos nombres en los arrays.
