/** Размер части — параметр передачи, а не ограничение размера файла. */
export function fileUploadPartSize(byteSize: number): number | null {
  const minimum = 32 * 1024 * 1024;
  if (byteSize < minimum) return null;
  // S3 допускает до 10000 частей; увеличиваем часть по размеру объекта.
  return Math.max(
    minimum,
    Math.ceil(byteSize / 10000 / (1024 * 1024)) * 1024 * 1024,
  );
}
