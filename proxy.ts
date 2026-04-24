import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith('/auth');
  const isPublicRoute = isAuthRoute || path.startsWith('/legal');
  // /auth/reset-password necesita una sesión de recuperación activa: no debe
  // redirigirse a / aunque el usuario ya esté "autenticado" por el token de
  // recuperación.
  const isPasswordRecoveryRoute = path === '/auth/reset-password';

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute && !isPasswordRecoveryRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Excluir: _next/static, _next/image, api, y cualquier archivo con extensión
    // (.*\..*) — esto cubre manifest.json, sw.js, favicon.ico, icons/*.png,
    // *.svg, *.webp, etc. de forma automática. /auth NO se excluye aquí porque
    // el handler de arriba tiene lógica específica (redirige si ya hay sesión).
    '/((?!_next/static|_next/image|api|.*\\..*).*)',
  ],
};
