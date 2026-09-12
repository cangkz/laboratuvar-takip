import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// --- KESİN ÇÖZÜM: TÜM AĞ TRAFİĞİ (FETCH + AXIOS) İÇİN LAB ID ENJEKTÖRÜ ---
const injectLabId = (url: string) => {
  if (url.includes('/api/') && !url.includes('labId=')) {
    try {
      const authRaw = localStorage.getItem('pt_auth');
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        if (auth?.labId) {
          return url + (url.includes('?') ? '&' : '?') + 'labId=' + auth.labId;
        }
      }
    } catch {}
  }
  return url;
};

// 1. Fetch İsteklerini Yakala (Modern Browser API)
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let [resource, config] = args;
  if (typeof resource === 'string' || resource instanceof URL) {
    resource = injectLabId(resource.toString());
  } else if (resource instanceof Request) {
    const newUrl = injectLabId(resource.url);
    resource = new Request(newUrl, resource);
  }
  return originalFetch(resource, config);
};

// 2. Axios / XHR İsteklerini Yakala (Eski Tip XHR)
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: any[]) {
  const newUrl = injectLabId(url.toString());
  // @ts-ignore
  return originalOpen.apply(this, [method, newUrl, ...rest]);
};
// -------------------------------------------------------------------------

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)