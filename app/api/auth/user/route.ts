import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Server-side endpoint to get Auth0 user info
 * Uses the access token from the HTTP-only cookie
 */
export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('fulcra_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const response = await fetch(`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to get user info from Auth0' },
        { status: response.status }
      );
    }

    const userInfo = await response.json();
    return NextResponse.json(userInfo);
  } catch (err) {
    console.error('Error fetching Auth0 user info:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch Auth0 user info';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
