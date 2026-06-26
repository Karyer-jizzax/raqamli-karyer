import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupI18n } from '@karier/i18n';
import { AuthProvider } from '@karier/ui';
import '@karier/ui/globals.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

setupI18n();
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
