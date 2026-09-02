import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { FulcraAPI } from '@/lib/api-client';

/**
 * Server-side endpoint to fetch user preferences from Fulcra API
 * Demonstrates using FulcraAPI's high-level methods
 */
export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('fulcra_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const apiClient = new FulcraAPI(process.env.NEXT_PUBLIC_FULCRA_API_ENDPOINT!, accessToken);
    const preferences = await apiClient.getUserPreferences();
    return NextResponse.json(preferences);
  } catch (err) {
    console.error('Error fetching user preferences:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch user preferences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
