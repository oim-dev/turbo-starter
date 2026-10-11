import type { SourceMetadata } from './image-metadata';

export interface VariantPlan {
  width: number;
  height: number;
  format: 'avif' | 'jpeg' | 'png';
}

export function variantPlans(source: SourceMetadata): VariantPlan[] {
  const maximum = Math.min(2000, source.width);
  const widths: number[] = [];
  for (let width = 200; width <= maximum; width += 200) widths.push(width);
  const lastGrid = widths.at(-1);
  if (lastGrid !== maximum) {
    // Короткий остаток заменяет последнюю сеточную ширину, а не создаёт пару
    // почти одинаковых вариантов. Ровно полшага (100 px) сохраняет обе ширины.
    if (lastGrid !== undefined && maximum - lastGrid < 100) widths.pop();
    widths.push(maximum);
  }
  // JPEG как fallback только для известного непрозрачного JPEG-источника.
  // Графика/неопределённый тип контента сохраняется в PNG без quantize.
  const fallback =
    source.mimeType === 'image/jpeg' && !source.hasAlpha ? 'jpeg' : 'png';
  const plans: VariantPlan[] = [];
  for (const width of widths) {
    const height = Math.max(
      1,
      Math.min(
        source.height,
        Math.round((width * source.height) / source.width),
      ),
    );
    if (width >= 16 && height >= 16)
      plans.push({ width, height, format: 'avif' });
    plans.push({ width, height, format: fallback });
  }
  return plans;
}
