import { createClient } from '@supabase/supabase-js';

const url = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const key = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

if (!url || !key) {
  throw new Error(
    'Faltan variables de entorno de Supabase.\n\n' +
    'REACT_APP_SUPABASE_URL = "' + url + '"\n' +
    'REACT_APP_SUPABASE_ANON_KEY = "' + (key ? key.slice(0,20)+'...' : '(vacía)') + '"\n\n' +
    'Ve a Vercel > Settings > Environment Variables y verifica que ambas estén escritas exactamente así, sin espacios ni comillas, luego vuelve a desplegar (Redeploy).'
  );
}

export const supabase = createClient(url, key);
