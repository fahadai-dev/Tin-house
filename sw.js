// ============================================================
// টিন হাউস — Service Worker
// শুধু static shell cache করে; Supabase API কল সবসময় নেটওয়ার্ক
// থেকেই যাবে (ডেটা যেন পুরনো/ভুল না দেখায়)।
// ============================================================

const CACHE_NAME = "tinhouse-manager-v1";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/login.html",
  "/config.js",
  "/manifest.json",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll() ব্যবহার করলে একটা ফাইল 404 দিলেও পুরো ইনস্টল ফেল করে।
      // তাই এক এক করে cache করছি, একটা fail করলেও বাকিগুলো ঠিকমতো cache হবে।
      Promise.allSettled(
        SHELL_FILES.map((file) =>
          cache
            .add(file)
            .catch((err) => console.warn("Cache করা যায়নি:", file, err)),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Supabase API কল, /api/* সার্ভারলেস ফাংশন, বা অন্য কোনো external কল ক্যাশ করব না
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        return caches.match("/login.html");
      });
    }),
  );
});
