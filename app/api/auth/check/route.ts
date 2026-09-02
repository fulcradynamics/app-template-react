import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Check if user has a valid access token cookie
 * Returns authenticated status without exposing the token to the client
 */
export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('fulcra_access_token')?.value;

  return NextResponse.json({
    authenticated: !!accessToken
  });
}
