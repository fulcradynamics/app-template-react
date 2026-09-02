'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Auth0DeviceFlow, type VerificationInfo } from './auth0-device-flow';

/**
 * User/auth state for the app. This is the React equivalent of the Svelte
 * template's `user` store: it wraps our two sources of user info (Auth0 and the
 * Fulcra API) and exposes the login/logout/session methods on top of them.
 *
 * The access token itself is never held here — it lives in an HTTP-only cookie
 * set by the server routes. Only the (non-secret) user-info objects are kept in
 * state and mirrored to localStorage under `fulcraUserState`.
 */

const STORAGE_KEY = 'fulcraUserState';

interface UserState {
  auth0UserInfo: Record<string, unknown>;
  fulcraUserInfo: Record<string, unknown>;
}

interface UserContextValue extends UserState {
  /** Derived from the presence of the Fulcra user id claim in the Auth0 user info. */
  authenticated: boolean;
  /** Initialize the session. Call this once at the top level (e.g. in a page effect). */
  init: () => Promise<void>;
  /** Start the device flow; returns verification info for the UI to display. */
  startLogin: () => Promise<VerificationInfo>;
  /** Poll for the token after the user has seen the verification URL, then load the user. */
  completeLogin: (deviceCode: string, interval?: number) => Promise<void>;
  /** Fully log out: revoke refresh token, clear cookie + local state, end the Auth0 session. */
  logout: () => Promise<void>;
}

const emptyState: UserState = { auth0UserInfo: {}, fulcraUserInfo: {} };

/**
 * Persist only the user-info objects to localStorage. Mirrors the Svelte
 * template's `toJSON` behavior. No-op during SSR.
 */
function persist(state: UserState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ auth0UserInfo: state.auth0UserInfo, fulcraUserInfo: state.fulcraUserInfo })
  );
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserState>(emptyState);

  // Private client for Auth0; init() initializes this.
  const auth0Ref = useRef<Auth0DeviceFlow | null>(null);
  // Guards against React Strict Mode double-invoking init() in development.
  const initialized = useRef(false);

  const setAndPersist = useCallback((next: UserState) => {
    persist(next);
    setState(next);
  }, []);

  const clearUser = useCallback(() => {
    setAndPersist(emptyState);
  }, [setAndPersist]);

  /**
   * Grab user info from Auth0 (client-side) & the Fulcra API (via server route).
   */
  const getUser = useCallback(async () => {
    const auth0 = auth0Ref.current!;
    const userInfo = await auth0.getUser();

    // Call server route instead of the Fulcra API directly
    const response = await fetch('/api/user/info');
    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }
    const fulcraUserInfo = await response.json();

    setAndPersist({ auth0UserInfo: userInfo, fulcraUserInfo });
  }, [setAndPersist]);

  /**
   * Initializes a user session; sets up the Auth0 device-flow client. Because the
   * in-memory token is gone on a fresh load, this clears any stale persisted user
   * info (matching the Svelte template's behavior).
   */
  const init = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

    auth0Ref.current = new Auth0DeviceFlow({
      domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN!,
      clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!,
      audience: process.env.NEXT_PUBLIC_FULCRA_API_ENDPOINT!
    });

    // No in-memory session on a fresh load → clear any persisted user info.
    if (!(await auth0Ref.current.isAuthenticated())) {
      clearUser();
    }
  }, [clearUser]);

  const startLogin = useCallback(async () => {
    try {
      return await auth0Ref.current!.startDeviceFlow();
    } catch (error) {
      console.error('Failed to start device flow:', error);
      throw error;
    }
  }, []);

  const completeLogin = useCallback(
    async (deviceCode: string, interval?: number) => {
      try {
        const auth0 = auth0Ref.current!;
        await auth0.pollForToken(deviceCode, interval);

        // Store access token in an HTTP-only cookie via server route
        const accessToken = await auth0.getTokenSilently();
        await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken })
        });

        await getUser();
      } catch (error) {
        console.error('Failed to complete login:', error);
        throw error;
      }
    },
    [getUser]
  );

  const logout = useCallback(async () => {
    const auth0 = auth0Ref.current;

    // Grab the refresh token before we clear local state so we can revoke it
    const refreshToken = auth0?.getRefreshToken?.();

    // Revoke the refresh token at Auth0 so it can no longer mint access tokens.
    // Best-effort: never block logout on this (proxied server-side to avoid CORS).
    if (refreshToken) {
      try {
        await fetch('/api/auth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      } catch (error) {
        console.error('Failed to revoke refresh token:', error);
      }
    }

    // Clear the app's access token cookie
    await fetch('/api/auth/token', { method: 'DELETE' });

    // Clear the local client + persisted user state
    await auth0?.logout();
    clearUser();

    // Finally, end the Auth0 SSO session itself. Without it the next sign-in
    // could silently reuse the still-active session. This must run in a browser
    // context (the SSO cookie is first-party to the Auth0 domain and can't be
    // cleared server-side). We deliberately omit `returnTo` so Auth0 does NOT
    // require the URL to be in the app's "Allowed Logout URLs" — the tradeoff
    // is that the popup briefly shows Auth0's default page, so we just close it
    // on a short timer once the request has had a moment to clear the session.
    if (typeof window !== 'undefined') {
      const logoutUrl = `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/v2/logout`;
      const popup = window.open(logoutUrl, 'auth0-logout', 'width=500,height=600,left=100,top=100');
      if (popup) {
        setTimeout(() => {
          if (!popup.closed) popup.close();
        }, 2000);
      }
    }
  }, [clearUser]);

  const value = useMemo<UserContextValue>(
    () => ({
      ...state,
      authenticated: 'fulcradynamics.com/userid' in state.auth0UserInfo,
      init,
      startLogin,
      completeLogin,
      logout
    }),
    [state, init, startLogin, completeLogin, logout]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}
