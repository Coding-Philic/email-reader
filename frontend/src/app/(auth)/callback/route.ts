import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';

  if (code) {
    // Create the redirect response ahead of time so cookie setters can attach headers to it
    const response = NextResponse.redirect(new URL(next, request.url));

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
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { provider_token, provider_refresh_token, access_token } = data.session;

      // Send Gmail tokens to backend if available
      if (provider_token) {
        try {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
          await fetch(`${backendUrl}/api/auth/gmail/connect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${access_token}`,
            },
            body: JSON.stringify({
              access_token: provider_token,
              refresh_token: provider_refresh_token || null,
            }),
          });
        } catch (backendErr) {
          console.error('Error sending Gmail tokens to backend:', backendErr);
        }
      }

      return response;
    } else {
      console.error('Error exchanging code for session in route handler:', error);
    }
  }

  // If code exchange failed or no code present, redirect back to login
  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
}
