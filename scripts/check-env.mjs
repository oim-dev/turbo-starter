import { globSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const divider = '# ==================================';
const files = [...globSync(['**/.env*', '**/env.example'], {
  cwd: root,
  exclude: [
    '**/node_modules/**',
    '**/.git/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/coverage/**',
    '.agents/**',
    '.claude/**',
    '.codex/**',
    '.opencode/**',
    '.relay/**',
  ],
})].filter((file) => statSync(join(root, file)).isFile()).sort();

function read(file) {
  return readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n');
}

function fail(file, line, reason) {
  throw new Error(`${file}:${line}: ${reason}`);
}

function structure(file, content) {
  const lines = content.split('\n');
  if (lines.pop() !== '') fail(file, lines.length, 'нужен перевод строки в конце файла');
  if (lines.length === 0) fail(file, 1, 'env-файл пуст');

  const result = [];
  const keys = new Set();
  let position = 0;

  while (position < lines.length) {
    if (position > 0) {
      if (lines[position] !== '') fail(file, position + 1, 'между блоками нужна одна пустая строка');
      result.push('');
      position += 1;
    }

    const title = lines[position + 1];
    if (
      lines[position] !== divider ||
      lines[position + 2] !== divider ||
      !/^# [^#=]+$/.test(title ?? '') ||
      title !== title.toUpperCase() ||
      title.trimEnd() !== title
    ) {
      fail(file, position + 1, 'нужен трёхстрочный заголовок блока установленного формата');
    }
    result.push(divider, title, divider);
    position += 3;
    const firstVariable = position;

    while (position < lines.length && lines[position] !== '') {
      const match = /^([A-Z][A-Z0-9_]*)=(.+)$/.exec(lines[position]);
      if (!match) fail(file, position + 1, 'ожидается заполненная переменная KEY=value');
      const [, key, value] = match;
      if (value.trim() === '' || value === '""' || value === "''") {
        fail(file, position + 1, `${key} должна быть заполнена`);
      }
      if (value !== value.trim()) fail(file, position + 1, 'лишние пробелы вокруг значения');
      const quoted = /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)$/.test(value);
      if (value.includes('#') && !quoted) fail(file, position + 1, 'inline-комментарии не допускаются');
      if (keys.has(key)) fail(file, position + 1, `переменная ${key} повторяется`);
      keys.add(key);
      result.push(`${key}=`);
      position += 1;
    }
    if (position === firstVariable) fail(file, position + 1, 'после заголовка должны идти переменные');
  }

  return result.join('\n');
}

try {
  const examples = new Map();
  for (const file of files.filter((file) => basename(file) === '.env.example')) {
    const content = read(file);
    examples.set(dirname(file), { file, content, structure: structure(file, content) });
  }
  if (examples.size === 0) throw new Error('Не найдено ни одного .env.example');

  let copies = 0;
  let workingFiles = 0;
  for (const file of files) {
    if (basename(file) === '.env.example') continue;
    const example = examples.get(dirname(file));
    if (!example) throw new Error(`${file}: рядом должен находиться .env.example`);
    const content = read(file);
    if (basename(file) === 'env.example') {
      if (content !== example.content) throw new Error(`${file}: содержимое отличается от ${example.file}`);
      copies += 1;
    } else {
      if (structure(file, content) !== example.structure) {
        throw new Error(`${file}: оформление и переменные должны совпадать с ${example.file}; отличаться могут только значения`);
      }
      workingFiles += 1;
    }
  }

  console.log(`Env-проверка пройдена: шаблонов — ${examples.size}, копий — ${copies}, рабочих файлов — ${workingFiles}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Ошибка проверки env-файлов');
  process.exitCode = 1;
}
