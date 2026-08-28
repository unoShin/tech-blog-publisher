const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');

function getFileMd5(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

const CREDENTIALS_PATH = path.join(__dirname, '../oauth-credentials.json');
const TOKEN_PATH = path.join(__dirname, '../google-token.json');
const FOLDER_ID = '1w_2wrXrHBRphNTovMQ7bg89hgKuUVtrh';

let oauth2Client;

try {
  if (fs.existsSync(CREDENTIALS_PATH) && fs.existsSync(TOKEN_PATH)) {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    
    const clientInfo = credentials.installed || credentials.web;
    const { client_secret, client_id, redirect_uris } = clientInfo;
    
    oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris ? redirect_uris[0] : 'http://localhost:3000/oauth2callback'
    );
    
    oauth2Client.setCredentials(tokens);
  } else {
    console.error('Credentials or token file not found. Run tasks/auth.js first.');
  }
} catch (e) {
  console.error('Failed to initialize Google Auth:', e.message);
}

/**
 * Gets or creates a subfolder inside the main parent folder.
 * @param {string} folderName Name of the subfolder (e.g. '260601_01').
 * @returns {Promise<string>} Subfolder ID.
 */
async function getOrCreateSubfolder(folderName) {
  if (!oauth2Client) {
    throw new Error('Google OAuth client is not initialized.');
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // 1. Search for existing folder
  const listResponse = await drive.files.list({
    q: `name = '${folderName}' and '${FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
  });

  const files = listResponse.data.files;
  if (files && files.length > 0) {
    console.log(`[Google Drive] Subfolder '${folderName}' already exists. ID: ${files[0].id}`);
    return files[0].id;
  }

  // 2. Create new subfolder
  console.log(`[Google Drive] Creating subfolder '${folderName}'...`);
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [FOLDER_ID],
  };

  const folderResponse = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  });

  const folderId = folderResponse.data.id;
  console.log(`[Google Drive] Subfolder created. ID: ${folderId}`);
  
  // Make the folder itself readable (files inside will also inherit or be set individually)
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  } catch (err) {
    console.warn(`[Google Drive] Failed to set folder permission: ${err.message}`);
  }

  return folderId;
}

/**
 * Uploads a local file to Google Drive folder and returns the direct link.
 * @param {string} filePath Absolute path of local file to upload.
 * @param {string} parentFolderId Google Drive folder ID to upload into.
 * @param {string} mimeType Mime type of the file.
 * @returns {Promise<string>} Direct image URL.
 */
async function uploadImage(filePath, parentFolderId, mimeType = 'image/png') {
  if (!oauth2Client) {
    throw new Error('Google OAuth client is not initialized. Run auth script first.');
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const fileName = path.basename(filePath);
  const targetParent = parentFolderId || FOLDER_ID;

  // 1. Search if file already exists in target folder
  console.log(`[Google Drive] Checking if ${fileName} already exists...`);
  const listResponse = await drive.files.list({
    q: `name = '${fileName}' and '${targetParent}' in parents and trashed = false`,
    fields: 'files(id, md5Checksum, size)',
  });

  const files = listResponse.data.files;
  const localMd5 = getFileMd5(filePath);

  if (files && files.length > 0) {
    const existingFile = files[0];
    // Compare MD5 checksum to decide whether to update or reuse
    if (existingFile.md5Checksum === localMd5) {
      console.log(`[Google Drive] File '${fileName}' already exists with matching MD5. Reusing ID: ${existingFile.id}`);
      return `https://lh3.googleusercontent.com/d/${existingFile.id}`;
    } else {
      console.log(`[Google Drive] File '${fileName}' exists but has different MD5. Updating file...`);
      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath),
      };
      
      await drive.files.update({
        fileId: existingFile.id,
        media: media,
      });
      
      console.log(`[Google Drive] Updated successfully. File ID: ${existingFile.id}`);
      return `https://lh3.googleusercontent.com/d/${existingFile.id}`;
    }
  }

  // 2. Upload file (New upload)
  console.log(`[Google Drive] Uploading ${fileName} (New upload)...`);
  const fileMetadata = {
    name: fileName,
    parents: [targetParent],
  };

  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id',
  });

  const fileId = response.data.id;
  console.log(`[Google Drive] Uploaded successfully. File ID: ${fileId}`);

  // 3. Set permission to reader/anyone so it can be accessed publicly
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // 4. Return direct link
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

module.exports = {
  getOrCreateSubfolder,
  uploadImage,
};
