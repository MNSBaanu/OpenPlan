import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { handleLaunchFiles } from './lib/actions';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
handleLaunchFiles();
