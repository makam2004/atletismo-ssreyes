import { google } from 'googleapis';
import { config } from './config.js';

function parseServiceAccountJson() {
  const raw = config.googleServiceAccountJson.trim();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
}

function getDriveClient() {
  const credentials = parseServiceAccountJson();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });

  return google.drive({ version: 'v3', auth });
}

const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.google-apps.spreadsheet'
];

export async function listSpreadsheetFiles() {
  const drive = getDriveClient();
  const query = [
    `'${config.driveFolderId}' in parents`,
    'trashed = false',
    `(${ACCEPTED_MIME_TYPES.map((type) => `mimeType='${type}'`).join(' or ')})`
  ].join(' and ');

  const response = await drive.files.list({
    q: query,
    pageSize: 50,
    orderBy: 'modifiedTime desc',
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)'
  });

  return response.data.files ?? [];
}

export async function downloadSpreadsheetFile(fileId, mimeType) {
  const drive = getDriveClient();

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const response = await drive.files.export(
      {
        fileId,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data);
  }

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data);
}
