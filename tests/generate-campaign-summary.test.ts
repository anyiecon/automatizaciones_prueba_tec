import { describe, expect, it, vi } from 'vitest';
import { generateCampaignSummary, buildCampaignPrompt } from '../src/application/generate-campaign-summary.js';
import type { CampaignReport } from '../src/domain/campaign-report.js';
import type { LLMSummary } from '../src/domain/llm-summary.js';
import { NetworkError } from '../src/domain/errors.js';
import type { ICampaignLlmClient } from '../src/infrastructure/llm/llm-client.js';

const reports: CampaignReport[] = [
  { id: '1', name: 'Alpha', metric: 0.5, status: 'critical', evaluatedAt: new Date() },
  { id: '2', name: 'Beta', metric: 1.8, status: 'warning', evaluatedAt: new Date() },
  { id: '3', name: 'Gamma', metric: 4.2, status: 'ok', evaluatedAt: new Date() },
];

function makeLlmClient(override?: Partial<ICampaignLlmClient>): ICampaignLlmClient {
  const summary: LLMSummary = {
    generatedAt: new Date(),
    model: 'test-model',
    summary: 'Resumen de prueba.',
    structured: {
      criticalCampaigns: [{ id: '1', name: 'Alpha', metric: 0.5, suggestedAction: 'Pausar campana' }],
      warningSummary: 'Una campana en warning.',
      suggestedActions: ['Revisar presupuesto'],
    },
  };
  return {
    model: 'test-model',
    generateSummary: vi.fn().mockResolvedValue(summary),
    ...override,
  };
}

describe('generateCampaignSummary', () => {
  it('returns the LLM summary when the client succeeds', async () => {
    const client = makeLlmClient();
    const result = await generateCampaignSummary(reports, { llmClient: client });

    expect(result.model).toBe('test-model');
    expect(result.summary).toBe('Resumen de prueba.');
    expect(result.structured?.criticalCampaigns).toHaveLength(1);
  });

  it('returns a fallback summary when the client throws', async () => {
    const client = makeLlmClient({
      generateSummary: vi.fn().mockRejectedValue(new NetworkError('connection refused')),
    });

    const result = await generateCampaignSummary(reports, { llmClient: client });

    expect(result.summary).toContain('No se pudo contactar al LLM');
    expect(result.summary).toContain('Alpha');
    expect(result.structured).toBeUndefined();
  });

  it('fallback summary lists critical campaign names', async () => {
    const client = makeLlmClient({
      generateSummary: vi.fn().mockRejectedValue(new Error('timeout')),
    });

    const result = await generateCampaignSummary(reports, { llmClient: client });

    expect(result.summary).toContain('Alpha');
    expect(result.summary).toContain('1 en estado critico');
  });
});

describe('buildCampaignPrompt', () => {
  it('includes critical campaigns and correct counts', () => {
    const prompt = buildCampaignPrompt(reports);
    const parsed: unknown = JSON.parse(prompt);

    expect(parsed).toMatchObject({
      total: 3,
      warning_count: 1,
      ok_count: 1,
    });

    const typed = parsed as { critical: Array<{ id: string }> };
    expect(typed.critical).toHaveLength(1);
    expect(typed.critical[0]?.id).toBe('1');
  });

  it('returns empty critical array when all campaigns are ok', () => {
    const okReports: CampaignReport[] = [
      { id: '1', name: 'Alpha', metric: 4.0, status: 'ok', evaluatedAt: new Date() },
    ];
    const parsed = JSON.parse(buildCampaignPrompt(okReports)) as { critical: unknown[] };
    expect(parsed.critical).toHaveLength(0);
  });
});
