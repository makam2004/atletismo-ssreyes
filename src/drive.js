const { google } = require('googleapis');
const config = require('./config');

const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.google-apps.spreadsheet',
  'text/csv'
];

async function getDriveClient() {
  if (!config.googleCredentials) {
    throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON. Comparte la carpeta con el email client_email del JSON.');
  }
  const auth = new google.auth.GoogleAuth({
    credentials: config.googleCredentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  return google.drive({ version: 'v3', auth });
}

async function findLatestSpreadsheet() {
  const drive = await getDriveClient();
  const mimeQuery = EXCEL_MIME_TYPES.map(t => `mimeType='${t}'`).join(' or ');
  const res = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and trashed=false and (${mimeQuery})`,
    fields: 'files(id,name,mimeType,modifiedTime,createdTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  const files = res.data.files || [];
  if (!files.length) throw new Error('No se encontraron Excel/Sheets/CSV en la carpeta de Drive.');
  return files[0];
}

async function downloadLatestSpreadsheetBuffer() {
  const drive = await getDriveClient();
  const file = await findLatestSpreadsheet();
  let response;
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    response = await drive.files.export(
      { fileId: file.id, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { responseType: 'arraybuffer' }
    );
  } else {
    response = await drive.files.get(
      { fileId: file.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
  }
  return { file, buffer: Buffer.from(response.data) };
}

module.exports = { findLatestSpreadsheet, downloadLatestSpreadsheetBuffer };
