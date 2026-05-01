import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../src/domain/errors.js';
import { FakeStoreApiDataSource } from '../src/infrastructure/datasources/fakestoreapi-data-source.js';
import type { HttpClient } from '../src/infrastructure/http/http-client.js';

function fakeHttp(payload: unknown): HttpClient {
  return { getJson: vi.fn().mockResolvedValue(payload) } as unknown as HttpClient;
}

describe('FakeStoreApiDataSource', () => {
  it('maps FakeStore products into RawCampaign shape using rating.rate', async () => {
    const http = fakeHttp([
      { id: 1, title: 'Phone', rating: { rate: 4.6, count: 120 } },
      { id: 2, title: 'Shirt', rating: { rate: 2.1, count: 430 } },
      { id: 3, title: 'Watch', rating: { rate: 0.8, count: 10 } },
    ]);

    const ds = new FakeStoreApiDataSource(http);
    const result = await ds.fetchCampaigns({ limit: 3 });

    expect(result).toEqual([
      { id: '1', name: 'Phone', metric: 4.6 },
      { id: '2', name: 'Shirt', metric: 2.1 },
      { id: '3', name: 'Watch', metric: 0.8 },
    ]);
  });

  it('throws ValidationError when payload does not match the schema', async () => {
    const http = fakeHttp([{ id: 'not-a-number', title: '', rating: 'oops' }]);
    const ds = new FakeStoreApiDataSource(http);
    await expect(ds.fetchCampaigns()).rejects.toBeInstanceOf(ValidationError);
  });
});
