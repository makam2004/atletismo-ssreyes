require('dotenv').config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function parseList(value, fallback = []) {
  if (!value) return fallback;
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

function getGoogleCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    // Por si Render guarda saltos de línea escapados
    return JSON.parse(raw.replace(/\\n/g, '\n'));
  }
}

module.exports = {
  port: process.env.PORT || 10000,
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  driveFolderId: requireEnv('DRIVE_FOLDER_ID'),
  googleCredentials: getGoogleCredentials(),
  categoryFilters: parseList(process.env.CATEGORY_FILTERS, ['U12F', 'U12M']),
  clubNameFilter: process.env.CLUB_NAME_FILTER || 'SS. Reyes - CC. Menorca',
  autoSyncOnBoot: String(process.env.AUTO_SYNC_ON_BOOT || 'true').toLowerCase() === 'true',
  autoSyncIntervalMinutes: Number(process.env.AUTO_SYNC_INTERVAL_MINUTES || 30)
};
