import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { handleGitHubPagesRedirect, unregisterServiceWorkers } from './lib/github-pages-compat';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Handle GitHub Pages 404→index.html redirect before React mounts.
// The inline script in index.html does this too, but this is a safety net.
handleGitHubPagesRedirect();

// Unregister stale service workers from previous deployments that may
// serve cached bundles and cause "stuck on loading" after deploys.
unregisterServiceWorkers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/tapride">
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
