// Service Worker - 实现完全离线访问
const CACHE_VERSION = 'offline-work-v1';
const CACHE_NAME = `${CACHE_VERSION}`;

// 需要缓存的资源列表
const STATIC_CACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './libs/dexie.min.js',
  './libs/flatpickr.min.js',
  './libs/flatpickr.min.css',
  './libs/sortable.min.js',
  './libs/html2canvas.min.js',
  './libs/jspdf.umd.min.js',
  './libs/browser-image-compression.js',
  './icons/sprite.svg'
];

// 安装事件 - 缓存所有静态资源
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安装中...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 缓存静态资源');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('[Service Worker] 安装完成，跳过等待');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] 安装失败:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 激活中...', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // 删除旧版本缓存
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] 删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] 激活完成，控制所有页面');
        return self.clients.claim();
      })
  );
});

// Fetch 事件 - 拦截网络请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // 使用 Cache First 策略（离线优先）
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // 如果缓存中有，直接返回
        if (cachedResponse) {
          return cachedResponse;
        }

        // 否则发起网络请求
        return fetch(request)
          .then((networkResponse) => {
            // 检查响应是否有效
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // 克隆响应（因为响应流只能读取一次）
            const responseToCache = networkResponse.clone();

            // 将新资源加入缓存
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch 失败:', error);
            
            // 如果是 HTML 页面请求失败，返回离线页面
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            // 其他资源请求失败，直接抛出错误
            throw error;
          });
      })
  );
});

// 消息事件 - 接收来自主线程的消息
self.addEventListener('message', (event) => {
  console.log('[Service Worker] 收到消息:', event.data);

  // 处理跳过等待命令
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // 处理手动更新缓存命令
  if (event.data && event.data.type === 'UPDATE_CACHE') {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => {
          return cache.addAll(STATIC_CACHE_URLS);
        })
        .then(() => {
          return self.clients.matchAll();
        })
        .then((clients) => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHE_UPDATED' });
          });
        })
    );
  }

  // 处理清除缓存命令
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
        .then(() => {
          return self.clients.matchAll();
        })
        .then((clients) => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        })
    );
  }

  // 处理获取缓存大小命令
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.keys())
        .then((keys) => {
          return self.clients.matchAll();
        })
        .then((clients) => {
          clients.forEach(client => {
            client.postMessage({ 
              type: 'CACHE_SIZE',
              size: STATIC_CACHE_URLS.length
            });
          });
        })
    );
  }
});

// 错误处理
self.addEventListener('error', (event) => {
  console.error('[Service Worker] 发生错误:', event.error);
});

// 未处理的 Promise 拒绝
self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] 未处理的 Promise 拒绝:', event.reason);
});

console.log('[Service Worker] 脚本已加载');
