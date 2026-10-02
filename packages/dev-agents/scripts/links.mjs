import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const PACKAGE = "packages/dev-agents";

// Примеры в fenced-блоках не являются обязательными ссылками.
function prose(text) {
  return text.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*(?:\n|$)/gm, "");
}

function literalTarget(value) {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|~\/)/i.test(value)) return null;
  const path = decodeURIComponent(value.split("#", 1)[0]);
  if (/[<>{}*?\[\]$]|…|(?:^|\/)(?:\.\.\.|path\/to)(?:\/|$)/.test(path)) return null;
  return path || null;
}

function installedSkill(path) {
  return /(?:^|\/)(?:\.(?:agents|claude|opencode)\/skills?|\.config\/opencode\/skills)(?:\/|$)/.test(
    path,
  );
}

/** Небольшая проверка существования путей; содержимое якорей и формат Markdown не проверяются. */
export async function checkLinks(root, profiles) {
  const issues = [];
  const documents = new Map(profiles);
  const report = (path, message) => issues.push({ kind: "reference", path, message });
  const read = async (path) => {
    if (!documents.has(path)) {
      try {
        documents.set(path, await readFile(resolve(root, path), "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        report(path, "Отсутствует документ для проверки ссылок");
        documents.set(path, "");
      }
    }
    return prose(documents.get(path));
  };
  const target = async (from, value, inline = false) => {
    const literal = literalTarget(value);
    if (literal === null) return null;
    // Inline-пути профилей и инструкций — от корня, Markdown-ссылки — от документа.
    const full = resolve(inline ? root : dirname(resolve(root, from)), literal);
    const path = relative(root, full).split(sep).join("/");
    if (installedSkill(full.split(sep).join("/"))) return null;
    const info = await stat(full).catch((error) => {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
      throw error;
    });
    if (!info || (inline ? !info.isFile() : !info.isFile() && !info.isDirectory())) {
      report(from, `Не найден локальный путь: ${value}`);
      return null;
    }
    return path;
  };

  const instructions = new Set(["AGENTS.md", "apps/web/AGENTS.md", ...documents.keys()]);
  for (const path of instructions) {
    for (const match of (await read(path)).matchAll(/(`+)([^`\n]+)\1/g)) {
      const value = match[2];
      if (!/(?:^|\/)AGENTS\.md$/.test(value)) continue;
      const reached = await target(path, value, true);
      if (reached !== null) instructions.add(reached);
    }
  }

  const markdown = [`${PACKAGE}/README.md`, "apps/web/AGENTS.md"];
  const collect = async (path) => {
    const entries = await readdir(join(root, path), { withFileTypes: true }).catch((error) => {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
      report(path, "Отсутствует каталог сценариев");
      return [];
    });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await collect(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) markdown.push(child);
    }
  };
  await collect(`${PACKAGE}/playbooks`);
  for (const path of markdown) {
    const text = (await read(path)).replace(/(`+)[^`\n]*\1/g, "");
    // Обычные inline-ссылки (включая изображения) и определения reference-ссылок.
    for (const pattern of [
      /\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g,
      /^ {0,3}\[[^\]\n]+\]:\s*(?:<([^>\n]+)>|(\S+))/gm,
    ]) {
      for (const match of text.matchAll(pattern)) await target(path, match[1] ?? match[2]);
    }
  }
  return issues;
}
