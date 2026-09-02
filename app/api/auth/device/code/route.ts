import { NextResponse } from 'next/server';

/**
 * Server-side proxy for Auth0 device authorization endpoint
 * Bypasses CORS by making the request server-side
 */
export async function POST() {
  try {
    const response = await fetch(
      `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/oauth/device/code`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
          audience: process.env.NEXT_PUBLIC_FULCRA_API_ENDPOINT,
          scope: 'openid profile email offline_access'
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error_description || 'Failed to start device flow' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Device code error:', err);
    return NextResponse.json({ error: 'Failed to start device flow' }, { status: 500 });
  }
}
