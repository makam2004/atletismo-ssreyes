const dotenv = require('dotenv');
dotenv.config();

function readCategoryFilters(value) {
  return String(value || 'U12F,U12M')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  port: Number(process.env.PORT || 10000),
  driveFolderId: process.env.DRIVE_FOLDER_ID || '',
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  publicFileUrl: process.env.PUBLIC_FILE_URL || '',
  publicFileId: process.env.PUBLIC_FILE_ID || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  clubNameFilter: process.env.CLUB_NAME_FILTER || 'SS. Reyes - CC. Menorca',
  categoryFilters: readCategoryFilters(process.env.CATEGORY_FILTERS),
};
