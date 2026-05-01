import { describe, expect, it, vi } from 'vitest';
import {
  findWorstRoasCampaignsByOperator,
  type CampaignRoasPrismaClient,
} from '../src/application/find-worst-roas-campaigns.js';

describe('findWorstRoasCampaignsByOperator', () => {
  it('filters the last 7 days, averages ROAS by campaign and groups results by operator', async () => {
    const now = new Date('2026-05-01T12:00:00.000Z');
    const prisma: CampaignRoasPrismaClient = {
      campaignMetric: {
        groupBy: vi.fn().mockResolvedValue([
          { campaignId: 'c2', _avg: { roas: 0.4 } },
          { campaignId: 'c3', _avg: { roas: 0.8 } },
          { campaignId: 'c1', _avg: { roas: 1.2 } },
          { campaignId: 'c4', _avg: { roas: null } },
        ]),
      },
      campaign: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'c1', name: 'Search Ads', operator: { id: 'op-a', name: 'Operator A' } },
          { id: 'c2', name: 'Display Ads', operator: { id: 'op-a', name: 'Operator A' } },
          { id: 'c3', name: 'Social Ads', operator: { id: 'op-b', name: 'Operator B' } },
        ]),
      },
    };

    const result = await findWorstRoasCampaignsByOperator(prisma, { now });

    expect(prisma.campaignMetric.groupBy).toHaveBeenCalledWith({
      by: ['campaignId'],
      where: { recordedAt: { gte: new Date('2026-04-24T12:00:00.000Z') } },
      _avg: { roas: true },
      orderBy: { _avg: { roas: 'asc' } },
    });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['c2', 'c3', 'c1'] } },
      select: {
        id: true,
        name: true,
        operator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    expect(result).toEqual([
      {
        operator: { id: 'op-a', name: 'Operator A' },
        campaigns: [
          { id: 'c2', name: 'Display Ads', averageRoas: 0.4 },
          { id: 'c1', name: 'Search Ads', averageRoas: 1.2 },
        ],
      },
      {
        operator: { id: 'op-b', name: 'Operator B' },
        campaigns: [{ id: 'c3', name: 'Social Ads', averageRoas: 0.8 }],
      },
    ]);
  });

  it('can limit the number of campaigns returned per operator', async () => {
    const prisma: CampaignRoasPrismaClient = {
      campaignMetric: {
        groupBy: vi.fn().mockResolvedValue([
          { campaignId: 'c1', _avg: { roas: 0.2 } },
          { campaignId: 'c2', _avg: { roas: 0.4 } },
        ]),
      },
      campaign: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'c1', name: 'Search Ads', operator: { id: 'op-a', name: 'Operator A' } },
          { id: 'c2', name: 'Display Ads', operator: { id: 'op-a', name: 'Operator A' } },
        ]),
      },
    };

    const result = await findWorstRoasCampaignsByOperator(prisma, { takePerOperator: 1 });

    expect(result[0]?.campaigns).toEqual([{ id: 'c1', name: 'Search Ads', averageRoas: 0.2 }]);
  });
});
