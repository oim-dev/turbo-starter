import { BadRequestException } from '@nestjs/common';

export function normalizedText(value: string): string {
  const result = value.normalize('NFC').trim();
  if (
    [...result].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new BadRequestException('Управляющие символы недопустимы.');
  return result;
}

export function normalizeFolder(value?: string | null): string | null {
  if (!value) return null;
  const result = normalizedText(value)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/');
  if (result.split('/').some((part) => part === '.' || part === '..'))
    throw new BadRequestException('Некорректный путь папки.');
  return result || null;
}

export function normalizeTags(values: string[]): string[] {
  const tags = [
    ...new Set(
      values.map((value) => normalizedText(value).toLocaleLowerCase('ru')),
    ),
  ];
  if (tags.some((tag) => !tag || tag.length > 64))
    throw new BadRequestException('Теги должны содержать от 1 до 64 символов.');
  return tags.sort();
}
