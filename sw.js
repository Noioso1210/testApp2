// 定义缓存名称和版本
const CACHE_NAME = 'chart-master-v1.0.0';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  // 外部CSS资源
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  // 外部JS资源
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  // 本地图片资源
  '柱形.png',
  '折线.png',
  '饼图.png',
  // 图标资源
  'icons/icon-72x72.png',
  'icons/icon-96x96.png',
  'icons/icon-128x128.png',
  'icons/icon-144x144.png',
  'icons/icon-152x152.png',
  'icons/icon-192x192.png',
  'icons/icon-384x384.png',
  'icons/icon-512x512.png'
];

// 安装Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] 安装中...');
  
  // 跳过等待，立即激活
  self.skipWaiting();
  
  // 缓存核心资源
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] 缓存核心资源');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] 安装完成');
      })
      .catch(error => {
        console.error('[Service Worker] 安装失败:', error);
      })
  );
});

// 激活Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] 激活中...');
  
  // 清理旧缓存
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 清理旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // 立即接管所有客户端
  self.clients.claim();
  console.log('[Service Worker] 激活完成，已接管客户端');
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  // 跳过非GET请求和Supabase API请求
  if (event.request.method !== 'GET' || 
      event.request.url.includes('supabase') ||
      event.request.url.includes('api')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 返回缓存响应
        if (cachedResponse) {
          console.log('[Service Worker] 从缓存返回:', event.request.url);
          return cachedResponse;
        }
        
        // 没有缓存，发起网络请求
        return fetch(event.request)
          .then(networkResponse => {
            // 检查响应是否有效
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // 克隆响应以进行缓存
            const responseToCache = networkResponse.clone();
            
            // 将新资源添加到缓存
            caches.open(CACHE_NAME)
              .then(cache => {
                console.log('[Service Worker] 缓存新资源:', event.request.url);
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(error => {
            console.error('[Service Worker] 网络请求失败:', error);
            
            // 对于HTML页面，返回离线页面
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            // 对于其他资源，返回占位符或空响应
            return new Response('网络不可用，请检查连接后重试', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// 监听推送通知
self.addEventListener('push', event => {
  console.log('[Service Worker] 收到推送通知');
  
  const options = {
    body: event.data ? event.data.text() : '图表大师认证挑战有新消息',
    icon: 'icons/icon-192x192.png',
    badge: 'icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/index.html'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('图表大师认证', options)
  );
});

// 处理通知点击
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] 通知被点击');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // 如果已有窗口打开，聚焦到该窗口
        for (const client of clientList) {
          if (client.url.includes('/index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // 如果没有窗口打开，打开新窗口
        if (clients.openWindow) {
          return clients.openWindow('/index.html');
        }
      })
  );
});

// 监听消息
self.addEventListener('message', event => {
  console.log('[Service Worker] 收到消息:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});