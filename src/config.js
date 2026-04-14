import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseCsvList(value, fallback = []) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 10000),
  driveFolderId: process.env.DRIVE_FOLDER_ID || '',
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  clubNameFilter: process.env.CLUB_NAME_FILTER || 'SS. Reyes - CC. Menorca',
  categoryFilters: parseCsvList(process.env.CATEGORY_FILTERS, ['U12F', 'U12M'])
};

export function assertRuntimeConfig() {
  required('DRIVE_FOLDER_ID');
  required('GOOGLE_SERVICE_ACCOUNT_JSON');
  required('SUPABASE_URL');
  required('SUPABASE_SERVICE_ROLE_KEY');
}
