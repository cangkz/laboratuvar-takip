import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// API çağrılarını backend'e yönlendir (yerelde localhost, canlıda Render adresi)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (typeof input === 'string' && input.startsWith('/api')) {
    input = `${API_BASE_URL}${input}`;
  } else if (input instanceof Request && input.url.startsWith('/api')) {
    input = new Request(`${API_BASE_URL}${input.url}`, input);
  }
  return originalFetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);