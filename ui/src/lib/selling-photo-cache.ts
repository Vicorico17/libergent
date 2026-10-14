import type { SellPhoto } from './selling';

// IndexedDB preserves original files across sign-in / marketplace authorization redirects.
type StoredPhoto = { name: string; file?: File; uploadedUrl?: string };
function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('libergent-selling', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('draft'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readPhotoCache(): Promise<StoredPhoto[]> {
  const db = await openCache();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('draft', 'readonly').objectStore('draft').get('photos');
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
// Serialize writes so fast add/remove events cannot restore an older photo selection.
let pendingWrite = Promise.resolve();
export function savePhotoCache(photos: SellPhoto[]): Promise<void> {
  const values = photos.map(({ name, file, uploadedUrl }) => ({ name, file, uploadedUrl }));
  const write = pendingWrite.catch(() => {}).then(async () => {
    const db = await openCache();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('draft', 'readwrite');
        transaction.objectStore('draft').put(values, 'photos');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  });
  pendingWrite = write;
  return write;
}
