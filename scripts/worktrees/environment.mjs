import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";

export const envFiles = [
  ["infra/dev", ".env"],
  ["apps/nest-backend", ".env"],
  ["apps/react-admin-panel", ".env.local"],
  ["apps/next-web-app", ".env.local"],
];

export function repositoryKey(remote) {
  let host;
  let path;
  if (remote.includes("://")) {
    const url = new URL(remote);
    if (
      !["https:", "http:", "ssh:"].includes(url.protocol) ||
      url.search ||
      url.hash
    )
      throw new Error("Ожидается SSH/HTTPS URL репозитория.");
    const port = url.port === "22" && url.protocol === "ssh:" ? "" : url.port;
    host = `${url.hostname.toLowerCase()}${port ? `--${port}` : ""}`;
    path = url.pathname;
  } else {
    const match = /^(?:[^@/]+@)?([^/:]+):(.+)$/.exec(remote);
    if (!match)
      throw new Error(
        "Укажите remote в формате git@host:group/repo.git или https://host/group/repo.git.",
      );
    [, host, path] = match;
    host = host.toLowerCase();
  }
  const parts = [
    host,
    ...path
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.git$/, "")
      .split("/"),
  ];
  if (
    parts.length < 3 ||
    parts.some(
      (part) =>
        !/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(part) ||
        part === "." ||
        part === "..",
    )
  ) {
    throw new Error(
      "URL должен содержать хост, владельца и имя репозитория без специальных сегментов пути.",
    );
  }
  return parts.join("/");
}

export function identity(commonDir, repository, name, root) {
  return createHash("sha256")
    .update([commonDir, repository, name, root].join("\0"))
    .digest("hex")
    .slice(0, 16);
}

export function portMap(base) {
  return Object.fromEntries(
    [
      "web",
      "admin",
      "clientApi",
      "adminApi",
      "postgres",
      "s3",
      "s3Console",
      "rabbit",
      "rabbitConsole",
      "imgproxy",
    ].map((name, offset) => [name, base + offset]),
  );
}

export function overrides(record) {
  const p = record.ports;
  const url = (port) => `http://localhost:${port}`;
  return [
    {
      COMPOSE_PROJECT_NAME: record.project,
      MINIO_IMAGE: record.images[0],
      MINIO_INIT_IMAGE: record.images[1],
      POSTGRES_PORT: p.postgres,
      S3_PORT: p.s3,
      S3_CONSOLE_PORT: p.s3Console,
      S3_CORS_ALLOW_ORIGIN: [
        url(p.web),
        url(p.admin),
        `http://127.0.0.1:${p.web}`,
        `http://127.0.0.1:${p.admin}`,
      ].join(","),
      RABBITMQ_PORT: p.rabbit,
      RABBITMQ_MANAGEMENT_PORT: p.rabbitConsole,
      IMGPROXY_PORT: p.imgproxy,
    },
    {
      POSTGRES_HOST: "localhost",
      POSTGRES_PORT: p.postgres,
      CLIENT_API_HOST: "127.0.0.1",
      CLIENT_API_PORT: p.clientApi,
      ADMIN_API_HOST: "127.0.0.1",
      ADMIN_API_PORT: p.adminApi,
      S3_ENDPOINT: url(p.s3),
      S3_INTERNAL_ENDPOINT: "http://minio:9000",
      RABBITMQ_URL: `amqp://image:image-password@localhost:${p.rabbit}/images`,
      IMGPROXY_URL: url(p.imgproxy),
      FILE_PUBLIC_BASE_URL: url(p.clientApi),
      IMAGE_PUBLIC_BASE_URL: url(p.clientApi),
    },
    {
      VITE_HOST: "localhost",
      VITE_PORT: p.admin,
      VITE_HTTPS: "false",
      VITE_BACKEND_URL: `http://127.0.0.1:${p.adminApi}`,
    },
    {
      WEB_HOST: "localhost",
      WEB_PORT: p.web,
      NEXT_PUBLIC_CLIENT_API_URL: url(p.clientApi),
      CLIENT_API_INTERNAL_URL: url(p.clientApi),
    },
  ];
}

export async function prepareEnvironment(record) {
  const changes = overrides(record);
  for (const [index, [directory, filename]] of envFiles.entries()) {
    const example = await readFile(
      join(record.path, directory, ".env.example"),
      "utf8",
    );
    const values = parseEnv(example);
    for (const key of Object.keys(changes[index])) {
      if (!(key in values))
        throw new Error(
          `${directory}/.env.example: отсутствует ${key}. Выбранная версия ещё не поддерживает worktree-окружения.`,
        );
    }
    const content = example.replace(/^([A-Z][A-Z0-9_]*)=.*$/gm, (line, key) =>
      key in changes[index] ? `${key}=${changes[index][key]}` : line,
    );
    await writeFile(join(record.path, directory, filename), content, {
      flag: "wx",
      mode: 0o600,
    });
  }
}

export async function environmentKeys(path) {
  const keys = new Set();
  for (const [directory] of envFiles) {
    const values = parseEnv(
      await readFile(join(path, directory, ".env.example"), "utf8"),
    );
    for (const key of Object.keys(values)) keys.add(key);
  }
  return [...keys];
}

export async function validateEnvironment(record) {
  const expected = overrides(record);
  for (const [index, [directory, filename]] of envFiles.entries()) {
    const values = parseEnv(
      await readFile(join(record.path, directory, filename), "utf8"),
    );
    for (const [key, value] of Object.entries(expected[index])) {
      if (values[key] !== String(value))
        throw new Error(
          `${directory}/${filename}: ${key} расходится с выделенным окружением. Сохраните назначенные порты, имя Compose и связанные URL.`,
        );
    }
  }
}

export function printEnvironment(record) {
  console.log(
    `Worktree: ${record.path}\nВетка: ${record.branch}\nCompose: ${record.project}`,
  );
  for (const [name, value] of Object.entries(record.ports)) {
    console.log(
      `${name}: ${["postgres", "rabbit"].includes(name) ? `localhost:${value}` : `http://localhost:${value}`}`,
    );
  }
  console.log(
    `Client Swagger: http://localhost:${record.ports.clientApi}/docs\nAdmin Swagger: http://localhost:${record.ports.adminApi}/docs`,
  );
}
