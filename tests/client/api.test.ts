import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, sendVote } from '@/lib/client/api';

const json = (status: number, body: object) =>
  new Response(JSON.stringify({ ...body, serverTime: Date.now() }), { status, headers: { 'content-type': 'application/json' } });

describe('sendVote (Review Focus 2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries after a network error and treats ALREADY_VOTED as success', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json(409, { error: { code: 'ALREADY_VOTED', message: '' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendVote('room0001', 'tok', { categoryId: 'pizza', value: 'yes' })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers['x-participant-token']).toBe('tok');
  });

  it('surfaces other errors with their code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(409, { error: { code: 'SUPER_ALREADY_USED', message: '' } })));
    await expect(sendVote('room0001', 'tok', { categoryId: 'pizza', value: 'super' })).rejects.toMatchObject({
      code: 'SUPER_ALREADY_USED',
    });
  });

  it('gives up after 3 network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(sendVote('room0001', 'tok', { categoryId: 'pizza', value: 'no' })).rejects.toBeInstanceOf(ApiError);
  });
});
