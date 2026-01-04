import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler to catch crashes (like import errors) and show them on screen
window.addEventListener('error', (event) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; color: red; font-family: sans-serif;">
        <h2>Algo deu errado</h2>
        <pre>${event.message}</pre>
        <p>Verifique o console do navegador para mais detalhes.</p>
      </div>
    `;
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error: any) {
  rootElement.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
       <h2>Erro ao iniciar aplicação</h2>
       <pre>${error.message || error}</pre>
    </div>
  `;
  console.error("React Mount Error:", error);
}