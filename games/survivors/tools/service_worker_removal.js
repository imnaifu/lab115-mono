// Served as index.service.worker.js now that the game no longer installs as a PWA.
//
// Browsers that visited while it was a PWA still run the old caching worker, which answers
// every request from its cache. Simply deleting the file would leave them stuck on that old
// version (an update check that 404s keeps the old worker), so this stands in for it: when a
// browser checks for an update it installs this one, which takes over at once, empties the
// caches and unregisters itself. The page that is open keeps running; the next load comes
// straight from the network.
self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys.map((key) => caches.delete(key)));
		await self.registration.unregister();
	})());
});
