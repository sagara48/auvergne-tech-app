import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables Supabase manquantes. Vérifiez votre fichier .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',                        // PKCE flow (plus sécurisé que implicit)
    storageKey: 'auvergne-tech-auth',        // Namespace dédié (évite collisions)
    storage: localStorage,                    // Explicite
  },
  global: {
    headers: {
      'X-Client-Info': 'auvergne-tech-app',  // Identifier le client côté serveur
    },
  },
  db: {
    schema: 'public',
  },
});

// Helper pour gérer les erreurs Supabase
export function handleSupabaseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Une erreur est survenue';
}
