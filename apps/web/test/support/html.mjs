import { after, before } from "node:test";
import { startProductionServer } from "../../scripts/production-server.mjs";

// Небольшие помощники для приёмочных HTTP-тестов без браузера.
// Проверяйте то, что видит пользователь: статус, заголовки, тексты, ссылки, роли.
// Не опирайтесь на хешированные классы CSS Modules и сериализованный RSC payload.

/**
 * Поднимает один production-сервер на файл тестов и возвращает функцию запроса.
 * Требует готовой сборки (`pnpm run web:build`).
 */
export function withProductionServer() {
  let server;
  before(async () => {
    server = await startProductionServer();
  });
  after(async () => {
    await server?.stop();
  });
  return async function request(path, init) {
    const response = await fetch(new URL(path, server.baseUrl), {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      ...init,
    });
    const body = await response.text();
    return { status: response.status, headers: response.headers, html: body };
  };
}

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, name) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return entities[name.toLowerCase()] ?? match;
  });
}

function stripInvisible(html) {
  return html.replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, " ");
}

/** Текст фрагмента без тегов, скриптов и стилей, с нормализованными пробелами. */
export function textOf(html) {
  return decode(stripInvisible(html).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Содержимое `<title>`. */
export function titleOf(html) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? textOf(match[1]) : undefined;
}

/** Атрибут корневого `<html>`, например `lang`. */
export function htmlAttribute(html, name) {
  const tag = /<html\b[^>]*>/i.exec(html)?.[0] ?? "";
  return attribute(tag, name);
}

function attribute(tag, name) {
  const match = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return match ? decode(match[1] ?? match[2] ?? match[3]) : undefined;
}

/** Тексты заголовков заданного уровня в порядке документа. */
export function headings(html, level) {
  const pattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
  return [...stripInvisible(html).matchAll(pattern)].map((match) => textOf(match[1]));
}

/** Ссылки документа: адрес и доступный текст. */
export function links(html) {
  return [...stripInvisible(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: attribute(match[1], "href"),
    text: textOf(match[2]) || attribute(match[1], "aria-label"),
  }));
}

/** Число элементов с указанной ARIA-ролью или нативным тегом этой роли. */
export function countLandmarks(html, role) {
  const tags = { main: "main", navigation: "nav", banner: "header", contentinfo: "footer" };
  const visible = stripInvisible(html);
  const tag = tags[role];
  // Каждый открывающий тег учитывается один раз: по явной роли или по нативному тегу.
  return [...visible.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)].filter(([, name, attrs]) => {
    const explicit = /\srole=["']([^"']*)["']/i.exec(attrs)?.[1];
    return explicit ? explicit === role : name.toLowerCase() === tag;
  }).length;
}
