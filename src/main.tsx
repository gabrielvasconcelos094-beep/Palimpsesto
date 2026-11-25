import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/global.css';
import { App } from './App';
import { store } from './app/store';

createRoot(document.getElementById('root')!).render(<App />);
void store.load();

if (import.meta.env.DEV) {
  (window as any).__pal = {
    store,
    seed: async () => (await import('./dev/sample')).seedSample(store),
  };
}
