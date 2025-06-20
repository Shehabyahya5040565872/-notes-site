const CACHE_NAME = "note-app-cache-v1";
const FILES_TO_CACHE = [
  "index.html",
  "add.html",
  "view.html",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Background Sync for offline notes saving
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncOfflineNotes());
  }
});

async function syncOfflineNotes() {
  const db = await openDB('note-sync-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
      }
    }
  });

  const tx = db.transaction('pending', 'readwrite');
  const store = tx.objectStore('pending');
  const allNotes = await store.getAll();

  await Promise.all(allNotes.map(async note => {
    try {
      await fetch('/sync-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(note)
      });
      await store.delete(note.id);
    } catch (err) {
      console.error('Sync failed for note:', note);
    }
  }));
} 

// IndexedDB helper
function openDB(name, version, { upgrade }) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
