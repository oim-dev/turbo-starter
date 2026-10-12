import { contentType } from 'mime-types';
import { fileContentType } from '../../modules/files/file-format';

/** Текстовые исходники открываются как текст, остальные файлы — с MIME своей версии. */
export function fileResponseContentType(
  extension: string,
  storedType: string,
  download: boolean,
): string {
  const type = fileContentType(extension, storedType);
  const isText =
    type.startsWith('text/') ||
    type.endsWith('+json') ||
    type.endsWith('+xml') ||
    ['application/json', 'application/xml', 'application/javascript', 'application/yaml'].includes(type);
  if (!download && isText) return 'text/plain; charset=utf-8';
  return contentType(type) || type;
}
