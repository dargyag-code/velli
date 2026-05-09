import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type RequireUserResult =
  | { user: User; supabase: SupabaseClient; response?: never }
  | { response: Response; user?: never; supabase?: never };

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      response: Response.json(
        { error: 'No autenticado' },
        { status: 401 }
      ),
    };
  }
  return { user, supabase };
}
