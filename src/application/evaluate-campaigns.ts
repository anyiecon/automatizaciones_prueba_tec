import type { CampaignReport, RawCampaign } from '../domain/campaign-report.js';
import { classifyMetric, type Thresholds } from '../domain/threshold-policy.js';
import type { ICampaignDataSource } from '../infrastructure/datasources/campaign-data-source.js';
import type { ICampaignRepository } from '../infrastructure/storage/campaign-repository.js';

export type EvaluateCampaignsDeps = {
  readonly dataSource: ICampaignDataSource;
  readonly repository: ICampaignRepository;
  readonly thresholds: Thresholds;
  readonly clock?: () => Date;
  readonly logger?: { info: (msg: string, ctx?: Record<string, unknown>) => void };
};

export type EvaluateCampaignsParams = {
  readonly limit?: number;
};

export type EvaluateCampaignsResult = {
  readonly reports: readonly CampaignReport[];
  readonly summary: Readonly<Record<CampaignReport['status'], number>>;
};

/**
 * Caso de uso central: orquesta `fetch -> map -> classify -> persist`.
 * No conoce la fuente ni el almacenamiento; depende solo de los puertos `ICampaignDataSource`
 * e `ICampaignRepository`, lo que permite agregar fuentes sin tocar este archivo.
 */
export class EvaluateCampaignsUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: EvaluateCampaignsDeps) {
    this.clock = deps.clock ?? (() => new Date());
  }

  /**
   * Trae las campanas, las clasifica con la politica de umbrales y las persiste.
   * Devuelve los reportes y un resumen agregado por estado.
   */
  async execute(params: EvaluateCampaignsParams = {}): Promise<EvaluateCampaignsResult> {
    const raw = await this.deps.dataSource.fetchCampaigns(
      params.limit !== undefined ? { limit: params.limit } : {},
    );
    const reports = raw.map((c) => this.toReport(c));
    await this.deps.repository.save(reports);

    const summary = this.summarize(reports);
    this.deps.logger?.info('campaigns evaluated', {
      source: this.deps.dataSource.name,
      count: reports.length,
      ...summary,
    });

    return { reports, summary };
  }

  private toReport(raw: RawCampaign): CampaignReport {
    return {
      id: raw.id,
      name: raw.name,
      metric: raw.metric,
      status: classifyMetric(raw.metric, this.deps.thresholds),
      evaluatedAt: this.clock(),
    };
  }

  private summarize(reports: readonly CampaignReport[]): EvaluateCampaignsResult['summary'] {
    const summary = { ok: 0, warning: 0, critical: 0 };
    for (const r of reports) summary[r.status]++;
    return summary;
  }
}
