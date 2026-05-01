/**
 * Mapea `items` de forma concurrente respetando un maximo de `concurrency` promesas activas,
 * preservando el orden del resultado. Utilidad generica sin dependencias de dominio.
 *
 * @throws {RangeError} si `concurrency` es menor que 1.
 */
export async function mapConcurrent<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>,
): Promise<readonly TOutput[]> {
  if (concurrency < 1) throw new RangeError('concurrency must be >= 1');
  if (items.length === 0) return [];

  type ResultBox = { value: TOutput };
  const results = new Map<number, ResultBox>();
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      const item = items[index];
      if (item === undefined) throw new RangeError(`Missing item at index ${index}`);
      results.set(index, { value: await mapper(item) });
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return Array.from({ length: items.length }, (_, i) => {
    const box = results.get(i);
    if (!box) throw new RangeError(`Missing result at index ${i}`);
    return box.value;
  });
}
