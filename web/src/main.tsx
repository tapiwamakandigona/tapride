import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// GitHub Pages SPA redirect: decode ?p= query param back into the path
(function () {
  const search = window.location.search;
  if (search.startsWith('?p=')) {
    const decoded = search.slice(3).replace(/~and~/g, '&');
    const [path, query] = decoded.split('&q=');
    const url =
      window.location.pathname +
      (path ? '/' + path : '') +
      (query ? '?' + query : '') +
      window.location.hash;
    window.history.replaceState(null, '', url);
  }
})();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
