import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Server-side endpoint to store the Auth0 access token in an HTTP-only cookie
 * Called after successful Auth0 authentication from the client
 */
export async function POST(request: Request) {
  const { accessToken } = await request.json();

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 400 });
  }

  // Store token in HTTP-only cookie (more secure than localStorage)
  // Security settings ensure cookie is only accessible from this domain:
  // - httpOnly: JavaScript cannot access the cookie (XSS protection)
  // - secure: Only sent over HTTPS in production. Off in dev because Safari
  //   refuses to store a Secure cookie over plain http://localhost, which would
  //   silently drop the session during local development.
  // - sameSite: 'lax': all auth calls are same-origin fetches, so lax is
  //   sufficient and avoids Safari's stricter handling of 'strict' cookies.
  // - path: '/': Available to all routes on this domain only
  const cookieStore = await cookies();
  cookieStore.set('fulcra_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE endpoint to clear the access token cookie (logout)
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: 'fulcra_access_token', path: '/' });
  return NextResponse.json({ success: true });
}
