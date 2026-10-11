import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthConfiguration } from '../../../shared/saas';
const clients = new Map<string, SupabaseClient>();
const recovery = new WeakMap<SupabaseClient, boolean>();
const startup = new WeakMap<SupabaseClient, Promise<{ error: Error | null }>>();
/** One official client and one PKCE exchange, including under React StrictMode. */
export function authClient(config: Extract<AuthConfiguration, { mode: 'saas' }>) {
  const key = config.url + '|' + config.anonKey;
  let client = clients.get(key);
  if (!client) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    const current = client;
    current.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') recovery.set(current, true);
      if (event === 'SIGNED_OUT') recovery.set(current, false);
    });
    const callback = new URL(location.href),
      code = callback.searchParams.get('code');
    const recoveryRequested =
      callback.pathname === '/auth/callback' && callback.searchParams.get('intent') === 'recovery';
    startup.set(
      current,
      (async () => {
        const initialized = await current.auth.initialize();
        if (initialized.error) return { error: initialized.error };
        if (callback.searchParams.has('error') || callback.hash.includes('error='))
          return { error: new Error('Link de acesso inválido ou expirado.') };
        if (code) {
          // Public SDK API, no private-method patch. Automatic exchange in auth-js 2.99 drops recovery type.
          const result = await current.auth.exchangeCodeForSession(code);
          callback.searchParams.delete('code');
          history.replaceState(
            history.state,
            '',
            callback.pathname + callback.search + callback.hash,
          );
          if (result.error) {
            recovery.set(current, false);
            return { error: result.error };
          }
          // intent selects UI only. The actual JWT returned by Auth authorizes the password update.
          recovery.set(current, recoveryRequested);
        }
        return { error: null };
      })(),
    );
    clients.set(key, current);
  }
  return client;
}
export const initializeAccess = (client: SupabaseClient) => startup.get(client)!;
export const recoveryPending = (client: SupabaseClient) => recovery.get(client) === true;
export function finishRecovery(client: SupabaseClient) {
  recovery.set(client, false);
  const url = new URL(location.href);
  url.searchParams.delete('intent');
  for (const name of ['error', 'error_code', 'error_description']) url.searchParams.delete(name);
  if (new URLSearchParams(url.hash.slice(1)).has('error')) url.hash = '';
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}
