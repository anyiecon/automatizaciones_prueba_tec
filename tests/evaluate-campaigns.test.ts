import { describe, expect, it, vi } from 'vitest';
import { EvaluateCampaignsUseCase } from '../src/application/evaluate-campaigns.js';
import type { CampaignEvaluationPayload, RawCampaign } from '../src/domain/campaign-report.js';
import type { ICampaignDataSource } from '../src/infrastructure/datasources/campaign-data-source.js';
import type { ICampaignRepository } from '../src/infrastructure/storage/campaign-repository.js';
import type { ICampaignWorkflowNotifier } from '../src/infrastructure/workflows/campaign-workflow-notifier.js';

function makeDataSource(rawCampaigns: RawCampaign[]): ICampaignDataSource {
  return {
    name: 'fake',
    fetchCampaigns: vi.fn().mockResolvedValue(rawCampaigns),
  };
}

function makeRepository(): ICampaignRepository & { saved: CampaignEvaluationPayload[] } {
  const saved: CampaignEvaluationPayload[] = [];
  return {
    saved,
    save: vi.fn().mockImplementation(async (payload) => {
      saved.push(payload);
    }),
  };
}

function makeWorkflowNotifier(): ICampaignWorkflowNotifier & { sent: CampaignEvaluationPayload[] } {
  const sent: CampaignEvaluationPayload[] = [];
  return {
    name: 'fake-workflow',
    sent,
    notify: vi.fn().mockImplementation(async (payload) => {
      sent.push(payload);
    }),
  };
}

describe('EvaluateCampaignsUseCase', () => {
  const fixedDate = new Date('2026-05-01T10:00:00.000Z');

  it('classifies campaigns, builds the shared payload and persists it', async () => {
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

    const { payload, reports, summary } = await useCase.execute();

    expect(reports).toEqual([
      { id: '1', name: 'Alpha', metric: 0.5, status: 'critical', evaluatedAt: fixedDate },
      { id: '2', name: 'Beta', metric: 1.5, status: 'warning', evaluatedAt: fixedDate },
      { id: '3', name: 'Gamma', metric: 4.7, status: 'ok', evaluatedAt: fixedDate },
    ]);
    expect(payload).toEqual({
      source: 'fake',
      generatedAt: fixedDate,
      count: 3,
      reports,
    });
    expect(summary).toEqual({ ok: 1, warning: 1, critical: 1 });
    expect(repository.save).toHaveBeenCalledOnce();
    expect(repository.saved).toEqual([payload]);
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

  it('sends the persisted payload to the optional workflow notifier', async () => {
    const dataSource = makeDataSource([{ id: '1', name: 'Alpha', metric: 0.5 }]);
    const repository = makeRepository();
    const workflowNotifier = makeWorkflowNotifier();

    const useCase = new EvaluateCampaignsUseCase({
      dataSource,
      repository,
      workflowNotifier,
      thresholds: { warning: 2.5, critical: 1.0 },
      clock: () => fixedDate,
    });

    const { payload } = await useCase.execute();

    expect(workflowNotifier.notify).toHaveBeenCalledOnce();
    expect(workflowNotifier.sent).toEqual([payload]);
    expect(repository.saved).toEqual([payload]);
  });
});
