import { z } from 'zod';
import type { RawCampaign } from '../../domain/campaign-report.js';
import { ValidationError } from '../../domain/errors.js';
import type { HttpClient } from '../http/http-client.js';
import type { FetchCampaignsParams, ICampaignDataSource } from './campaign-data-source.js';

const ProductSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string().min(1),
  rating: z.number(),
});

const ProductsResponseSchema = z.object({
  products: z.array(ProductSchema),
  total: z.number().int().nonnegative(),
});

export type DummyJsonDataSourceOptions = {
  readonly defaultLimit: number;
};

const DEFAULT_LIMIT = 30;

export class DummyJsonDataSource implements ICampaignDataSource {
  readonly name = 'dummyjson';

  constructor(
    private readonly http: HttpClient,
    private readonly options: DummyJsonDataSourceOptions = { defaultLimit: DEFAULT_LIMIT },
  ) {}

  async fetchCampaigns(params: FetchCampaignsParams = {}): Promise<RawCampaign[]> {
    const limit = params.limit ?? this.options.defaultLimit;
    const raw = await this.http.getJson<unknown>(`/products?limit=${encodeURIComponent(String(limit))}`);

    const parsed = ProductsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('DummyJSON response did not match expected schema', {
        cause: parsed.error,
      });
    }

    return parsed.data.products.map((p) => ({
      id: String(p.id),
      name: p.title,
      metric: p.rating,
    }));
  }
}
