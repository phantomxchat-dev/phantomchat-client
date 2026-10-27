import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { SessionProvider } from './context/SessionContext.tsx';

// Remove all console.log or debugging outputs in production to maximize performance
if ((import.meta as any).env?.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  // Filter out generic cross-origin script errors or browser extension errors
  if (!msg || msg === "Script error." || msg === "Script error" || msg.includes("Script error") || (!event.error && !event.message)) {
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    return true as any;
  }
  console.warn("Global Error Caught:", event.error || event.message);
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = typeof reason === 'string' ? reason : reason?.message || '';
  if (!msg || msg === "Script error." || msg.includes("Script error")) {
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    return true as any;
  }
  console.warn("Unhandled Promise Rejection caught:", event.reason);
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SessionProvider>
        <App />
      </SessionProvider>
    </ErrorBoundary>
  </StrictMode>,
);
