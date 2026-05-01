import { describe, expect, it, vi } from 'vitest';
import { EvaluateCampaignsUseCase } from '../src/application/evaluate-campaigns.js';
import type { RawCampaign } from '../src/domain/campaign-report.js';
import type { ICampaignDataSource } from '../src/infrastructure/datasources/campaign-data-source.js';
import type { ICampaignRepository } from '../src/infrastructure/storage/campaign-repository.js';

function makeDataSource(rawCampaigns: RawCampaign[]): ICampaignDataSource {
  return {
    name: 'fake',
    fetchCampaigns: vi.fn().mockResolvedValue(rawCampaigns),
  };
}

function makeRepository(): ICampaignRepository & { saved: unknown[] } {
  const saved: unknown[] = [];
  return {
    saved,
    save: vi.fn().mockImplementation(async (reports) => {
      saved.push(reports);
    }),
  };
}

describe('EvaluateCampaignsUseCase', () => {
  const fixedDate = new Date('2026-05-01T10:00:00.000Z');

  it('classifies campaigns and persists them', async () => {
    const dataSource = makeDataSource([
      { id: '1', name: 'Alpha', metric: 0.5 },
      { id: '2', name: 'Beta', metric: 1.5 },
      { id: '3', name: 'Gamma', metric: 4.7 },
    ]);
    const repository = makeRepository();

    const useCase = new EvaluateCampaignsUseCase({
      dataSource,
      repository,
      thresholds: { warning: 2.5, critical: 1.0 },
      clock: () => fixedDate,
    });

    const { reports, summary } = await useCase.execute();

    expect(reports).toEqual([
      { id: '1', name: 'Alpha', metric: 0.5, status: 'critical', evaluatedAt: fixedDate },
      { id: '2', name: 'Beta', metric: 1.5, status: 'warning', evaluatedAt: fixedDate },
      { id: '3', name: 'Gamma', metric: 4.7, status: 'ok', evaluatedAt: fixedDate },
    ]);
    expect(summary).toEqual({ ok: 1, warning: 1, critical: 1 });
    expect(repository.save).toHaveBeenCalledOnce();
    expect(repository.saved).toHaveLength(1);
  });

  it('forwards the limit parameter to the data source', async () => {
    const dataSource = makeDataSource([]);
    const repository = makeRepository();

    const useCase = new EvaluateCampaignsUseCase({
      dataSource,
      repository,
      thresholds: { warning: 2.5, critical: 1.0 },
      clock: () => fixedDate,
    });

    await useCase.execute({ limit: 10 });
    expect(dataSource.fetchCampaigns).toHaveBeenCalledWith({ limit: 10 });
  });
});
