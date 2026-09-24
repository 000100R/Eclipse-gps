import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import App from './App.tsx';
import './index.css';

// Early global listener and console tap for Google Maps Platform quota handling
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

// Catch and handle cross-origin Script errors and external script warnings gracefully
window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  const filename = event?.filename || '';
  if (
    msg === 'Script error.' ||
    msg === 'Script error' ||
    !msg ||
    filename.includes('maps.googleapis.com') ||
    filename.includes('gstatic.com') ||
    filename.includes('unpkg.com')
  ) {
    console.warn('Cross-origin script error handled gracefully:', { msg, filename });
    event.preventDefault?.();
    return true;
  }
});

window.onerror = function (msg, url, lineNo) {
  const messageStr = typeof msg === 'string' ? msg : '';
  const urlStr = typeof url === 'string' ? url : '';
  if (
    messageStr === 'Script error.' ||
    messageStr === 'Script error' ||
    !messageStr ||
    urlStr.includes('maps.googleapis.com') ||
    urlStr.includes('gstatic.com') ||
    urlStr.includes('unpkg.com')
  ) {
    console.warn('Cross-origin script event intercepted gracefully:', { msg, url, lineNo });
    return true;
  }
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const reasonStr = typeof reason === 'string' ? reason : reason?.message || String(reason || '');
  if (
    reasonStr.includes('Script error') ||
    reasonStr.includes('Google Maps') ||
    reasonStr.includes('gm_authFailure') ||
    reasonStr.includes('QuotaExceeded') ||
    reasonStr.includes('Failed to fetch')
  ) {
    console.warn('Handled external promise rejection gracefully:', reasonStr);
    event.preventDefault?.();
  }
});

const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  try {
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  } catch {}
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

