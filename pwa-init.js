if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 註冊時也可以帶版本號，強迫瀏覽器檢查 sw.js 是否更新
    navigator.serviceWorker.register('/sw.js?v=260626002')
      .then(reg => {
        console.log('SW 註冊成功');
        
        // 檢查是否有正在等待(waiting)的新 SW
        if (reg.waiting) {
          showUpdatePrompt(reg.waiting);
        }

        // 監聽是否有新的 SW 正在下載安裝
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新的 SW 已安裝完成，且當前已有舊的 SW 在控制頁面
              showUpdatePrompt(newWorker);
            }
          });
        });
      })
      .catch(err => console.error('SW 註冊失敗', err));
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload(); // 當新 SW 接管後，直接重整網頁取得全新資源
  });
}

function showUpdatePrompt(worker) {
  if(!worker) return;
  if (confirm('網站已發布新版本，是否立即更新？')) {
    // 發送訊號給 waiting 的 SW，叫它跳過等待
    // navigator.serviceWorker.ready.then(reg => {
    //   if (reg.waiting) {
    //     reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    //   }
    // });
    worker.postMessage({ type: 'SKIP_WAITING' });
  }
}