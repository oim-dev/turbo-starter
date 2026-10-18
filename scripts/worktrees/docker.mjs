import { join } from "node:path";
import { access } from "node:fs/promises";
import { run, saveJson, readJson, withoutEnvironment } from "./system.mjs";
import { environmentKeys } from "./environment.mjs";

function dockerEnv() {
  return withoutEnvironment(
    Object.keys(process.env).filter(
      (key) =>
        key.startsWith("COMPOSE_") ||
        key === "DOCKER_HOST" ||
        key === "DOCKER_CONTEXT",
    ),
  );
}

export function docker(record, args, capture = false) {
  return run("docker", ["--context", record.context, ...args], {
    env: dockerEnv(),
    capture,
  });
}

export async function snapshot(record, directory) {
  const env = withoutEnvironment([
    ...(await environmentKeys(record.path)),
    ...Object.keys(process.env).filter(
      (key) =>
        key.startsWith("COMPOSE_") ||
        key === "DOCKER_HOST" ||
        key === "DOCKER_CONTEXT",
    ),
  ]);
  const content = await run(
    "docker",
    [
      "--context",
      record.context,
      "compose",
      "--project-name",
      record.project,
      "--env-file",
      join(record.path, "infra/dev/.env"),
      "-f",
      join(record.path, "infra/dev/docker-compose.yml"),
      "config",
      "--format",
      "json",
    ],
    { env, capture: true, cwd: record.path },
  );
  const config = JSON.parse(content);
  for (const resource of [
    ...Object.values(config.volumes ?? {}),
    ...Object.values(config.networks ?? {}),
  ]) {
    if (resource.external || !resource.name?.startsWith(`${record.project}_`))
      throw new Error("Окружение требует собственные Compose volumes и сети.");
  }
  for (const service of Object.values(config.services)) {
    if (service.container_name)
      throw new Error("container_name мешает изоляции worktree.");
    if (service.build && !record.images.includes(service.image))
      throw new Error("Собираемый образ должен принадлежать этому окружению.");
    if (service.build) {
      service.build.labels = {
        ...service.build.labels,
        "dev.oim.worktree": record.id,
      };
    }
    if (service.volumes?.some((volume) => volume.type === "bind"))
      throw new Error(
        "Worktree-инфраструктура использует именованные volumes, а не bind mounts.",
      );
  }
  // Снимок живёт вне worktree: teardown возможен даже после удаления env/compose в задаче.
  await saveJson(join(directory, "compose.json"), config);
}

export function compose(record, directory, args, capture = false) {
  return docker(
    record,
    [
      "compose",
      "--project-name",
      record.project,
      "-f",
      join(directory, "compose.json"),
      ...args,
    ],
    capture,
  );
}

export async function cleanupDocker(record, directory, volumes) {
  await docker(record, ["info", "--format", "{{.ServerVersion}}"], true);
  const config = join(directory, "compose.json");
  const hasSnapshot = await access(config).then(
    () => true,
    (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    },
  );
  if (hasSnapshot) {
    const saved = await readJson(config);
    if (saved.name !== record.project)
      throw new Error(
        "Имя Compose в снимке не совпадает с владельцем окружения.",
      );
    await compose(record, directory, [
      "down",
      "--remove-orphans",
      ...(volumes ? ["--volumes"] : []),
    ]);
  }
  const filter = `label=com.docker.compose.project=${record.project}`;
  const ids = (text) => text.split(/\s+/).filter(Boolean);
  // Ветка могла добавить сервисы/volumes после первого запуска. Удаляем только по метке владельца.
  const containers = ids(
    await docker(record, ["ps", "-aq", "--filter", filter], true),
  );
  if (containers.length)
    await docker(record, [
      "rm",
      "--force",
      ...(volumes ? ["--volumes"] : []),
      ...containers,
    ]);
  if (volumes) {
    const ownedVolumes = ids(
      await docker(record, ["volume", "ls", "-q", "--filter", filter], true),
    );
    if (ownedVolumes.length)
      await docker(record, ["volume", "rm", ...ownedVolumes]);
  }
  const networks = ids(
    await docker(record, ["network", "ls", "-q", "--filter", filter], true),
  );
  if (networks.length) await docker(record, ["network", "rm", ...networks]);
  if (volumes) {
    for (const image of record.images) {
      const found = await docker(
        record,
        ["image", "ls", "-q", "--filter", `reference=${image}`],
        true,
      );
      if (found) await docker(record, ["image", "rm", image]);
    }
    const previousImages = ids(
      await docker(
        record,
        [
          "image",
          "ls",
          "--all",
          "-q",
          "--filter",
          `label=dev.oim.worktree=${record.id}`,
        ],
        true,
      ),
    );
    if (previousImages.length)
      await docker(record, ["image", "rm", ...new Set(previousImages)]);
  }
}
