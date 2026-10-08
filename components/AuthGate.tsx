'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useUser } from '@/lib/user-context';
import LoginDeviceFlow from './LoginDeviceFlow';

export default function AuthGate({ children }: { children: ReactNode }) {
  const { init, authenticated } = useUser();
  const initialization = useRef<Promise<void> | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Share the real restoration promise across StrictMode effect replay. A second
    // call to the provider's guarded init() would resolve before restoration ends.
    initialization.current ??= init();
    void initialization.current.then(
      () => {
        if (!cancelled) setReady(true);
      },
      () => {
        if (!cancelled) setFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [init]);

  if (failed) {
    return <p role="alert">Unable to restore your session. Please reload the page to try again.</p>;
  }
  if (!ready) return null;
  return authenticated ? children : <LoginDeviceFlow />;
}
