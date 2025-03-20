// Service Worker for MMSD Chatbot PWA

const CACHE_NAME = 'mmsd-chatbot-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './chatbotService.js',
  './marked.min.js',
  './manifest.json',
  './icons/icon192.png',
  './icons/icon512.png',
  './icons/icon128.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return cacheName !== CACHE_NAME;
        }).map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - network first with cache fallback strategy for static assets
// API calls go straight to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests, but handle the GitHub Pages path correctly
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || 
      url.pathname.includes('/api/') ||
      url.pathname.includes('openai.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise try to fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response since we need to use it twice
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, return a fallback page
            if (event.request.url.includes('.html')) {
              return caches.match('./index.html');
            }
            return new Response('Network error occurred. Please check your connection.');
          });
      })
  );
});