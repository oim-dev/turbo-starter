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

// На macOS нет CLI flock; системный Perl вызывает ту же блокировку ядра.
// Она освобождается и после аварии, а EOF stdin — при завершении владельца CLI.
const darwinLock = String.raw`
use Fcntl qw(:flock);
open(my $lock, ">>", $ARGV[0]) or die "open: $!\n";
$SIG{ALRM} = sub { die "lock timeout\n" };
alarm 30;
flock($lock, LOCK_EX) or die "flock: $!\n";
alarm 0;
$| = 1;
print "locked\n";
while (sysread(STDIN, my $buffer, 1024)) {}
`;

export async function lock(path) {
  await mkdir(dirname(path), { recursive: true });
  const darwin = process.platform === "darwin";
  const child = spawn(
    darwin ? "/usr/bin/perl" : "flock",
    darwin
      ? ["-e", darwinLock, "--", path]
      : [
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
  const closed = new Promise((resolve) => child.once("close", resolve));
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) =>
        reject(new Error(`Не удалось получить блокировку ${path}: ${code}`)),
      );
      child.stdout.once("data", resolve);
    });
  } catch (error) {
    child.stdin.destroy();
    child.kill();
    await closed;
    throw error;
  }
  let released = false;
  return async () => {
    if (!released) {
      released = true;
      child.stdin.end();
    }
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
  if (process.platform === "darwin") {
    // -E показывает окружение, -ww исключает обрезку длинной строки с маркером.
    const output = await run(
      "/bin/ps",
      ["-A", "-E", "-ww", "-o", "pid=,lstart=,command="],
      {
        capture: true,
        env: {
          ...withoutEnvironment(["WORKTREE_INSTANCE_TOKEN"]),
          LC_ALL: "C",
        },
      },
    );
    const result = [];
    for (const line of output.split("\n")) {
      const match =
        /^\s*(\d+)\s+(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/.exec(
          line,
        );
      if (
        match &&
        Number(match[1]) !== process.pid &&
        match[3].split(/\s+/).includes(`WORKTREE_INSTANCE_TOKEN=${token}`)
      )
        result.push({
          pid: Number(match[1]),
          start: match[2].replace(/\s+/g, " "),
        });
    }
    return result;
  }
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
        let matches;
        if (process.platform === "darwin") {
          matches = (await instanceProcesses(token)).some(
            (current) =>
              current.pid === entry.pid && current.start === entry.start,
          );
        } else {
          const stat = await readFile(`/proc/${entry.pid}/stat`, "utf8");
          matches =
            stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] ===
            entry.start;
        }
        if (matches) process.kill(entry.pid, signal);
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
