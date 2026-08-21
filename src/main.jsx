import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import App from './App';
import './tailwind.css';
import './styles.css';
import './responsive-fixes.css';
import './architecture.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppProvider><App /></AppProvider></BrowserRouter></React.StrictMode>,
);
