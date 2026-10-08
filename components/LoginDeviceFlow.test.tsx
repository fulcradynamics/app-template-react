// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LoginDeviceFlow from './LoginDeviceFlow';
import AuthGate from './AuthGate';
import Home from '@/app/page';
import { UserProvider } from '@/lib/user-context';

let fetchMock = vi.fn<typeof fetch>();
const authUser = { 'fulcradynamics.com/userid': 'test-user' };
const device = {
  device_code: 'device',
  user_code: 'ABCD',
  verification_uri_complete: 'https://example.com/verify',
  interval: 2,
  expires_in: 600
};

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value)
  });
  fetchMock = vi.fn(async (input) => {
    switch (input) {
      case '/api/auth/check':
        return Response.json({ authenticated: false });
      case '/api/auth/device/code':
        return Response.json(device);
      case '/api/auth/device/token':
        return Response.json({
          status: 200,
          data: { access_token: 'test-access', refresh_token: 'test-refresh' }
        });
      case '/api/auth/user':
        return Response.json(authUser);
      case '/api/user/info':
        return Response.json({ name: 'Test' });
      case '/api/auth/token':
      case '/api/auth/revoke':
        return Response.json({});
      default:
        throw new Error(`Unexpected URL ${input}`);
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('defaults to the existing branding', () => {
  render(
    <UserProvider>
      <LoginDeviceFlow />
    </UserProvider>
  );
  expect(screen.getByRole('heading', { name: 'Your App Name' })).toBeTruthy();
  expect(screen.getByText('your logo')).toBeTruthy();
  expect(screen.getByText('app_name')).toBeTruthy();
  expect(screen.queryByRole('img', { name: 'Your App Name' })).toBeNull();
});

it('merges partial branding with the configured defaults', () => {
  render(
    <UserProvider>
      <LoginDeviceFlow branding={{ appName: 'Orbit' }} />
    </UserProvider>
  );
  expect(screen.getByRole('heading', { name: 'Orbit' })).toBeTruthy();
  expect(
    screen.getByText("One line on what your app does with a person's Fulcra data.")
  ).toBeTruthy();
  expect(screen.getByText(/A starter template you can clone and build on/)).toBeTruthy();
  expect(screen.getByText('your logo')).toBeTruthy();
  expect(screen.getByText('app_name')).toBeTruthy();
  expect(screen.getByText(/Template slots on this screen/)).toBeTruthy();
});

it('hides template slots without requiring a custom logo', () => {
  render(
    <UserProvider>
      <LoginDeviceFlow branding={{ showSlots: false }} />
    </UserProvider>
  );
  expect(screen.getByRole('heading', { name: 'Your App Name' })).toBeTruthy();
  expect(screen.queryByText('your logo')).toBeNull();
  expect(screen.queryByText('app_name')).toBeNull();
  expect(screen.queryByText(/Template slots/)).toBeNull();
  expect(screen.queryByText(/Replace them in your fork/)).toBeNull();
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img', { name: 'Fulcra' }).getAttribute('src')).toBe('/app-icon_152.png');
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Create Account' })).toBeTruthy();
});

it('accepts custom branding and a logo without template slots', () => {
  render(
    <UserProvider>
      <LoginDeviceFlow
        branding={{
          appName: 'Orbit',
          tagline: 'Your day',
          description: 'A personal view',
          showSlots: false,
          logoSrc: '/orbit.svg'
        }}
      />
    </UserProvider>
  );
  expect(screen.getByRole('heading', { name: 'Orbit' })).toBeTruthy();
  expect(screen.getByText('Your day')).toBeTruthy();
  expect(screen.getByText('A personal view')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Orbit' }).getAttribute('src')).toBe('/orbit.svg');
  expect(screen.queryByText('your logo')).toBeNull();
  expect(screen.queryByText('app_name')).toBeNull();
  expect(screen.queryByText(/Template slots/)).toBeNull();
});

it.each([false, true])(
  'opens login synchronously and completes real login/logout (popup blocked: %s)',
  async (blocked) => {
    const popup = { closed: false, location: { href: '' }, close: vi.fn() };
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue(blocked ? null : (popup as unknown as Window));
    render(
      <UserProvider>
        <AuthGate>
          <Home />
        </AuthGate>
      </UserProvider>
    );
    await screen.findByRole('button', { name: 'Sign In' });
    vi.useFakeTimers();
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    // No awaiting: Safari requires window.open in the original click stack.
    expect(open).toHaveBeenCalledWith(
      'about:blank',
      'auth0-device-flow',
      'width=500,height=700,left=100,top=100'
    );
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    if (!blocked) expect(popup.location.href).toContain('/v2/logout');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(screen.getByText('ABCD')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open the verification page' }).getAttribute('href')
    ).toBe(device.verification_uri_complete);
    if (!blocked) expect(popup.location.href).toBe(device.verification_uri_complete);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'test-access' })
    });
    if (!blocked) expect(popup.close).toHaveBeenCalledOnce();
    open.mockClear();
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('/v2/logout'),
      'auth0-logout',
      'width=500,height=600,left=100,top=100'
    );
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'test-refresh' })
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/token', { method: 'DELETE' });
    expect(JSON.parse(localStorage.getItem('fulcraUserState')!)).toEqual({
      auth0UserInfo: {},
      fulcraUserInfo: {}
    });
    expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    if (!blocked) expect(popup.close).toHaveBeenCalledTimes(2);
  }
);

it('shows polling errors and returns to login', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  render(
    <UserProvider>
      <AuthGate>
        <Home />
      </AuthGate>
    </UserProvider>
  );
  await screen.findByRole('button', { name: 'Sign In' });
  vi.useFakeTimers();
  fetchMock.mockResolvedValueOnce(Response.json(device)).mockResolvedValueOnce(
    Response.json({
      status: 400,
      data: { error: 'access_denied', error_description: 'User declined' }
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.getByText('User declined')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();
});
