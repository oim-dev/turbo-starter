import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    const interrupt = () => child.kill("SIGTERM");
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    child.once("error", reject);
    child.once("close", (code, signal) => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      if (code === 0) resolve(stdout.trim());
      else
        reject(
          new Error(
            `${command} завершился с ${signal ?? code}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
    });
  });
}

export async function saveJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, path);
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

// flock освобождает блокировку и после аварии/выключения питания.
export async function lock(path) {
  await mkdir(dirname(path), { recursive: true });
  const child = spawn(
    "flock",
    [
      "--exclusive",
      "--wait",
      "30",
      path,
      "sh",
      "-c",
      'printf "locked\\n"; cat >/dev/null',
    ],
    {
      stdio: ["pipe", "pipe", "inherit"],
    },
  );
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      reject(new Error(`Не удалось получить блокировку ${path}: ${code}`)),
    );
    child.stdout.once("data", resolve);
  });
  return async () => {
    const closed = new Promise((resolve) => child.once("close", resolve));
    child.stdin.end();
    await closed;
  };
}

export async function portsAvailable(ports) {
  const servers = [];
  try {
    for (const port of ports) {
      const server = createServer();
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(
          { host: "::", port, ipv6Only: false, exclusive: true },
          resolve,
        );
      });
    }
    return true;
  } catch (error) {
    if (["EADDRINUSE", "EACCES"].includes(error.code)) return false;
    throw error;
  } finally {
    await Promise.all(
      servers
        .filter((server) => server.listening)
        .map((server) => new Promise((resolve) => server.close(resolve))),
    );
  }
}

// Маркер наследуется только процессами запуска этого экземпляра, включая Turbo.
// Проверяем также starttime, чтобы не отправить сигнал повторно использованному PID.
export async function instanceProcesses(token) {
  const result = [];
  for (const name of await readdir("/proc")) {
    if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
    try {
      const environment = await readFile(`/proc/${name}/environ`, "utf8");
      if (!environment.split("\0").includes(`WORKTREE_INSTANCE_TOKEN=${token}`))
        continue;
      const stat = await readFile(`/proc/${name}/stat`, "utf8");
      result.push({
        pid: Number(name),
        start: stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19],
      });
    } catch (error) {
      if (!["ENOENT", "ESRCH", "EACCES", "EPERM"].includes(error.code))
        throw error;
    }
  }
  return result;
}

export async function stopProcesses(token) {
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    for (const entry of await instanceProcesses(token)) {
      try {
        const stat = await readFile(`/proc/${entry.pid}/stat`, "utf8");
        if (
          stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] === entry.start
        )
          process.kill(entry.pid, signal);
      } catch (error) {
        if (!["ENOENT", "ESRCH"].includes(error.code)) throw error;
      }
    }
    for (let attempt = 0; attempt < 40; attempt++) {
      if ((await instanceProcesses(token)).length === 0) return;
      await delay(250);
    }
  }
  throw new Error(
    "Не удалось остановить все процессы экземпляра; удаление прервано.",
  );
}

export function withoutEnvironment(keys) {
  const env = { ...process.env };
  for (const key of keys) delete env[key];
  // Конфигурация другого checkout не должна перехватывать миграции и pnpm.
  for (const key of [
    "DOTENV_CONFIG_PATH",
    "NODE_ENV",
    "PORT",
    "INIT_CWD",
    "PNPM_SCRIPT_SRC_DIR",
    "WORKTREE_INSTANCE_TOKEN",
  ])
    delete env[key];
  return env;
}

export async function filesIn(directory) {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
