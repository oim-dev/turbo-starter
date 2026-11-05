import { BadRequestException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { lookup } from 'mime-types';

/** Уточняет старый общий MIME по расширению версии, не по переименованному документу. */
export function fileContentType(
  extension: string,
  storedType = 'application/octet-stream',
): string {
  if (storedType !== 'application/octet-stream') return storedType;
  return (extension && lookup(`file.${extension}`)) || 'application/octet-stream';
}

export function fileFormat(filename: string): {
  extension: string;
  contentType: string;
} {
  const dot = filename.lastIndexOf('.');
  const extension = dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
  return {
    extension,
    contentType: fileContentType(extension),
  };
}

export function fileText(value: string): string {
  const text = value.normalize('NFC').trim();
  if (
    [...text].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    /[\ud800-\udfff]/u.test(text)
  )
    throw new BadRequestException(
      'Управляющие символы и некорректный Unicode недопустимы.',
    );
  return text;
}

/** Имя документа или версии, пригодное для одного сегмента URL и скачивания. */
export function fileName(value: string): string {
  const name = fileText(value);
  if (!name || name === '.' || name === '..' || /[/\\]/.test(name))
    throw new BadRequestException('Укажите имя файла без разделителей пути.');
  return name;
}

export function fileFolder(value?: string | null): string | null {
  if (!value) return null;
  const parts = fileText(value)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..'))
    throw new BadRequestException('Некорректный путь папки.');
  return parts.join('/') || null;
}

export function fileTags(values: string[]): string[] {
  const tags = [
    ...new Set(values.map((tag) => fileText(tag).toLocaleLowerCase('ru'))),
  ];
  if (tags.some((tag) => !tag || tag.length > 64))
    throw new BadRequestException('Тег должен содержать от 1 до 64 символов.');
  return tags.sort();
}

export function filePublicId(): string {
  const alphabet =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  return Array.from(
    { length: 8 },
    () => alphabet[randomInt(alphabet.length)],
  ).join('');
}

export function fileSearchId(search: string): string {
  const match = /(?:^|\/)files\/([0-9A-Za-z]{8})\//.exec(search);
  if (match?.[1]) return match[1];
  return /^[0-9a-f-]{36}$/i.test(search) ? search.toLowerCase() : search;
}
