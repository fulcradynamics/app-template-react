import { NextResponse } from 'next/server';

/**
 * Server-side proxy for Auth0 device token endpoint
 * Bypasses CORS by making the request server-side
 */
export async function POST(request: Request) {
  const { deviceCode } = await request.json();

  if (!deviceCode) {
    return NextResponse.json({ error: 'Device code required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
        client_id: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID
      })
    });

    const data = await response.json();

    // Return the response data along with status.
    // Client will handle authorization_pending, slow_down, etc.
    return NextResponse.json({ status: response.status, data });
  } catch (err) {
    console.error('Device token error:', err);
    return NextResponse.json({ error: 'Failed to poll for token' }, { status: 500 });
  }
}
