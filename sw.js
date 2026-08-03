// টিন হাউস — সার্ভিস ওয়ার্কার (network-first, সবসময় সর্বশেষ ভার্সন দেখাবে)
const CACHE_NAME = "tinhouse-cache-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// নেটওয়ার্ক-ফার্স্ট: সবসময় আগে নতুন ভার্সন আনার চেষ্টা করবে,
// শুধু ইন্টারনেট না থাকলে ক্যাশ থেকে দেখাবে (অফলাইন ব্যাকআপ হিসেবে)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
