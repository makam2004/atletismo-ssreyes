# SS. Reyes - CC. Menorca · lector de marcas U12

Aplicación preparada para desplegar en Render. Lee un Excel o Google Sheet desde una carpeta fija de Google Drive, filtra por categorías U12 y guarda los resultados en Supabase.

## Qué hace

- Lista los ficheros compatibles de una carpeta de Google Drive
- Importa el archivo más reciente o uno concreto
- Extrae nombre del atleta y su marca
- Intenta detectar columnas frecuentes: `Atleta`, `Categoría`, `Licencia/Club`, `Marca/Tiempo`, `Puesto`, `Prueba`
- Muestra una interfaz simple para filtrar datos
- Mantiene la vista específica del club `SS. Reyes - CC. Menorca`
- Añade un ranking global por prueba con la mejor marca de cada atleta entre todos los clubes importados

## Requisitos

1. Un proyecto de Supabase
2. Una cuenta de servicio de Google con acceso de lectura a la carpeta de Drive
3. La carpeta compartida con el email de la cuenta de servicio

## Variables de entorno

Configura estas variables en local o en Render:

- `DRIVE_FOLDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLUB_NAME_FILTER=SS. Reyes - CC. Menorca`
- `CATEGORY_FILTERS=U12F,U12M`

## Google Drive

1. Crea una cuenta de servicio en Google Cloud
2. Activa la API de Google Drive
3. Descarga la clave JSON
4. Copia el contenido completo del JSON en `GOOGLE_SERVICE_ACCOUNT_JSON`
5. Comparte la carpeta de Drive con el correo de la cuenta de servicio

## Supabase

Ejecuta `supabase/schema.sql` en el SQL Editor de Supabase.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

La web quedará disponible en `http://localhost:10000`.

## Despliegue en Render

1. Sube este proyecto a GitHub
2. En Render crea un `Web Service` desde el repositorio, o usa `render.yaml`
3. Añade las variables de entorno en Render
4. Despliega

## Notas importantes

- La importación ya no se limita al club, para poder generar rankings globales por prueba
- El listado principal sigue pudiendo filtrarse por tu club o por todos los clubes
- El ranking usa una sola mejor marca por atleta y por prueba
- Si el Excel usa nombres de columnas distintos, ajusta `COLUMN_ALIASES` en `src/excelParser.js`
- Ahora mismo la app reemplaza la importación del archivo seleccionado borrando antes los registros previos de ese mismo fichero
- Si luego quieres histórico completo o diferencias entre importaciones, se puede ampliar

## API útil

- `GET /api/athletes` → listado filtrable de marcas
- `GET /api/rankings` → ranking global por prueba
- `POST /api/import/latest` → importa el último archivo detectado
- `POST /api/import/file/:fileId` → importa un archivo concreto

## Próximas mejoras recomendadas

- Importación automática cada X minutos con un cron
- Ranking por club y por prueba
- Exportación CSV
- Panel de errores de importación
- Soporte para varios formatos de marca

- La clasificación global por prueba devuelve la lista completa de atletas importados, sin recortar a top 3, top 5 o top 10.
