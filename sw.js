const CACHE_NAME = 'v=260626002'; // 💡 每次更新 CSS/JS 檔案時，手動將這裡改成 v2, v3... 即可
// 快取清單：保持乾淨的路徑
const ASSETS_TO_CACHE = [
  '/index.html',
  '/tree.html',
  '/recommend.html',
  '/maintenance.html',
  '/comp.html',
  '/comp_tree.html',
  '/manifest.json',
  '/resource/192x192.png',
  '/resource/512x512.png',
  '/js/tom-select.complete.min.js',
  '/js/pages/lookup-page.js',
  '/js/pages/maintenance-page.js',
  '/js/pages/recommend-page.js',
  '/js/pages/tree-page.js',
  '/js/shared/app-shared.js',
  '/js/shared/wc-navbar.js',
  '/js/app.js',
  '/js/ord_data.js',
  '/css/styles.css',
  '/css/tom-select.css',
];

// 1. 安裝階段：改用正確的 Request 物件避開瀏覽器快取
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('正在快取靜態資源...');
      const cachePromises = ASSETS_TO_CACHE.map(url => {
        const cleanUrl = url === '/' ? '/index.html' : url;
        // 使用 cache: 'reload' 強制向伺服器抓最新檔案，不依賴網址加時間戳
        const request = new Request(cleanUrl, { cache: 'reload' }); 
        
        return fetch(request)
          .then(response => {
            if (!response.ok) throw new TypeError(`下載失敗: ${url}`);
            return cache.put(url, response); // 存進乾淨的 url Key
          })
          .catch(err => console.error(`無法快取資源: ${url}`, err));
      });
      return Promise.all(cachePromises);
    })
  );
});

// 2. 激活階段 (Activate)：清理舊版本的快取
self.addEventListener('activate', event => {
  // 💡 關鍵 2：讓新的 SW 立刻控制目前所有打開的網頁分頁
  event.waitUntil(self.clients.claim()); 

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('刪除舊快取:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. 攔截請求：支援多頁面靜態網頁
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // 💡 僅處理 http 和 https 協議，直接跳過 chrome-extension:// 等不支援的請求
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return; 
  }
  // 💡 判斷是否為 HTML 頁面請求（導航請求，或是網址結尾是 .html）
  const isHtmlRequest = event.request.mode === 'navigate' || 
                        url.pathname.endsWith('.html') || 
                        ASSETS_TO_CACHE.includes(url.pathname);

  if (isHtmlRequest) {
    // 🚀 HTML 頁面採用「網路優先 (Network First)」
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 如果網路請求成功，順手把最新版的 HTML 存入/更新快取
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              // 使用精準的 pathname 作為 Key (例如 '/about.html')
              cache.put(url.pathname, copy);
            });
          }
          return response;
        })
        .catch(() => {
          // 📡 斷網（離線）時，嘗試從快取拿對應的 HTML 頁面
          return caches.match(url.pathname).then(fallbackResponse => {
            // 如果快取有該頁面就吐出；真的都沒有，就回傳首頁或全域離線頁面
            return fallbackResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 📦 其他非 HTML 資源（JS, CSS, 圖片）：精準比對快取
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse; // 快取精準命中（含版本號或乾淨網址）
      }
      
      // 網路下載新資源（例如帶有新版本號的 app.js?v=260626002）
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});

// 監聽來自網頁端的更新指令
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});