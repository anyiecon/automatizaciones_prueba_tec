const MS_PER_DAY = 24 * 60 * 60 * 1_000;
const DEFAULT_DAYS = 7;

// ─── Tipos que replican el subconjunto de Prisma que esta funcion necesita ───

export type CampaignMetricGroupByArgs = {
  readonly by: readonly ['campaignId'];
  readonly where: { readonly recordedAt: { readonly gte: Date } };
  readonly _avg: { readonly roas: true };
  readonly orderBy: { readonly _avg: { readonly roas: 'asc' } };
};

export type CampaignFindManyArgs = {
  readonly where: { readonly id: { readonly in: readonly string[] } };
  readonly select: {
    readonly id: true;
    readonly name: true;
    readonly operator: { readonly select: { readonly id: true; readonly name: true } };
  };
};

export type CampaignMetricAverage = {
  readonly campaignId: string;
  readonly _avg: { readonly roas: number | null };
};

export type CampaignWithOperator = {
  readonly id: string;
  readonly name: string;
  readonly operator: { readonly id: string; readonly name: string };
};

export type CampaignRoasPrismaClient = {
  readonly campaignMetric: {
    groupBy(args: CampaignMetricGroupByArgs): Promise<readonly CampaignMetricAverage[]>;
  };
  readonly campaign: {
    findMany(args: CampaignFindManyArgs): Promise<readonly CampaignWithOperator[]>;
  };
};

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export type WorstRoasCampaign = {
  readonly id: string;
  readonly name: string;
  readonly averageRoas: number;
};

export type WorstRoasCampaignsByOperator = {
  readonly operator: { readonly id: string; readonly name: string };
  readonly campaigns: readonly WorstRoasCampaign[];
};

export type FindWorstRoasCampaignsOptions = {
  readonly now?: Date;
  readonly days?: number;
  readonly takePerOperator?: number;
};

/**
 * Devuelve las campañas con peor ROAS promedio en los ultimos dias,
 * agrupadas por operador y ordenadas de menor a mayor ROAS (peor primero).
 *
 * Aprovecha que Prisma devuelve los metrics ya ordenados por ROAS asc para
 * hacer la agrupacion en O(n) sin re-ordenar por operador.
 *
 * @throws {RangeError} si `days` o `takePerOperator` no son enteros positivos.
 */
export async function findWorstRoasCampaignsByOperator(
  prisma: CampaignRoasPrismaClient,
  options: FindWorstRoasCampaignsOptions = {},
): Promise<readonly WorstRoasCampaignsByOperator[]> {
  const days = options.days ?? DEFAULT_DAYS;
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError('days must be a positive integer');
  }
  if (options.takePerOperator !== undefined && (!Number.isInteger(options.takePerOperator) || options.takePerOperator < 1)) {
    throw new RangeError('takePerOperator must be a positive integer');
  }

  const since = new Date((options.now ?? new Date()).getTime() - days * MS_PER_DAY);

  const allAverages = await prisma.campaignMetric.groupBy({
    by: ['campaignId'],
    where: { recordedAt: { gte: since } },
    _avg: { roas: true },
    orderBy: { _avg: { roas: 'asc' } },
  });

  // Descartar campañas sin ROAS registrado (monedas nuevas / sin datos).
  const averages = allAverages.filter(
    (m): m is CampaignMetricAverage & { readonly _avg: { readonly roas: number } } =>
      m._avg.roas !== null,
  );

  if (averages.length === 0) return [];

  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: averages.map((m) => m.campaignId) } },
    select: {
      id: true,
      name: true,
      operator: { select: { id: true, name: true } },
    },
  });

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  // Prisma devuelve `averages` ordenados por ROAS asc → iteramos en ese orden
  // y simplemente acumulamos. No hay que re-ordenar dentro de cada operador.
  const campaignsByOperator = new Map<string, WorstRoasCampaign[]>();
  const operatorById = new Map<string, WorstRoasCampaignsByOperator['operator']>();

  for (const metric of averages) {
    const campaign = campaignById.get(metric.campaignId);
    if (!campaign) continue;

    const { operator } = campaign;
    if (!operatorById.has(operator.id)) {
      operatorById.set(operator.id, operator);
    }

    const list = campaignsByOperator.get(operator.id) ?? [];
    const limit = options.takePerOperator;
    if (limit === undefined || list.length < limit) {
      list.push({ id: campaign.id, name: campaign.name, averageRoas: metric._avg.roas });
      campaignsByOperator.set(operator.id, list);
    }
  }

  return [...campaignsByOperator.keys()]
    .map((operatorId) => ({
      operator: operatorById.get(operatorId)!,
      campaigns: campaignsByOperator.get(operatorId) ?? [],
    }))
    .sort((a, b) => {
      const firstA = a.campaigns[0]?.averageRoas ?? Number.POSITIVE_INFINITY;
      const firstB = b.campaigns[0]?.averageRoas ?? Number.POSITIVE_INFINITY;
      return firstA - firstB;
    });
}
