import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { CampaignReport } from '../../domain/campaign-report.js';
import type { ICampaignRepository } from './campaign-repository.js';

export type JsonFileRepositoryOptions = {
  readonly filePath: string;
  readonly source: string;
};

export class JsonFileRepository implements ICampaignRepository {
  constructor(private readonly options: JsonFileRepositoryOptions) {}

  async save(reports: readonly CampaignReport[]): Promise<void> {
    const absolute = resolve(this.options.filePath);
    await mkdir(dirname(absolute), { recursive: true });

    const payload = {
      source: this.options.source,
      generatedAt: new Date().toISOString(),
      count: reports.length,
      reports: reports.map((r) => ({ ...r, evaluatedAt: r.evaluatedAt.toISOString() })),
    };

    const tempPath = `${absolute}.tmp`;
    await writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    await rename(tempPath, absolute);
  }
}
