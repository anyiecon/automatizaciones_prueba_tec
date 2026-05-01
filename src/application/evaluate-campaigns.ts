import type { CampaignEvaluationPayload, CampaignReport, RawCampaign } from '../domain/campaign-report.js';
import { classifyMetric, type Thresholds } from '../domain/threshold-policy.js';
import type { ICampaignDataSource } from '../infrastructure/datasources/campaign-data-source.js';
import type { ICampaignWorkflowNotifier } from '../infrastructure/workflows/campaign-workflow-notifier.js';
import type { ICampaignRepository } from '../infrastructure/storage/campaign-repository.js';

export type EvaluateCampaignsDeps = {
  readonly dataSource: ICampaignDataSource;
  readonly repository: ICampaignRepository;
  readonly thresholds: Thresholds;
  readonly workflowNotifier?: ICampaignWorkflowNotifier;
  readonly clock?: () => Date;
  readonly logger?: { info: (msg: string, ctx?: Record<string, unknown>) => void };
};

export type EvaluateCampaignsParams = {
  readonly limit?: number;
};

export type EvaluateCampaignsResult = {
  readonly payload: CampaignEvaluationPayload;
  readonly reports: readonly CampaignReport[];
  readonly summary: Readonly<Record<CampaignReport['status'], number>>;
};

/**
 * Caso de uso central: orquesta `fetch -> map -> classify -> persist -> notify`.
 * No conoce la fuente ni el almacenamiento; depende solo de puertos, lo que permite
 * agregar fuentes, persistencias o automatizaciones sin tocar el dominio.
 */
export class EvaluateCampaignsUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: EvaluateCampaignsDeps) {
    this.clock = deps.clock ?? (() => new Date());
  }

  /**
   * Trae las campañas, las clasifica con la politica de umbrales y persiste el payload.
   * Si hay un workflowNotifier configurado, tambien envia el mismo payload a N8N.
   */
  async execute(params: EvaluateCampaignsParams = {}): Promise<EvaluateCampaignsResult> {
    const raw = await this.deps.dataSource.fetchCampaigns(
      params.limit !== undefined ? { limit: params.limit } : {},
    );
    const generatedAt = this.clock();
    const reports = raw.map((c) => this.toReport(c, generatedAt));
    const payload: CampaignEvaluationPayload = {
      source: this.deps.dataSource.name,
      generatedAt,
      count: reports.length,
      reports,
    };

    await this.deps.repository.save(payload);
    await this.deps.workflowNotifier?.notify(payload);

    const summary = this.summarize(reports);
    this.deps.logger?.info('campaigns evaluated', {
      source: payload.source,
      count: payload.count,
      ...summary,
    });

    return { payload, reports, summary };
  }

  private toReport(raw: RawCampaign, evaluatedAt: Date): CampaignReport {
    return {
      id: raw.id,
      name: raw.name,
      metric: raw.metric,
      status: classifyMetric(raw.metric, this.deps.thresholds),
      evaluatedAt,
    };
  }

  private summarize(reports: readonly CampaignReport[]): EvaluateCampaignsResult['summary'] {
    const summary = { ok: 0, warning: 0, critical: 0 };
    for (const r of reports) summary[r.status]++;
    return summary;
  }
}
