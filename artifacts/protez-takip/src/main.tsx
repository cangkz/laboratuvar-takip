import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// API çağrılarını doğrudan 5000 portundaki backend'e yönlendir
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (typeof input === 'string' && input.startsWith('/api')) {
    input = `http://127.0.0.1:3000${input}`;
  } else if (input instanceof Request && input.url.startsWith('/api')) {
    input = new Request(`http://127.0.0.1:3000${input.url}`, input);
  }
  return originalFetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);