const CACHE_NAME = 'offline-work-v1';
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './db.js',
    './styles.css',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// 安裝 Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('快取已開啟');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.log('快取失敗:', err);
            })
    );
});

// 啟動 Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('刪除舊快取:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 攔截請求
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 如果快取中有，直接返回
                if (response) {
                    return response;
                }
                
                // 否則從網路取得
                return fetch(event.request).then(response => {
                    // 檢查是否是有效的回應
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // 複製回應並存入快取
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    
                    return response;
                });
            })
            .catch(() => {
                // 網路和快取都失敗時的後備方案
                return caches.match('./index.html');
            })
    );
});
