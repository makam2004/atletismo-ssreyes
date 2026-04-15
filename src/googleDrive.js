const { google } = require('googleapis');

function getAuthenticatedDrive(config) {
  if (!config.googleServiceAccountJson) {
    return null;
  }

  const credentials = JSON.parse(config.googleServiceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

async function listSpreadsheetFiles(config) {
  const drive = getAuthenticatedDrive(config);
  if (!drive) {
    return [];
  }

  const response = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and trashed = false and (` +
      `mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or ` +
      `mimeType = 'application/vnd.google-apps.spreadsheet' or ` +
      `mimeType = 'text/csv')`,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });

  return response.data.files || [];
}

function buildPublicGoogleDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

async function downloadBufferFromUrl(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 athletics-importer',
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar el archivo. HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function downloadFileBuffer(config, fileId) {
  const drive = getAuthenticatedDrive(config);
  if (!drive) {
    return downloadBufferFromUrl(buildPublicGoogleDownloadUrl(fileId));
  }

  const metadata = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType',
  });

  const mimeType = metadata.data.mimeType;

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const exportResponse = await drive.files.export(
      {
        fileId,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(exportResponse.data);
  }

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(response.data);
}

module.exports = {
  listSpreadsheetFiles,
  buildPublicGoogleDownloadUrl,
  downloadBufferFromUrl,
  downloadFileBuffer,
};
