
'use client';

/**
 * @fileOverview Service d'interaction avec l'API Microsoft Graph (OneDrive).
 * Permet l'upload de documents directement sur le OneDrive client.
 */

export async function createOneDriveFolder(token: string, folderName: string): Promise<string> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    }),
  });

  if (!response.ok) throw new Error("Impossible de créer le dossier OneDrive");
  const data = await response.json();
  return data.id;
}

export async function uploadFileToOneDrive(token: string, folderId: string, fileName: string, dataUrl: string) {
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

  // Upload direct via Microsoft Graph (PUT pour fichiers < 4MB)
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': mimeType,
    },
    body: blob,
  });

  if (!response.ok) throw new Error("Échec de l'upload sur OneDrive");
  const data = await response.json();
  
  return {
    id: data.id,
    webViewLink: data.webUrl
  };
}
