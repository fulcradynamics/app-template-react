import { afterEach, describe, expect, it, vi } from 'vitest';
import { FulcraAPI } from './api-client';

describe('FulcraAPI', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the request URL from endpoint + path and sends the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userid: 'abc' })
    });
    vi.stubGlobal('fetch', fetchMock);

    const api = new FulcraAPI('https://api.example.com/', 'token123');
    const result = await api.getUserInfo();

    expect(result).toEqual({ userid: 'abc' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/user/v1alpha1/info',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token123' })
      })
    );
  });

  it('throws with the status code on non-ok responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    );

    const api = new FulcraAPI('https://api.example.com/', 't');
    await expect(api.getUserInfo()).rejects.toThrow('404');
  });
});
