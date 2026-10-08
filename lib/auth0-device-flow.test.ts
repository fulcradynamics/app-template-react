import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Auth0DeviceFlow } from './auth0-device-flow';

let fetchMock = vi.fn<typeof fetch>();
let client: Auth0DeviceFlow;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  client = new Auth0DeviceFlow({ domain: 'example.com', clientId: 'test', audience: 'test' });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('polls pending, slows down by five seconds, succeeds and clears local tokens on logout', async () => {
  const tokens = { access_token: 'test-access', refresh_token: 'test-refresh' };
  fetchMock
    .mockResolvedValueOnce(Response.json({ status: 400, data: { error: 'authorization_pending' } }))
    .mockResolvedValueOnce(Response.json({ status: 400, data: { error: 'slow_down' } }))
    .mockResolvedValueOnce(Response.json({ status: 200, data: tokens }));
  const result = client.pollForToken('device', 1);
  expect(fetchMock).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(5999);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toEqual(tokens);
  expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/device/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode: 'device' })
  });
  expect(await client.getTokenSilently()).toBe('test-access');
  expect(client.getRefreshToken()).toBe('test-refresh');
  await client.logout();
  expect(await client.isAuthenticated()).toBe(false);
  expect(client.getRefreshToken()).toBeNull();
  await expect(client.getTokenSilently()).rejects.toThrow('Not authenticated');
});

it.each(['denied', 'http', 'network'])('stops polling on %s errors', async (kind) => {
  if (kind === 'network') fetchMock.mockRejectedValue(new Error('Offline'));
  else
    fetchMock.mockResolvedValue(
      kind === 'http'
        ? new Response(null, { status: 500 })
        : Response.json({
            status: 400,
            data: { error: 'access_denied', error_description: 'Denied' }
          })
    );
  const result = expect(client.pollForToken('device', 1)).rejects.toThrow(
    kind === 'network' ? 'Offline' : kind === 'http' ? 'Failed to poll for token' : 'Denied'
  );
  await vi.advanceTimersByTimeAsync(1000);
  await result;
  await vi.advanceTimersByTimeAsync(10000);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(await client.isAuthenticated()).toBe(false);
});
