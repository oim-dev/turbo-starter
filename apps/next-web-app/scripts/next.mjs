import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

// PORT нужен Next CLI до его собственной загрузки .env.
const root = fileURLToPath(new URL("../", import.meta.url));
const command = process.argv[2];
if (!["dev", "start"].includes(command))
  throw new Error("Ожидается dev или start.");
const mode = command === "dev" ? "development" : "production";
const local = {};
for (const file of [
  `.env.${mode}.local`,
  ".env.local",
  `.env.${mode}`,
  ".env",
]) {
  const path = resolve(root, file);
  if (existsSync(path)) {
    const values = parseEnv(readFileSync(path, "utf8"));
    for (const key of ["WEB_HOST", "WEB_PORT"]) {
      if (!(key in local) && key in values) local[key] = values[key];
    }
  }
}
// Остальное окружение загружает сам Next.js с его правилами интерполяции.
const port = process.env.WEB_PORT ?? local.WEB_PORT ?? "3000";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("WEB_PORT должен быть целым числом от 1 до 65535.");
const require = createRequire(import.meta.url);
const nextPackage = require.resolve("next/package.json");
const bin = resolve(dirname(nextPackage), require(nextPackage).bin.next);
const child = spawn(
  process.execPath,
  [
    bin,
    command,
    "--port",
    port,
    "--hostname",
    process.env.WEB_HOST ?? local.WEB_HOST ?? "0.0.0.0",
    ...process.argv.slice(3),
  ],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 143);
});
