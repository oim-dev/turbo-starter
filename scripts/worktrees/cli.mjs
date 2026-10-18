import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, lstat, mkdir, realpath, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  repositoryKey,
  identity,
  portMap,
  prepareEnvironment,
  validateEnvironment,
  environmentKeys,
  printEnvironment,
} from "./environment.mjs";
import {
  filesIn,
  instanceProcesses,
  lock,
  portsAvailable,
  readJson,
  run,
  saveJson,
  stopProcesses,
  withoutEnvironment,
} from "./system.mjs";
import { cleanupDocker, compose, docker, snapshot } from "./docker.mjs";

const help = `Worktree-окружения (Linux, Node.js 24+, Git, pnpm, Docker Compose v2, flock)

  pnpm worktree:create task-123 [--base HEAD] [--port-base 21000]
  pnpm worktree:up task-123
  pnpm worktree:status task-123
  pnpm worktree:down task-123
  pnpm worktree:remove task-123 [--force]

Общие параметры:
  --root <путь>    Каталог окружений (по умолчанию ~/worktrees)
  --repo <URL>     Явный SSH/HTTPS URL вместо origin, например после tiged
  --help          Эта справка

create создаёт ветку work/<имя>, env-файлы, устанавливает зависимости и проектные скиллы.
up устанавливает зависимости, запускает Docker, миграции и приложения в терминале.
down останавливает экземпляр с сохранением данных.
remove удаляет Docker volumes, собственные образы, worktree и его артефакты.
Ветка с коммитами сохраняется. --force разрешает потерю незакоммиченных файлов.
Команды выполняются из любой рабочей копии того же Git-репозитория.
`;

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string" },
    repo: { type: "string" },
    base: { type: "string" },
    "port-base": { type: "string" },
    force: { type: "boolean" },
    help: { type: "boolean" },
  },
});

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const exists = (path) =>
  access(path).then(
    () => true,
    (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    },
  );

async function git(cwd, args) {
  return run("git", ["-C", cwd, ...args], { capture: true });
}

async function worktrees(cwd) {
  const text = await git(cwd, ["worktree", "list", "--porcelain", "-z"]);
  return text
    .split("\0")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice(9));
}

async function assertOwnership(record, commonDir, root, path, id) {
  requireCondition(
    record.version === 1 &&
      record.id === id &&
      record.commonDir === commonDir &&
      record.path === path &&
      record.root === root,
    "Окружение принадлежит другой рабочей копии репозитория.",
  );
  requireCondition(
    record.project === `wt-${id}` &&
      record.images.join("|") ===
        [`wt-${id}-minio:dev`, `wt-${id}-minio-init:dev`].join("|"),
    "Повреждены идентификаторы Docker-ресурсов.",
  );
  if (await exists(path)) {
    requireCondition(
      !(await lstat(path)).isSymbolicLink() && (await realpath(path)) === path,
      "Путь worktree заменён символьной ссылкой.",
    );
    const actualCommon = await git(path, [
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    requireCondition(
      (await realpath(actualCommon)) === commonDir &&
        (await worktrees(path)).includes(path),
      "Каталог не является зарегистрированным worktree этого репозитория.",
    );
    requireCondition(
      (await lstat(join(path, ".git"))).isFile(),
      "Основная рабочая копия не может быть удалена.",
    );
  }
}

async function allocatePorts(stateRoot, requested) {
  const occupied = new Set();
  for (const entry of await filesIn(stateRoot)) {
    if (!/^[a-f0-9]{16}$/.test(entry)) continue;
    const file = join(stateRoot, entry, "instance.json");
    if (await exists(file)) {
      for (const port of Object.values((await readJson(file)).ports))
        occupied.add(port);
    }
  }
  if (requested !== undefined)
    requireCondition(
      /^\d+$/.test(requested) &&
        Number(requested) >= 1024 &&
        Number(requested) <= 65526,
      "--port-base должен быть от 1024 до 65526.",
    );
  for (
    let base = requested === undefined ? 20000 : Number(requested);
    base <= (requested === undefined ? 29990 : Number(requested));
    base += 10
  ) {
    const ports = portMap(base);
    if (Object.values(ports).some((port) => occupied.has(port))) continue;
    if (await portsAvailable(Object.values(ports))) return ports;
  }
  throw new Error("Нет свободного набора портов. Выберите другой --port-base.");
}

async function main() {
  if (options.help) {
    console.log(help);
    return;
  }
  const [command, name] = positionals;
  requireCondition(
    ["create", "up", "status", "down", "remove"].includes(command) &&
      positionals.length === 2,
    help,
  );
  requireCondition(
    process.platform === "linux",
    "Управление процессами worktree поддерживает Linux.",
  );
  requireCondition(
    /^[a-z0-9][a-z0-9-]{0,63}$/.test(name),
    "Имя: 1–64 строчных латинских букв, цифр и дефисов.",
  );
  requireCondition(
    command === "create" || (!options.base && !options["port-base"]),
    "--base и --port-base относятся к create.",
  );
  requireCondition(
    command === "remove" || !options.force,
    "--force относится к remove.",
  );

  const cwd = await git(process.cwd(), ["rev-parse", "--show-toplevel"]);
  const commonDir = await realpath(
    await git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
  );
  let remote = options.repo;
  if (!remote) {
    try {
      remote = await git(cwd, ["remote", "get-url", "origin"]);
    } catch {
      throw new Error(
        "Нет origin. Добавьте remote проекта или передайте --repo <SSH/HTTPS URL>.",
      );
    }
  }
  const repository = repositoryKey(remote);
  const requestedRoot = options.root ?? join(homedir(), "worktrees");
  await mkdir(resolve(requestedRoot.replace(/^~(?=\/|$)/, homedir())), {
    recursive: true,
  });
  const root = await realpath(
    resolve(requestedRoot.replace(/^~(?=\/|$)/, homedir())),
  );
  const path = join(root, repository, name);
  for (const existing of await worktrees(cwd)) {
    const suffix = relative(existing, path);
    requireCondition(
      suffix.startsWith("..") || isAbsolute(suffix) || existing === path,
      "Окружение должно находиться вне существующих рабочих копий.",
    );
  }
  const id = identity(commonDir, repository, name, root);
  const stateRoot = join(root, ".state");
  const directory = join(stateRoot, id);
  const recordFile = join(directory, "instance.json");
  const releaseInstance = await lock(join(stateRoot, `${id}.lock`));
  let record;
  let child;
  try {
    if (command === "create") {
      const releaseRegistry = await lock(join(stateRoot, "registry.lock"));
      try {
        requireCondition(
          !(await exists(recordFile)) && !(await exists(path)),
          `Окружение ${name} уже существует. Используйте up/status/remove.`,
        );
        const base = await git(cwd, [
          "rev-parse",
          "--verify",
          `${options.base ?? "HEAD"}^{commit}`,
        ]);
        const branch = `work/${name}`;
        await git(cwd, ["check-ref-format", "--branch", branch]);
        const branches = await git(cwd, ["branch", "--list", branch]);
        requireCondition(
          !branches,
          `Ветка ${branch} уже существует. Используйте другое имя задачи.`,
        );
        record = {
          version: 1,
          id,
          name,
          commonDir,
          repository,
          root,
          path,
          branch,
          base,
          project: `wt-${id}`,
          context: await run("docker", ["context", "show"], { capture: true }),
          token: randomBytes(24).toString("hex"),
          ports: await allocatePorts(stateRoot, options["port-base"]),
          images: [`wt-${id}-minio:dev`, `wt-${id}-minio-init:dev`],
          phase: "creating",
        };
        await saveJson(recordFile, record);
        await mkdir(dirname(path), { recursive: true });
        await run("git", [
          "-C",
          cwd,
          "worktree",
          "add",
          "-b",
          branch,
          path,
          base,
        ]);
        await prepareEnvironment(record);
        await run(process.execPath, [join(path, "scripts/check-env.mjs")], {
          cwd: path,
        });
        await snapshot(record, directory);
      } finally {
        await releaseRegistry();
      }
      // Установка может быть долгой; другие окружения уже могут резервировать свои порты.
      const env = withoutEnvironment(await environmentKeys(path));
      console.log(`Установка зависимостей worktree: ${path}`);
      await run("pnpm", ["install", "--frozen-lockfile"], { cwd: path, env });
      console.log(`Подготовка проектных скиллов worktree: ${path}`);
      await run("pnpm", ["run", "setup"], { cwd: path, env });
      record.phase = "prepared";
      await saveJson(recordFile, record);
      printEnvironment(record);
      const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
      let repoArgument = "";
      if (options.repo) {
        let publicRemote = remote;
        if (remote.includes("://")) {
          const url = new URL(remote);
          url.username = "";
          url.password = "";
          publicRemote = url.toString();
        }
        repoArgument = ` --repo ${quote(publicRemote)}`;
      }
      console.log(
        `Готово. Запуск: pnpm worktree:up ${name} --root ${quote(root)}${repoArgument}`,
      );
      return;
    }

    requireCondition(
      await exists(recordFile),
      `Окружение ${name} не зарегистрировано.`,
    );
    record = await readJson(recordFile);
    await assertOwnership(record, commonDir, root, path, id);

    if (command === "status") {
      printEnvironment(record);
      console.log(
        `Состояние подготовки: ${record.phase}\nПроцессов экземпляра: ${(await instanceProcesses(record.token)).length}`,
      );
      await docker(record, [
        "ps",
        "-a",
        "--filter",
        `label=com.docker.compose.project=${record.project}`,
        "--format",
        "table {{.Names}}\t{{.Status}}\t{{.Ports}}",
      ]);
      return;
    }

    if (command === "remove" || command === "down") {
      if (command === "remove" && (await exists(path)) && !options.force) {
        requireCondition(
          !(await git(path, [
            "status",
            "--porcelain",
            "--untracked-files=all",
          ])),
          "Есть незакоммиченные файлы. Сохраните изменения или используйте remove --force для их удаления.",
        );
      }
      await stopProcesses(record.token);
      await cleanupDocker(record, directory, command === "remove");
      if (command === "down") {
        console.log("Экземпляр остановлен, данные сохранены.");
        return;
      }
      if ((await worktrees(cwd)).includes(path)) {
        await run("git", [
          "-C",
          cwd,
          "worktree",
          "remove",
          ...(options.force ? ["--force"] : []),
          path,
        ]);
      } else {
        requireCondition(
          !(await exists(path)),
          "Каталог не зарегистрирован в Git; автоматическое удаление остановлено.",
        );
      }
      const releaseRegistry = await lock(join(stateRoot, "registry.lock"));
      try {
        await rm(directory, { recursive: true });
      } finally {
        await releaseRegistry();
      }
      console.log(
        `Окружение ${name} удалено вместе с Docker-данными и артефактами. Ветка ${record.branch} сохранена.`,
      );
      return;
    }

    requireCondition(
      record.phase === "prepared",
      "Подготовка была прервана. Удалите окружение и создайте заново.",
    );
    requireCondition(
      await exists(path),
      "Рабочая копия отсутствует. Используйте remove для очистки ресурсов.",
    );
    requireCondition(
      (await instanceProcesses(record.token)).length === 0,
      "Приложения экземпляра уже запущены.",
    );
    await validateEnvironment(record);
    // Порты Docker могут быть заняты уже работающими контейнерами этого экземпляра.
    requireCondition(
      await portsAvailable([
        record.ports.web,
        record.ports.admin,
        record.ports.clientApi,
        record.ports.adminApi,
      ]),
      "Один из портов приложений занят.",
    );
    const env = withoutEnvironment(await environmentKeys(path));
    record.token = randomBytes(24).toString("hex");
    await saveJson(recordFile, record);
    env.WORKTREE_INSTANCE_TOKEN = record.token;
    await run("pnpm", ["install", "--frozen-lockfile"], { cwd: path, env });
    await run("pnpm", ["env:check"], { cwd: path, env });
    await snapshot(record, directory);
    await compose(record, directory, [
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "180",
    ]);
    await run("pnpm", ["backend:prisma:deploy"], { cwd: path, env });
    printEnvironment(record);
    child = spawn("pnpm", ["dev", "--ui=stream"], {
      cwd: path,
      env,
      stdio: "inherit",
    });
    // Подписки устанавливаются до освобождения блокировки и выхода дочернего процесса.
    const finished = new Promise((resolve) => {
      child.once("error", (error) => resolve({ error }));
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    await releaseInstance();
    const stop = () => {
      void stopProcesses(record.token).catch((error) =>
        console.error(error.message),
      );
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    try {
      const { code, signal, error } = await finished;
      if (error) throw error;
      if (code && !signal) process.exitCode = code;
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      await stopProcesses(record.token);
    }
  } finally {
    if (!child) await releaseInstance();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
