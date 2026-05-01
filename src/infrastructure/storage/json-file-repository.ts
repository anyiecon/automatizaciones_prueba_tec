import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { CampaignEvaluationPayload } from '../../domain/campaign-report.js';
import type { ICampaignRepository } from './campaign-repository.js';

export type JsonFileRepositoryOptions = {
  readonly filePath: string;
};

export class JsonFileRepository implements ICampaignRepository {
  constructor(private readonly options: JsonFileRepositoryOptions) {}

  async save(payload: CampaignEvaluationPayload): Promise<void> {
    const absolute = resolve(this.options.filePath);
    await mkdir(dirname(absolute), { recursive: true });

    const serializablePayload = {
      source: payload.source,
      generatedAt: payload.generatedAt.toISOString(),
      count: payload.count,
      reports: payload.reports.map((r) => ({ ...r, evaluatedAt: r.evaluatedAt.toISOString() })),
    };

    const tempPath = `${absolute}.tmp`;
    await writeFile(tempPath, JSON.stringify(serializablePayload, null, 2), 'utf8');
    await rename(tempPath, absolute);
  }
}
