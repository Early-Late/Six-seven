// db.js — IndexedDB para blobs de archivos (funciona en file:// y http://)
const DB = (() => {
  const DB_NAME = 'mycolladiegooo-db';
  const STORE = 'files';
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }
  async function put(id, blob) { const d = await open(); return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  async function get(id) { const d = await open(); return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readonly'); const q = tx.objectStore(STORE).get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
  async function del(id) { const d = await open(); return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  return { put, get, del };
})();
