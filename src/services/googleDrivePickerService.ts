import firebaseConfig from '../../firebase-applet-config.json';

// Declare ambient Google and GAPI types for TypeScript
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export interface SelectedDriveFolder {
  id: string;
  name: string;
  url?: string;
  iconUrl?: string;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  webViewLink: string;
  folderId?: string;
  folderName?: string;
  sizeBytes?: number;
  mimeType: string;
}

/**
 * Ensures Google Picker API client script is loaded
 */
export async function loadGooglePickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window not available'));
    }

    if (window.google?.picker) {
      return resolve();
    }

    const checkGapi = () => {
      if (window.gapi) {
        window.gapi.load('picker', {
          callback: () => {
            if (window.google?.picker) {
              resolve();
            } else {
              reject(new Error('Google Picker library failed to load.'));
            }
          },
          onerror: () => {
            reject(new Error('Failed to load Google Picker via gapi.load'));
          },
        });
      } else {
        // Wait or load script if not loaded
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          window.gapi.load('picker', {
            callback: () => resolve(),
            onerror: () => reject(new Error('Failed to load Google Picker')),
          });
        };
        script.onerror = () => reject(new Error('Failed to load Google API script'));
        document.head.appendChild(script);
      }
    };

    checkGapi();
  });
}

/**
 * Launches the Google Drive Picker for selecting a destination folder
 */
export async function pickGoogleDriveFolder(
  accessToken: string
): Promise<SelectedDriveFolder | null> {
  await loadGooglePickerApi();

  return new Promise((resolve, reject) => {
    try {
      const pickerOrigin =
        window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
          ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
          : window.location.origin;

      // Create a Folders view allowing user to choose existing folders or create new ones
      const folderView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true)
        .setMimeTypes('application/vnd.google-apps.folder');

      // Create general Docs view with folder selection enabled
      const allDocsView = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder');

      const pickerBuilder = new window.google.picker.PickerBuilder()
        .addView(folderView)
        .addView(allDocsView)
        .setOAuthToken(accessToken)
        .setAppId(firebaseConfig.projectId)
        .setTitle('Select Destination Google Drive Folder')
        .setOrigin(pickerOrigin)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const picked = data.docs?.[0];
            if (picked) {
              resolve({
                id: picked.id,
                name: picked.name || 'Selected Folder',
                url: picked.url,
                iconUrl: picked.iconUrl,
              });
            } else {
              resolve(null);
            }
          } else if (data.action === window.google.picker.Action.CANCEL) {
            resolve(null);
          }
        });

      const picker = pickerBuilder.build();
      picker.setVisible(true);
    } catch (err) {
      console.error('Error opening Google Picker:', err);
      reject(err);
    }
  });
}

/**
 * Retrieves metadata for a folder (e.g. name, webViewLink)
 */
export async function fetchFolderDetails(
  accessToken: string,
  folderId: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  if (!folderId || folderId === 'root') {
    return { id: 'root', name: 'My Drive (Root)', webViewLink: 'https://drive.google.com/' };
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,webViewLink,mimeType`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to retrieve folder details: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Uploads a file (Blob or string content) to Google Drive via multipart REST API
 */
export async function uploadFileToGoogleDrive({
  accessToken,
  filename,
  mimeType,
  dataBlob,
  folderId,
  folderName,
}: {
  accessToken: string;
  filename: string;
  mimeType: string;
  dataBlob: Blob;
  folderId?: string;
  folderName?: string;
}): Promise<DriveUploadResult> {
  const metadata: Record<string, any> = {
    name: filename,
    mimeType,
  };

  if (folderId && folderId !== 'root') {
    metadata.parents = [folderId];
  }

  const boundary = `-------314159265358979323846_${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Read file blob into array buffer
  const fileArrayBuffer = await dataBlob.arrayBuffer();

  const metadataHeader =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n';

  // Convert array buffer to base64
  let binary = '';
  const bytes = new Uint8Array(fileArrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Content = btoa(binary);

  const multipartRequestBody = metadataHeader + base64Content + closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,mimeType,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // not JSON
    }
    const message =
      errorJson?.error?.message ||
      `Google Drive upload failed with HTTP status ${response.status} (${response.statusText})`;
    throw new Error(message);
  }

  const result = await response.json();

  return {
    id: result.id,
    name: result.name || filename,
    webViewLink:
      result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    folderId,
    folderName,
    sizeBytes: result.size ? Number(result.size) : dataBlob.size,
    mimeType,
  };
}
