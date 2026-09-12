import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// --- KESİN ÇÖZÜM: FETCH İÇİN LAB ID ENJEKTÖRÜ (TypeScript Uyumlu) ---
const originalFetch = window.fetch;
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  
  if (url.includes('/api/') && !url.includes('labId=')) {
    try {
      const authRaw = localStorage.getItem('pt_auth');
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        if (auth?.labId) {
          url = url + (url.includes('?') ? '&' : '?') + 'labId=' + auth.labId;
        }
      }
    } catch {}
  }

  if (input instanceof Request) {
    return originalFetch(new Request(url, input), init);
  }
  return originalFetch(url, init);
};
// -------------------------------------------------------------------------

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)