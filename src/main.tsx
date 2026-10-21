import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { supabase } from '@/services/supabaseClient';

// Supabase email links (password reset, email confirmation) come back as
// "#access_token=...&type=recovery". That clashes with HashRouter, so we let
// Supabase read the token first, then move to the correct app route.
async function handleAuthRedirect() {
  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  if (!raw || raw.startsWith('/')) return;
  const params = new URLSearchParams(raw);
  const error = params.get('error_description');
  if (!params.get('access_token') && !error) return;

  await supabase.auth.getSession();

  const base = `${window.location.pathname}${window.location.search}`;
  if (error) {
    window.history.replaceState(null, '', `${base}#/reset-password?error=${encodeURIComponent(error)}`);
  } else if (params.get('type') === 'recovery') {
    window.history.replaceState(null, '', `${base}#/reset-password`);
  } else {
    window.history.replaceState(null, '', `${base}#/login`);
  }
}

handleAuthRedirect().finally(() => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
});
