import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// We wrap the PWA registration in a dynamic import to prevent a blank screen 
// if the virtual module isn't present during local development or in non-Vite previews.
// Added a cast to 'any' for import.meta to avoid TypeScript error 'Property env does not exist on type ImportMeta'
if ((import.meta as any).env?.PROD) {
  // @ts-expect-error - virtual module provided by vite-plugin-pwa
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => {
    console.log('PWA Service Worker registration skipped');
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);