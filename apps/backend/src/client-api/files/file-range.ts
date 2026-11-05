/** Единственный диапазон HTTP bytes, включая открытый конец и суффикс. */
export function fileRange(
  header: string,
  size: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size === 0 || (!match[1] && !match[2])) return null;
  const total = BigInt(size);
  let start: bigint;
  let end: bigint;
  if (!match[1]) {
    const suffix = BigInt(match[2] ?? '0');
    if (suffix === 0n) return null;
    start = suffix >= total ? 0n : total - suffix;
    end = total - 1n;
  } else {
    start = BigInt(match[1]);
    end = match[2] ? BigInt(match[2]) : total - 1n;
    if (start >= total || end < start) return null;
    if (end >= total) end = total - 1n;
  }
  return { start: Number(start), end: Number(end) };
}
