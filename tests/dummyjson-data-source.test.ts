import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../src/domain/errors.js';
import { DummyJsonDataSource } from '../src/infrastructure/datasources/dummyjson-data-source.js';
import type { HttpClient } from '../src/infrastructure/http/http-client.js';

function fakeHttp(payload: unknown): HttpClient {
  return { getJson: vi.fn().mockResolvedValue(payload) } as unknown as HttpClient;
}

describe('DummyJsonDataSource', () => {
  it('maps DummyJSON products into RawCampaign shape', async () => {
    const http = fakeHttp({
      total: 2,
      products: [
        { id: 1, title: 'Phone', rating: 4.6 },
        { id: 2, title: 'Laptop', rating: 0.8 },
      ],
    });

    const ds = new DummyJsonDataSource(http);
    const result = await ds.fetchCampaigns({ limit: 2 });

    expect(result).toEqual([
      { id: '1', name: 'Phone', metric: 4.6 },
      { id: '2', name: 'Laptop', metric: 0.8 },
    ]);
  });

  it('throws ValidationError when payload does not match the schema', async () => {
    const http = fakeHttp({ products: [{ id: 'not-a-number', title: '', rating: 'oops' }] });
    const ds = new DummyJsonDataSource(http);
    await expect(ds.fetchCampaigns()).rejects.toBeInstanceOf(ValidationError);
  });
});
