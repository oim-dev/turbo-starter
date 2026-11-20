import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { appRoot, startProductionServer } from "./production-server.mjs";

// Браузерная проверка одной командой: сборка, production-сервер на свободном порту,
// сценарий agent-browser на нескольких ширинах, скриншоты и отчёт JUnit.
// Коды выхода: 0 — сценарий пройден, 1 — упал шаг или есть ошибки консоли/страницы,
// 2 — не удалось подготовить проверку (аргументы, сборка, сервер, браузер).

const repoRoot = resolve(appRoot, "../..");
const usage = `Использование: pnpm run verify:browser [опции]

  --scenario <file>   JSON-сценарий (по умолчанию test/browser/smoke.json)
  --session <name>    имя сессии agent-browser и каталога артефактов
  --artifacts <dir>   каталог артефактов (по умолчанию .artifacts/web/<session>)
  --junit <file>      дополнительный путь отчёта JUnit
  --base-url <url>    проверить уже запущенный сервер без сборки и запуска
  --no-build          не собирать, использовать готовую сборку
  -h, --help          эта справка

Коды выхода: 0 — успех, 1 — сценарий не пройден, 2 — ошибка подготовки,
130/143 — прерывание сигналом.`;

const SETUP_FAILED = 2;
const defaultViewports = [
  { name: "narrow", width: 390, height: 844 },
  { name: "medium", width: 768, height: 1024 },
  { name: "wide", width: 1440, height: 900 },
];

class SetupError extends Error {}

function parse() {
  try {
    return parseArgs({
      options: {
        scenario: { type: "string" },
        session: { type: "string" },
        artifacts: { type: "string" },
        junit: { type: "string" },
        "base-url": { type: "string" },
        "no-build": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      // pnpm может передать разделитель `--` перед аргументами скрипта.
      args: process.argv.slice(2).filter((arg) => arg !== "--"),
    }).values;
  } catch (error) {
    console.error(`${error.message}\n\n${usage}`);
    process.exit(SETUP_FAILED);
  }
}

function fromCwd(path) {
  return isAbsolute(path) ? path : resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

function loadScenario(path) {
  let scenario;
  try {
    scenario = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new SetupError(`Не удалось прочитать сценарий ${path}: ${error.message}`);
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    throw new SetupError(`В сценарии ${path} нет шагов (steps).`);
  }
  for (const [index, step] of scenario.steps.entries()) {
    const valid =
      step &&
      typeof step.name === "string" &&
      ((Array.isArray(step.run) && step.run.length > 0 && step.run.every((arg) => typeof arg === "string")) ||
        typeof step.screenshot === "string") &&
      (step.allowConsoleErrors === undefined ||
        (Array.isArray(step.allowConsoleErrors) &&
          step.allowConsoleErrors.every((pattern) => typeof pattern === "string")));
    if (!valid) {
      throw new SetupError(
        `Шаг ${index + 1} сценария ${path}: нужны name и run (массив строк) или screenshot; allowConsoleErrors — массив строк.`,
      );
    }
  }
  const viewports = scenario.viewports ?? defaultViewports;
  const validViewport = (item) =>
    item && typeof item.name === "string" && Number.isInteger(item.width) && Number.isInteger(item.height);
  if (!Array.isArray(viewports) || viewports.length === 0 || !viewports.every(validViewport)) {
    throw new SetupError(`В сценарии ${path} viewports должны содержать name, width и height.`);
  }
  for (const step of scenario.steps) {
    for (const pattern of step.allowConsoleErrors ?? []) {
      try {
        new RegExp(pattern);
      } catch (error) {
        throw new SetupError(`Шаг «${step.name}»: неверный шаблон allowConsoleErrors: ${error.message}`);
      }
    }
  }
  return {
    name: scenario.name ?? "browser",
    viewports,
    steps: scenario.steps,
  };
}

// Ни одна команда браузера не должна подвесить проверку.
const COMMAND_TIMEOUT_MS = 120_000;

function run(command, args, options = {}) {
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs ?? COMMAND_TIMEOUT_MS);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      done({ code: -1, stdout, stderr: `${stderr}${error.message}` });
    });
    // close, а не exit: к этому моменту вывод прочитан полностью.
    child.on("close", (code) => {
      clearTimeout(timer);
      done({ code: code ?? 1, stdout, stderr: timedOut ? `${stderr}\nПревышено время команды.` : stderr });
    });
  });
}

function runInherit(command, args, options = {}) {
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", () => done(-1));
    child.on("exit", (code) => done(code ?? 1));
  });
}

// Путь Unix-сокета ограничен ~104 байтами, а пути рабочих копий бывают длинными.
const SOCKET_PATH_LIMIT = 100;

function socketDir(session) {
  const fits = (dir) => Buffer.byteLength(join(dir, `${session}.sock`)) <= SOCKET_PATH_LIMIT;
  if (process.env.AGENT_BROWSER_SOCKET_DIR) return process.env.AGENT_BROWSER_SOCKET_DIR;
  const local = join(repoRoot, ".artifacts", "ab");
  if (fits(local)) return local;
  const hash = createHash("sha256").update(repoRoot).digest("hex").slice(0, 8);
  const temporary = join(tmpdir(), `ab-${hash}`);
  if (fits(temporary)) return temporary;
  throw new SetupError(
    "Путь сокета agent-browser слишком длинный: задайте короткий AGENT_BROWSER_SOCKET_DIR или --session.",
  );
}

// Собственный профиль создаётся для каждого запуска и удаляется после него,
// чтобы запуски не делили cookies и хранилища.
function ownProfile(stateDir, session) {
  return join(stateDir, "profiles", session);
}

function browserEnv(stateDir, session) {
  // Состояние agent-browser держим в каталоге проекта (или во временном каталоге
  // для сокета при длинном пути), а не в домашнем каталоге.
  // Явно заданные переменные окружения имеют приоритет.
  const sockets = socketDir(session);
  mkdirSync(sockets, { recursive: true });
  return {
    ...process.env,
    AGENT_BROWSER_SOCKET_DIR: sockets,
    AGENT_BROWSER_PROFILE: process.env.AGENT_BROWSER_PROFILE || ownProfile(stateDir, session),
    AGENT_BROWSER_IDLE_TIMEOUT_MS: process.env.AGENT_BROWSER_IDLE_TIMEOUT_MS || "300000",
  };
}

function createBrowser(session, env) {
  const bin = join(appRoot, "node_modules", "agent-browser", "bin", "agent-browser.js");
  return async function browser(args, timeoutMs) {
    const result = await run(
      process.execPath,
      [bin, "--config", "./agent-browser.json", "--session", session, "--json", ...args],
      { cwd: appRoot, env, timeoutMs },
    );
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim().split("\n").at(-1));
    } catch {
      parsed = undefined;
    }
    const ok = result.code === 0 && parsed?.success !== false;
    return {
      ok,
      data: parsed?.data,
      error: parsed?.error ?? (ok ? undefined : (result.stderr || result.stdout).trim()),
    };
  };
}

function resolveArgs(args, baseUrl) {
  if (args[0] === "open" && typeof args[1] === "string" && args[1].startsWith("/")) {
    return ["open", new URL(args[1], baseUrl).href, ...args.slice(2)];
  }
  return args;
}

function allowed(text, patterns) {
  return patterns.some((pattern) => new RegExp(pattern, "i").test(text));
}

async function collectProblems(browser, patterns) {
  const problems = [];
  const consoleResult = await browser(["console"]);
  if (!consoleResult.ok || !Array.isArray(consoleResult.data?.messages)) {
    throw new SetupError(`Не удалось прочитать консоль браузера: ${consoleResult.error ?? "нет messages"}`);
  }
  for (const message of consoleResult.data.messages) {
    if (message.type === "error" && !allowed(message.text, patterns)) {
      problems.push(`console.error: ${message.text}`);
    }
  }
  const errorsResult = await browser(["errors"]);
  if (!errorsResult.ok || !Array.isArray(errorsResult.data?.errors)) {
    throw new SetupError(`Не удалось прочитать ошибки страницы: ${errorsResult.error ?? "нет errors"}`);
  }
  for (const error of errorsResult.data.errors) {
    if (!allowed(error.text, patterns)) problems.push(`page error: ${error.text}`);
  }
  await browser(["console", "--clear"]);
  await browser(["errors", "--clear"]);
  return problems;
}

function escapeXml(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function junit(suiteName, cases) {
  const failures = cases.filter((item) => item.failure).length;
  const errors = cases.filter((item) => item.error).length;
  const skipped = cases.filter((item) => item.skipped).length;
  const time = cases.reduce((sum, item) => sum + item.time, 0);
  const body = cases
    .map((item) => {
      const head = `    <testcase classname="${escapeXml(item.classname)}" name="${escapeXml(item.name)}" time="${item.time.toFixed(3)}"`;
      if (item.failure) {
        return `${head}>\n      <failure message="${escapeXml(item.failure.split("\n")[0])}">${escapeXml(item.failure)}</failure>\n    </testcase>`;
      }
      if (item.error) {
        return `${head}>\n      <error message="${escapeXml(item.error.split("\n")[0])}">${escapeXml(item.error)}</error>\n    </testcase>`;
      }
      if (item.skipped) {
        return `${head}>\n      <skipped message="${escapeXml(item.skipped)}"/>\n    </testcase>`;
      }
      return `${head}/>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="verify:browser" tests="${cases.length}" failures="${failures}" errors="${errors}" time="${time.toFixed(3)}">
  <testsuite name="${escapeXml(suiteName)}" tests="${cases.length}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${time.toFixed(3)}">
${body}
  </testsuite>
</testsuites>
`;
}

async function main() {
  const options = parse();
  if (options.help) {
    console.log(usage);
    return 0;
  }
  const session = options.session ?? `wv-${Date.now().toString(36)}-${process.pid}`;
  if (!/^[A-Za-z0-9][\w.-]*$/.test(session)) {
    console.error("Имя сессии начинается с буквы или цифры и содержит только буквы, цифры, точку, дефис и подчёркивание.");
    return SETUP_FAILED;
  }
  const artifacts = options.artifacts
    ? fromCwd(options.artifacts)
    : join(repoRoot, ".artifacts", "web", session);
  const stateDir = join(repoRoot, ".artifacts", "agent-browser");
  mkdirSync(artifacts, { recursive: true });
  const cases = [];
  const reports = [join(artifacts, "junit.xml")];
  if (options.junit) reports.push(fromCwd(options.junit));
  let suiteName = "browser";
  let server;
  let browser;
  let exitCode = 0;
  let cleaning;

  function cleanup() {
    cleaning ??= (async () => {
      await server?.stop();
      if (browser) await browser(["close"], 15_000);
      const profile = ownProfile(stateDir, session);
      // Удаляем только собственный профиль этого запуска внутри profiles/.
      if (!process.env.AGENT_BROWSER_PROFILE && dirname(profile) === join(stateDir, "profiles")) {
        rmSync(profile, { recursive: true, force: true });
      }
      for (const report of reports) {
        try {
          mkdirSync(dirname(report), { recursive: true });
          writeFileSync(report, junit(suiteName, cases));
        } catch (error) {
          console.error(`Не удалось записать ${report}: ${error.message}`);
          exitCode ||= SETUP_FAILED;
        }
      }
    })();
    return cleaning;
  }
  process.once("exit", () => {
    const profile = ownProfile(stateDir, session);
    if (!process.env.AGENT_BROWSER_PROFILE && dirname(profile) === join(stateDir, "profiles")) {
      rmSync(profile, { recursive: true, force: true });
    }
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
      record({ classname: `${suiteName}.setup`, name: "прерывание", time: 0, error: `Получен ${signal}.` });
      cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
    });
  }

  const record = (item) => {
    cases.push(item);
    const mark = item.failure || item.error ? "✗" : item.skipped ? "–" : "✓";
    console.log(`${mark} ${item.classname} › ${item.name}${item.skipped ? ` (пропущен: ${item.skipped})` : ""}`);
    if (item.failure || item.error) console.log(`  ${(item.failure || item.error).replace(/\n/g, "\n  ")}`);
  };

  try {
    const scenarioPath = options.scenario
      ? fromCwd(options.scenario)
      : join(appRoot, "test", "browser", "smoke.json");
    const scenario = loadScenario(scenarioPath);
    suiteName = scenario.name;

    let baseUrl = options["base-url"];
    if (!baseUrl) {
      if (!options["no-build"]) {
        console.log("Сборка @oim/web и зависимостей через Turborepo…");
        const turbo = join(repoRoot, "node_modules", ".bin", "turbo");
        const code = await runInherit(turbo, ["run", "build", "--filter=@oim/web", "--ui=stream"], {
          cwd: repoRoot,
        });
        if (code !== 0) throw new SetupError(`Сборка завершилась с кодом ${code}.`);
      }
      const log = join(artifacts, "server.log");
      writeFileSync(log, "");
      server = await startProductionServer({
        onOutput: (chunk) => writeFileSync(log, chunk, { flag: "a" }),
      }).catch((error) => {
        throw new SetupError(error.message);
      });
      baseUrl = server.baseUrl;
      console.log(`Production-сервер: ${baseUrl}`);
    }

    browser = createBrowser(session, browserEnv(stateDir, session));
    const launch = await browser(["open", "about:blank"]);
    if (!launch.ok) throw new SetupError(`Не удалось запустить браузер: ${launch.error}`);

    for (const viewport of scenario.viewports) {
      const classname = `${scenario.name}.${viewport.name}`;
      const resize = await browser(["set", "viewport", String(viewport.width), String(viewport.height)]);
      if (!resize.ok) throw new SetupError(`Не удалось задать viewport ${viewport.name}: ${resize.error}`);
      const leftovers = await collectProblems(browser, []);
      if (leftovers.length > 0) {
        record({ classname, name: `ошибки до сценария @${viewport.width}px`, time: 0, failure: leftovers.join("\n") });
      }
      let failedBefore = false;
      for (const step of scenario.steps) {
        const started = performance.now();
        const name = `${step.name} @${viewport.width}px`;
        if (failedBefore) {
          record({ classname, name, time: 0, skipped: "предыдущий шаг не пройден" });
          continue;
        }
        let failure;
        if (step.screenshot) {
          const file = join(artifacts, `${viewport.name}-${step.screenshot}.png`);
          const shot = await browser(["screenshot", file, ...(step.fullPage === false ? [] : ["--full"])]);
          if (!shot.ok) failure = `Скриншот не создан: ${shot.error}`;
        } else {
          const result = await browser(resolveArgs(step.run, baseUrl));
          if (!result.ok) failure = `agent-browser ${step.run.join(" ")}: ${result.error}`;
        }
        let problems;
        try {
          problems = await collectProblems(browser, step.allowConsoleErrors ?? []);
        } catch (error) {
          if (!failure) throw error;
          problems = [error.message];
        }
        if (problems.length > 0) failure = [failure, ...problems].filter(Boolean).join("\n");
        if (failure) failedBefore = true;
        record({ classname, name, time: (performance.now() - started) / 1000, failure });
      }
    }
    exitCode = cases.some((item) => item.failure) ? 1 : 0;
  } catch (error) {
    const setup = error instanceof SetupError;
    record({ classname: `${suiteName}.setup`, name: "подготовка проверки", time: 0, error: error.message });
    exitCode = SETUP_FAILED;
    if (!setup) console.error(error);
  } finally {
    await cleanup();
  }
  const shown = artifacts;
  console.log(
    exitCode === 0
      ? `Проверка пройдена. Артефакты: ${shown}`
      : `Проверка не пройдена (код ${exitCode}). Артефакты и junit.xml: ${shown}`,
  );
  return exitCode;
}

process.exitCode = await main();
