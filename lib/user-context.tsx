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

/**
 * End the Auth0 SSO session by loading its /v2/logout endpoint in a hidden
 * iframe (no popup, no visible UI). Used both before login (to force the user to
 * actively authenticate instead of silently reusing an SSO session) and on
 * logout. We deliberately omit `returnTo` so Auth0 does NOT require the URL to
 * be in the app's "Allowed Logout URLs". Resolves after a short delay to give
 * the request a moment to clear the session.
 */
function clearAuth0Session(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    const logoutUrl = `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/v2/logout`;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = logoutUrl;
    document.body.appendChild(iframe);

    // Give it a moment to complete, then remove the iframe
    setTimeout(() => {
      document.body.removeChild(iframe);
      resolve();
    }, 1000);
  });
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
   * Grab user info from Auth0 & the Fulcra API via server routes. Both read the
   * HTTP-only cookie server-side, so this works even after a reload when the
   * in-memory token is gone.
   */
  const getUser = useCallback(async () => {
    // Get Auth0 user info from server (uses HTTP-only cookie)
    const auth0Response = await fetch('/api/auth/user');
    if (!auth0Response.ok) {
      throw new Error('Failed to fetch Auth0 user info');
    }
    const userInfo = await auth0Response.json();

    // Get Fulcra user info from server (uses HTTP-only cookie)
    const fulcraResponse = await fetch('/api/user/info');
    if (!fulcraResponse.ok) {
      throw new Error('Failed to fetch Fulcra user info');
    }
    const fulcraUserInfo = await fulcraResponse.json();

    setAndPersist({ auth0UserInfo: userInfo, fulcraUserInfo });
  }, [setAndPersist]);

  /**
   * Initializes a user session; sets up the Auth0 device-flow client and restores
   * the session from the HTTP-only access-token cookie when one is present.
   */
  const init = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

    auth0Ref.current = new Auth0DeviceFlow({
      domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN!,
      clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!,
      audience: process.env.NEXT_PUBLIC_FULCRA_API_ENDPOINT!
    });

    // Check if we have a valid access token cookie (server-side check)
    try {
      const response = await fetch('/api/auth/check');
      const { authenticated } = await response.json();

      if (authenticated) {
        // We have a valid cookie, restore the user session
        await getUser();
      } else {
        // No valid session, clear persisted user info
        clearUser();
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      clearUser();
    }
  }, [clearUser, getUser]);

  const startLogin = useCallback(async () => {
    try {
      // FIRST: clear any existing Auth0 SSO session so the user must actively
      // authenticate (no silent SSO reuse; forces account selection).
      await clearAuth0Session();

      // NOW start the device flow - user will need to actively authenticate
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
    // cleared server-side). We use a hidden iframe (no popup, no visible UI).
    void clearAuth0Session();
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
