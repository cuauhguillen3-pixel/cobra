import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

console.log('main.tsx loaded');
console.log('Environment variables:', {
  url: import.meta.env.VITE_SUPABASE_URL,
  keyPresent: !!import.meta.env.VITE_SUPABASE_ANON_KEY
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="padding: 20px; font-family: sans-serif;"><h1>Error</h1><p>Root element not found</p></div>';
  throw new Error('Root element not found');
}

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{
      padding: '40px',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1 style={{ color: '#dc2626', marginBottom: '20px' }}>Error al cargar la aplicación</h1>
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>Mensaje de error:</h2>
        <pre style={{
          backgroundColor: '#fff',
          padding: '15px',
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '14px'
        }}>{error.message}</pre>
      </div>
      <div style={{
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>Posibles soluciones:</h2>
        <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>Verifica que el archivo .env esté configurado correctamente</li>
          <li>Asegúrate de que las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY estén definidas</li>
          <li>Recarga la página con Ctrl+Shift+R (o Cmd+Shift+R en Mac)</li>
          <li>Abre la consola del navegador (F12) para ver más detalles</li>
        </ol>
      </div>
      <div style={{ marginTop: '20px', fontSize: '14px', color: '#6b7280' }}>
        <p>Variables de entorno detectadas:</p>
        <ul style={{ listStyle: 'none', padding: '10px 0' }}>
          <li>VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL || '❌ No definida'}</li>
          <li>VITE_SUPABASE_ANON_KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Presente' : '❌ No definida'}</li>
        </ul>
      </div>
    </div>
  );
}

try {
  console.log('Creating root...');

  import('./App.tsx')
    .then(({ default: App }) => {
      console.log('App imported successfully');
      createRoot(rootElement).render(
        <StrictMode>
          <App />
        </StrictMode>
      );
      console.log('App rendered');
    })
    .catch((error) => {
      console.error('Error importing App:', error);
      createRoot(rootElement).render(<ErrorFallback error={error} />);
    });
} catch (error) {
  console.error('Error in main:', error);
  createRoot(rootElement).render(
    <ErrorFallback error={error as Error} />
  );
}
