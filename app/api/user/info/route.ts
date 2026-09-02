import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { FulcraAPI } from '@/lib/api-client';

/**
 * Server-side endpoint to fetch user info from Fulcra API
 * Uses FulcraAPI for organized API access
 */
export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('fulcra_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const apiClient = new FulcraAPI(process.env.NEXT_PUBLIC_FULCRA_API_ENDPOINT!, accessToken);

    // Try to get user info
    try {
      const userInfo = await apiClient.getUserInfo();
      return NextResponse.json(userInfo);
    } catch (err) {
      // If user doesn't exist (404), register them first
      if (err instanceof Error && err.message.includes('404')) {
        console.log('User not found, registering new user...');

        // Register user using low-level post method
        await apiClient.post('user/v0/register', {});

        console.log('User registered successfully, fetching user info...');

        // Now fetch user info again
        const userInfo = await apiClient.getUserInfo();
        return NextResponse.json(userInfo);
      }

      // Re-throw other errors
      throw err;
    }
  } catch (err) {
    console.error('Error fetching user info:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch user info';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
