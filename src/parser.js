const XLSX = require('xlsx');
const config = require('./config');

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function norm(value) {
  return clean(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function pick(row, names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const n = norm(name);
    const found = keys.find(k => norm(k) === n || norm(k).includes(n));
    if (found && clean(row[found]) !== '') return row[found];
  }
  return '';
}

function detectCategory(row) {
  return clean(pick(row, ['categoria', 'category', 'cat', 'categoría']));
}

function detectAthlete(row) {
  const combined = clean(pick(row, ['atleta', 'athlete', 'nombre atleta', 'deportista', 'nombre y apellidos', 'nombre']));
  if (combined) return combined;
  const first = clean(pick(row, ['nombre']));
  const last = clean(pick(row, ['apellidos', 'apellido']));
  return clean(`${first} ${last}`);
}

function detectClub(row) {
  return clean(pick(row, ['licencia', 'club', 'nombre comercial del club', 'equipo', 'entidad']));
}

function detectEvent(row) {
  return clean(pick(row, ['prueba', 'event', 'disciplina', 'modalidad', 'carrera']));
}

function detectMark(row) {
  return clean(pick(row, ['marca', 'tiempo', 'resultado', 'mark', 'time']));
}

function detectPosition(row) {
  return clean(pick(row, ['puesto', 'posicion', 'posición', 'ranking', 'rank']));
}

function markToNumber(mark) {
  const value = clean(mark).replace(',', '.');
  if (!value) return null;
  const timeMatch = value.match(/^(\d+):([0-5]?\d)(?:\.(\d+))?$/);
  if (timeMatch) {
    const min = Number(timeMatch[1]);
    const sec = Number(timeMatch[2]);
    const dec = Number(`0.${timeMatch[3] || '0'}`);
    return min * 60 + sec + dec;
  }
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
      const category = detectCategory(row);
      const record = {
        source_file_id: sourceFile.id,
        source_file_name: sourceFile.name,
        source_modified_time: sourceFile.modifiedTime,
        sheet_name: sheetName,
        row_number: idx + 2,
        category,
        athlete_name: detectAthlete(row),
        club_name: detectClub(row),
        event_name: detectEvent(row),
        mark_raw: detectMark(row),
        mark_value: markToNumber(detectMark(row)),
        position_raw: detectPosition(row),
        imported_at: new Date().toISOString()
      };
      if (rowIsUseful(record) && config.categoryFilters.includes(record.category)) rows.push(record);
    });
  }
  return rows;
}

module.exports = { parseSpreadsheet };
