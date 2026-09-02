'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import LoginDeviceFlow from '@/components/LoginDeviceFlow';

export default function Home() {
  const user = useUser();
  const [preferences, setPreferences] = useState<{ timezone?: string } | null>(null);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  useEffect(() => {
    user.init();
    // Run once on mount; init() is internally guarded against re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPreferences() {
    setLoadingPreferences(true);
    try {
      const response = await fetch('/api/user/preferences');
      if (response.ok) {
        setPreferences(await response.json());
      } else {
        console.error('Failed to fetch preferences:', response.status);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoadingPreferences(false);
    }
  }

  if (!user.authenticated) {
    return <LoginDeviceFlow />;
  }

  return (
    <div className="flex h-full min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-6xl text-fulcra-teal">🚀</div>
        <h1 className="mb-2 text-3xl font-bold text-fulcra-white">Fulcra App Template</h1>
        <p className="text-fulcra-gray">A Next.js template for building on the Fulcra platform</p>
        <div className="mt-6">
          <p className="text-sm text-fulcra-gray">
            User ID:{' '}
            <span className="text-fulcra-teal">
              {String(user.auth0UserInfo['fulcradynamics.com/userid'] ?? '')}
            </span>
          </p>

          {preferences && (
            <p className="mt-2 text-sm text-fulcra-gray">
              Timezone:{' '}
              <span className="text-fulcra-teal">{preferences.timezone || 'Not set'}</span>
            </p>
          )}

          <div className="mt-4 flex justify-center gap-2">
            <button
              className="rounded-lg bg-fulcra-purple/20 px-4 py-2 text-fulcra-purple hover:bg-fulcra-purple/50 disabled:opacity-50"
              onClick={fetchPreferences}
              disabled={loadingPreferences}
            >
              {loadingPreferences ? 'Loading...' : 'Fetch Timezone'}
            </button>
            <button
              className="rounded-lg bg-fulcra-teal/20 px-4 py-2 text-fulcra-teal hover:bg-fulcra-teal/50"
              onClick={user.logout}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
