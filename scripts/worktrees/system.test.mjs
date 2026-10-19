import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { randomBytes } from "node:crypto";
import { EventEmitter, once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { instanceProcesses, lock, stopProcesses } from "./system.mjs";

function platform(t, value) {
  const original = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value });
  t.after(() => Object.defineProperty(process, "platform", original));
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "worktree-system-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function worker(t, source, args = [], env = process.env) {
  const child = childProcess.spawn(
    process.execPath,
    ["--input-type=module", "-e", source, ...args],
    { env, stdio: ["ignore", "ignore", "inherit", "ipc"] },
  );
  const closed = once(child, "close");
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
    await closed;
  });
  return child;
}

for (const target of new Set([process.platform, "darwin"])) {
  test(`${target}: блокировка сериализует конкурентов и освобождается повторно`, async (t) => {
    platform(t, target);
    const path = join(await temporaryDirectory(t), "with spaces", "test.lock");
    const releaseFirst = await lock(path);
    t.after(releaseFirst);
    let acquired = false;
    const waiting = lock(path).then((release) => {
      acquired = true;
      return release;
    });
    t.after(async () => (await waiting)());
    await delay(150);
    assert.equal(acquired, false);
    await releaseFirst();
    const releaseSecond = await waiting;
    assert.equal(acquired, true);
    await releaseSecond();
    await releaseSecond();
  });

  test(`${target}: SIGKILL владельца не оставляет занятую блокировку`, async (t) => {
    platform(t, target);
    const path = join(await temporaryDirectory(t), "crash.lock");
    const owner = worker(
      t,
      `Object.defineProperty(process, "platform", { value: process.argv[2] });
       const { lock } = await import(${JSON.stringify(new URL("./system.mjs", import.meta.url).href)});
       await lock(process.argv[1]);
       process.send("locked");
       setInterval(() => {}, 1000);`,
      [path, target],
    );
    await once(owner, "message");
    owner.kill("SIGKILL");
    await once(owner, "exit");
    const release = await lock(path);
    await release();
  });
}

test("родная платформа: остановка затрагивает только процессы своего экземпляра", async (t) => {
  const token = randomBytes(24).toString("hex");
  const source = 'process.send("ready"); setInterval(() => {}, 1000);';
  const owned = worker(t, source, [], {
    ...process.env,
    WORKTREE_INSTANCE_TOKEN: token,
  });
  const other = worker(t, source, [], {
    ...process.env,
    WORKTREE_INSTANCE_TOKEN: `${token}-other`,
  });
  await Promise.all([once(owned, "message"), once(other, "message")]);
  assert.deepEqual(
    (await instanceProcesses(token)).map(({ pid }) => pid),
    [owned.pid],
  );
  await stopProcesses(token);
  assert.deepEqual(await instanceProcesses(token), []);
  assert.equal(process.kill(other.pid, 0), true);
});

function mockDarwinPs(t, respond) {
  platform(t, "darwin");
  const mocked = t.mock.method(
    childProcess,
    "spawn",
    (command, args, options) => {
      assert.equal(command, "/bin/ps");
      assert.ok(args.includes("-E"));
      assert.ok(args.includes("-ww"));
      assert.equal(options.env.LC_ALL, "C");
      assert.equal(options.env.WORKTREE_INSTANCE_TOKEN, undefined);
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => true;
      queueMicrotask(() => {
        const { stdout = "", code = 0 } = respond();
        child.stdout.end(stdout);
        child.stderr.end();
        child.emit("close", code, null);
      });
      return child;
    },
  );
  syncBuiltinESMExports();
  t.after(() => {
    mocked.mock.restore();
    syncBuiltinESMExports();
  });
}

const psLine = (pid, environment, start = "Mon Oct 19 07:00:00 2026") =>
  `  ${pid} ${start} node server.mjs ${environment}\n`;

test("macOS: BSD ps находит полный маркер и исключает чужие PID", async (t) => {
  mockDarwinPs(t, () => ({
    stdout:
      psLine(
        201,
        "PATH=/usr/bin WORKTREE_INSTANCE_TOKEN=owned HOME=/Users/dev",
      ) +
      psLine(202, "WORKTREE_INSTANCE_TOKEN=owned-other") +
      psLine(203, "OTHER_WORKTREE_INSTANCE_TOKEN=owned") +
      psLine(process.pid, "WORKTREE_INSTANCE_TOKEN=owned") +
      psLine(204, `LONG=${"x".repeat(4096)} WORKTREE_INSTANCE_TOKEN=owned`),
  }));
  assert.deepEqual(await instanceProcesses("owned"), [
    { pid: 201, start: "Mon Oct 19 07:00:00 2026" },
    { pid: 204, start: "Mon Oct 19 07:00:00 2026" },
  ]);
});

for (const replacement of [
  psLine(201, "WORKTREE_INSTANCE_TOKEN=owned", "Mon Oct 19 07:00:01 2026"),
  psLine(201, "WORKTREE_INSTANCE_TOKEN=other"),
  "",
]) {
  test(`macOS: перед сигналом перепроверяется PID (${replacement.trim() || "исчез"})`, async (t) => {
    let call = 0;
    mockDarwinPs(t, () => ({
      stdout:
        [psLine(201, "WORKTREE_INSTANCE_TOKEN=owned"), replacement, ""][
          call++
        ] ?? "",
    }));
    const kill = t.mock.method(process, "kill", () => true);
    await stopProcesses("owned");
    assert.equal(kill.mock.callCount(), 0);
  });
}

test("macOS: подтверждённый процесс получает SIGTERM", async (t) => {
  let call = 0;
  mockDarwinPs(t, () => ({
    stdout: call++ < 2 ? psLine(201, "WORKTREE_INSTANCE_TOKEN=owned") : "",
  }));
  const kill = t.mock.method(process, "kill", () => true);
  await stopProcesses("owned");
  assert.deepEqual(
    kill.mock.calls.map(({ arguments: args }) => args),
    [[201, "SIGTERM"]],
  );
});

test("macOS: ошибка ps прерывает остановку вместо ложного успеха", async (t) => {
  mockDarwinPs(t, () => ({ code: 1 }));
  const kill = t.mock.method(process, "kill", () => true);
  await assert.rejects(stopProcesses("owned"), /ps завершился с 1/);
  assert.equal(kill.mock.callCount(), 0);
});
