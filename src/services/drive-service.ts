
'use client';

/**
 * @fileOverview Service d'interaction avec l'API Google Drive.
 * Permet l'upload de documents directement sur le Cloud client.
 */

export async function createDriveFolder(token: string, folderName: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!response.ok) throw new Error("Impossible de créer le dossier Google Drive");
  const data = await response.json();
  return data.id;
}

export async function uploadFileToDrive(token: string, folderId: string, fileName: string, dataUrl: string) {
  // Extraction des données base64
  const parts = dataUrl.split(',');
  const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const base64Data = parts[1];
  
  // Conversion base64 en Blob
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) throw new Error("Échec de l'upload sur Google Drive");
  return await response.json();
}
