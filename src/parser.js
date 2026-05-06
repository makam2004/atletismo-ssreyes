const XLSX = require('xlsx');
const config = require('./config');

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function norm(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function baseHeader(key) {
  // XLSX renames duplicate headers as "Atleta_1", "Licencia_1", etc.
  return String(key).replace(/_\d+$/, '');
}

function getExact(row, headerNames) {
  const keys = Object.keys(row);
  const wanted = headerNames.map(norm);
  for (const key of keys) {
    if (wanted.includes(norm(baseHeader(key)))) {
      const value = clean(row[key]);
      if (value !== '') return value;
    }
  }
  return '';
}

function getIncludes(row, requiredParts, forbiddenParts = []) {
  const keys = Object.keys(row);
  const req = requiredParts.map(norm);
  const forb = forbiddenParts.map(norm);
  for (const key of keys) {
    const n = norm(baseHeader(key));
    if (req.every(part => n.includes(part)) && !forb.some(part => n.includes(part))) {
      const value = clean(row[key]);
      if (value !== '') return value;
    }
  }
  return '';
}

function firstNonEmpty(...values) {
  return values.map(clean).find(Boolean) || '';
}

function detectEvent(row) {
  return firstNonEmpty(
    getExact(row, ['Denominación Prueba']),
    getIncludes(row, ['denominacion', 'prueba']),
    getExact(row, ['Prueba', 'Event', 'Disciplina', 'Modalidad'])
  );
}

function detectMark(row) {
  return firstNonEmpty(
    getExact(row, ['Marca']),
    getExact(row, ['Tiempo', 'Resultado', 'Mark', 'Time'])
  );
}

function detectAthlete(row) {
  // IMPORTANTE: no usar búsquedas amplias por "atleta", porque existen columnas como
  // "Categoría atleta" o "Atleta: Fecha de nacimiento".
  return firstNonEmpty(
    getExact(row, ['Atleta']),
    getIncludes(row, ['atleta'], ['categoria', 'categoría', 'fecha', 'nacimiento']),
    getExact(row, ['Nombre atleta', 'Deportista', 'Nombre y apellidos'])
  );
}

function detectCategory(row) {
  return firstNonEmpty(
    getExact(row, ['Categoría atleta']),
    getIncludes(row, ['categoria', 'atleta']),
    getExact(row, ['Categoría', 'Categoria', 'Category', 'Cat'])
  );
}

function detectClub(row) {
  // IMPORTANTE: no usar "Licencia" a secas, porque esa columna es el número de licencia.
  return firstNonEmpty(
    getExact(row, ['Licencia: Nombre comercial', 'Nombre comercial']),
    getIncludes(row, ['licencia', 'nombre', 'comercial']),
    getIncludes(row, ['nombre', 'comercial']),
    getExact(row, ['Club', 'Equipo', 'Entidad'])
  );
}

function detectResultDate(row) {
  return firstNonEmpty(
    getExact(row, ['Fecha de la marca']),
    getIncludes(row, ['fecha', 'marca']),
    getExact(row, ['Fecha resultado', 'Fecha'])
  );
}

function detectResultPlace(row) {
  return firstNonEmpty(
    getExact(row, ['Lugar de resultado']),
    getIncludes(row, ['lugar', 'resultado']),
    getExact(row, ['Lugar', 'Sede', 'Localidad'])
  );
}

function detectPosition(row) {
  return firstNonEmpty(
    getExact(row, ['Puesto', 'Posición', 'Posicion', 'Ranking', 'Rank'])
  );
}

function markToNumber(mark) {
  const value = clean(mark).replace(',', '.');
  if (!value) return null;

  // Tiempo tipo 1:23.45 => segundos
  const timeMatch = value.match(/^(\d+):([0-5]?\d)(?:\.(\d+))?$/);
  if (timeMatch) {
    const min = Number(timeMatch[1]);
    const sec = Number(timeMatch[2]);
    const dec = Number(`0.${timeMatch[3] || '0'}`);
    return min * 60 + sec + dec;
  }

  // Marca numérica tipo 8.56, 3.20, etc.
  const n = Number(value.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function rowIsUseful(record) {
  return record.athlete_name && record.event_name && record.mark_raw && record.category;
}

function parseSpreadsheet(buffer, sourceFile) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const rows = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    json.forEach((row, idx) => {
      const record = {
        source_file_id: sourceFile.id,
        source_file_name: sourceFile.name,
        source_modified_time: sourceFile.modifiedTime,
        sheet_name: sheetName,
        row_number: idx + 2,
        event_name: detectEvent(row),
        mark_raw: detectMark(row),
        mark_value: markToNumber(detectMark(row)),
        athlete_name: detectAthlete(row),
        category: detectCategory(row),
        club_name: detectClub(row),
        result_date: detectResultDate(row),
        result_place: detectResultPlace(row),
        position_raw: detectPosition(row),
        imported_at: new Date().toISOString()
      };

      if (rowIsUseful(record) && config.categoryFilters.includes(record.category)) {
        rows.push(record);
      }
    });
  }

  return rows;
}

module.exports = { parseSpreadsheet };
