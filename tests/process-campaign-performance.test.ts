import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../src/domain/errors.js';
import {
  fetchCampaignData,
  findLowCtrCampaigns,
  processCampaigns,
  type CampaignDataFetcher,
} from '../src/application/process-campaign-performance.js';

function makeFetcher(payloads: Readonly<Record<string, unknown>>): CampaignDataFetcher {
  return {
    fetchCampaignData: vi.fn(async (campaignId: string) => payloads[campaignId]),
  };
}

describe('campaign performance processing', () => {
  it('fetches and calculates CTR from a validated payload', async () => {
    const fetcher = makeFetcher({ a: { id: 'a', clicks: 20, impressions: 1_000 } });
    await expect(fetchCampaignData('a', fetcher)).resolves.toEqual({
      id: 'a',
      clicks: 20,
      impressions: 1_000,
      ctr: 0.02,
    });
  });

  it('rejects invalid campaign payloads and impossible CTR inputs', async () => {
    const invalidPayload = makeFetcher({ a: { id: 'a', clicks: '20', impressions: 1_000 } });
    await expect(fetchCampaignData('a', invalidPayload)).rejects.toBeInstanceOf(ValidationError);

    const impossibleCtr = makeFetcher({ b: { id: 'b', clicks: 1, impressions: 0 } });
    await expect(fetchCampaignData('b', impossibleCtr)).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns campaigns with CTR below the threshold ordered from lower to higher CTR', () => {
    const result = findLowCtrCampaigns([
      { id: 'a', clicks: 1, impressions: 50, ctr: 0.02 },
      { id: 'b', clicks: 1, impressions: 200, ctr: 0.005 },
      { id: 'c', clicks: 1, impressions: 100, ctr: 0.01 },
    ]);

    expect(result.map((campaign) => campaign.id)).toEqual(['b', 'c']);
  });

  it('processes campaigns with controlled concurrency capped at 3', async () => {
    let active = 0;
    let maxActive = 0;
    const fetcher: CampaignDataFetcher = {
      fetchCampaignData: vi.fn(async (campaignId: string) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return { id: campaignId, clicks: 1, impressions: 100 };
      }),
    };

    const result = await processCampaigns(['a', 'b', 'c', 'd', 'e'], fetcher, { concurrency: 10 });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(result.map((campaign) => campaign.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(fetcher.fetchCampaignData).toHaveBeenCalledTimes(5);
  });
});
