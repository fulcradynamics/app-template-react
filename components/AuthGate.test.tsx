// @vitest-environment jsdom
import { StrictMode, useEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RootLayout from '@/app/layout';
import * as userContext from '@/lib/user-context';

vi.mock('next/font/google', () => ({ Rubik: () => ({ variable: 'rubik' }) }));
vi.mock('@/app/globals.css', () => ({}));

const authUser = { 'fulcradynamics.com/userid': 'restored-user' };
const emptyUser = { auth0UserInfo: {}, fulcraUserInfo: {} };
let mounted = vi.fn<() => void>();
let fetchMock = vi.fn<typeof fetch>();

function Feature() {
  useEffect(() => {
    mounted();
  }, []);
  return <div>Private feature</div>;
}

function renderRoot() {
  // Exercise the actual layout's provider/gate tree without nesting html/body in a div.
  const layout = RootLayout({ children: <Feature /> });
  return render(<StrictMode>{layout.props.children.props.children}</StrictMode>);
}

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value)
  });
  mounted = vi.fn();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('withholds children and login through StrictMode replay until the full server session restores', async () => {
  let resolveCheck!: (value: Response) => void;
  let resolveUser!: (value: Response) => void;
  let resolveFulcra!: (value: Response) => void;
  fetchMock.mockImplementation((url) => {
    if (url === '/api/auth/check')
      return new Promise<Response>((r) => {
        resolveCheck = r;
      });
    if (url === '/api/auth/user')
      return new Promise<Response>((r) => {
        resolveUser = r;
      });
    if (url === '/api/user/info')
      return new Promise<Response>((r) => {
        resolveFulcra = r;
      });
    throw new Error(`Unexpected URL ${url}`);
  });
  renderRoot();
  await act(async () => {});
  expect(screen.queryByText('Private feature')).toBeNull();
  expect(mounted).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Create Account' })).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveCheck(Response.json({ authenticated: true }));
  });
  expect(mounted).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
  await act(async () => {
    resolveUser(Response.json(authUser));
  });
  expect(mounted).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
  await act(async () => {
    resolveFulcra(Response.json({ name: 'Restored' }));
  });
  expect(screen.getByText('Private feature')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem('fulcraUserState')!).auth0UserInfo).toEqual(authUser);
});

it.each([false, true])(
  'shows a safe initialization error when storage throws (server authenticated: %s)',
  async (authenticated) => {
    const cached = JSON.stringify({ auth0UserInfo: authUser, fulcraUserInfo: {} });
    localStorage.setItem('fulcraUserState', cached);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Sensitive storage failure details', 'SecurityError');
    });
    fetchMock.mockImplementation(async (url) => {
      if (url === '/api/auth/check') return Response.json({ authenticated });
      if (url === '/api/auth/user') return Response.json(authUser);
      if (url === '/api/user/info') return Response.json({ name: 'Restored' });
      throw new Error(`Unexpected URL ${url}`);
    });
    renderRoot();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/unable to restore your session/i);
    expect(alert.textContent).toMatch(/reload/i);
    expect(alert.textContent).not.toContain('Sensitive storage failure details');
    expect(setItem).toHaveBeenCalled();
    expect(localStorage.getItem('fulcraUserState')).toBe(cached);
    expect(mounted).not.toHaveBeenCalled();
    expect(screen.queryByText('Private feature')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
  }
);

it('withholds children on rejection even when the context is already authenticated', async () => {
  // The actual provider does not restore cached state; explicitly exercise this
  // gate invariant independently of that current provider behavior.
  const init = vi.fn().mockRejectedValue(new Error('Sensitive failure details'));
  vi.spyOn(userContext, 'useUser').mockReturnValue({
    auth0UserInfo: authUser,
    fulcraUserInfo: {},
    authenticated: true,
    init,
    startLogin: vi.fn(),
    completeLogin: vi.fn(),
    logout: vi.fn()
  });
  renderRoot();
  expect((await screen.findByRole('alert')).textContent).toMatch(/reload/i);
  expect(mounted).not.toHaveBeenCalled();
  expect(screen.queryByText('Private feature')).toBeNull();
  expect(init).toHaveBeenCalledOnce();
});

it.each([false, true])(
  'ignores initialization settling after unmount (storage rejection: %s)',
  async (reject) => {
    let resolveCheck!: (value: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveCheck = resolve;
        })
    );
    if (reject) {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage unavailable', 'SecurityError');
      });
    }
    const { unmount, container } = renderRoot();
    unmount();
    await act(async () => {
      resolveCheck(Response.json({ authenticated: false }));
    });
    expect(container.innerHTML).toBe('');
    expect(mounted).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
  }
);

it.each(['stale', 'invalid JSON', 'check error', 'user error'])(
  'isolates children and clears %s persisted state',
  async (scenario) => {
    localStorage.setItem(
      'fulcraUserState',
      scenario === 'invalid JSON'
        ? '{broken'
        : JSON.stringify({ auth0UserInfo: authUser, fulcraUserInfo: {} })
    );
    fetchMock.mockImplementation(async (url) => {
      if (scenario === 'check error') throw new Error('Offline');
      if (url === '/api/auth/check')
        return Response.json({ authenticated: scenario === 'user error' });
      return new Response(null, { status: 401 });
    });
    renderRoot();
    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeTruthy();
    expect(mounted).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('fulcraUserState')!)).toEqual(emptyUser);
  }
);
