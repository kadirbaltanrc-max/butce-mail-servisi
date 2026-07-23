// Progressive Web App - Service Worker v2.0
const CACHE_NAME = 'butce-app-v2';

// Kurulum Aşamasında Beklemeyi Atla (Anında Güncelleme İçin)
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Yeni Versiyon Aktif Olduğunda Kontrolü Al
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Ağ İstekleri Yönetimi (Canlı Veri Garantisi)
self.addEventListener('fetch', (event) => {
    // Supabase veritabanı ve Mail tetikleme isteklerini ASLA önbelleğe alma (Her zaman canlı çek)
    if (event.request.url.includes('supabase.co') || event.request.url.includes('/tetikle')) {
        return; 
    }
    
    // PWA standartları gereği diğer HTML/JS dosyaları için varsayılan ağ geçişi
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});