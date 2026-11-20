import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Общий запуск production-сервера для verify:browser и HTTP-тестов.
// Сервер слушает только 127.0.0.1 на свободном порту и требует готовой сборки.
export const appRoot = fileURLToPath(new URL("../", import.meta.url));

export function distDir(env = process.env) {
  return resolve(appRoot, env.NEXT_DIST_DIR || ".next");
}

export function hasProductionBuild(env = process.env) {
  return existsSync(resolve(distDir(env), "BUILD_ID"));
}

export async function freePort(host = "127.0.0.1") {
  const server = createServer();
  await new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(0, host, done);
  });
  const { port } = server.address();
  await new Promise((done) => server.close(done));
  return port;
}

/**
 * Запускает `next start` на 127.0.0.1 и ждёт первого HTTP-ответа.
 * Возвращает адрес, накопленный вывод и функцию остановки.
 */
export async function startProductionServer(options = {}) {
  const env = { ...process.env, ...options.env };
  if (!hasProductionBuild(env)) {
    throw new Error(
      `Нет production-сборки в ${distDir(env)}. Сначала выполните pnpm run web:build из корня репозитория.`,
    );
  }
  const host = "127.0.0.1";
  const port = options.port ?? (await freePort(host));
  const baseUrl = `http://${host}:${port}`;
  const timeoutMs = options.timeoutMs ?? 60_000;
  let output = "";
  // Next CLI запускается напрямую, без обёртки scripts/next.mjs: адрес и порт заданы явно,
  // а остановка сигналом гарантированно доходит до процесса сервера.
  const require = createRequire(import.meta.url);
  const nextPackage = require.resolve("next/package.json");
  const nextBin = resolve(dirname(nextPackage), require(nextPackage).bin.next);
  const child = spawn(process.execPath, [nextBin, "start", "--port", String(port), "--hostname", host], {
    cwd: appRoot,
    env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const append = (chunk) => {
    output += chunk;
    options.onOutput?.(chunk);
  };
  child.stdout.setEncoding("utf8").on("data", append);
  child.stderr.setEncoding("utf8").on("data", append);
  let exited = false;
  const exit = new Promise((done) =>
    child.once("exit", (code, signal) => {
      exited = true;
      done({ code, signal });
    }),
  );

  async function stop() {
    if (exited) return;
    child.kill("SIGTERM");
    const result = await Promise.race([exit, delay(5_000, "timeout")]);
    if (result === "timeout") {
      child.kill("SIGKILL");
      await exit;
    }
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`Production-сервер завершился до готовности.\n${output}`);
    }
    try {
      await fetch(baseUrl, { redirect: "manual", signal: AbortSignal.timeout(2_000) });
      // Порт мог занять другой процесс: убеждаемся, что наш сервер жив.
      await delay(300);
      if (exited) throw new Error(`Production-сервер завершился после старта.\n${output}`);
      return { baseUrl, port, stop, output: () => output };
    } catch {
      await delay(200);
    }
  }
  await stop();
  throw new Error(`Production-сервер не ответил за ${timeoutMs} мс.\n${output}`);
}
