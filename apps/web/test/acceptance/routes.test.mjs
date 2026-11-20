import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countLandmarks,
  headings,
  htmlAttribute,
  links,
  textOf,
  titleOf,
  withProductionServer,
} from "../support/html.mjs";

// Пример приёмочных HTTP-тестов маршрутов. Копируйте структуру для новых сценариев:
// один сервер на файл, проверки статуса, заголовков, текстов и ссылок.
const request = withProductionServer();

test("главная отдаёт серверный HTML с заголовком и описанием", async () => {
  const page = await request("/");

  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type") ?? "", /text\/html/);
  assert.equal(htmlAttribute(page.html, "lang"), "ru");
  assert.equal(titleOf(page.html), "Главная");
  assert.equal(countLandmarks(page.html, "main"), 1);
  assert.deepEqual(headings(page.html, 1), ["Стартовое приложение"]);
  assert.match(textOf(page.html), /не обращается к API/);
});

test("неизвестный адрес возвращает 404 со ссылкой на главную", async () => {
  const page = await request("/acceptance-missing-page");

  assert.equal(page.status, 404);
  assert.deepEqual(headings(page.html, 1), ["Страница не найдена"]);
  assert.ok(
    links(page.html).some((link) => link.href === "/" && link.text === "На главную"),
    "ожидается ссылка «На главную» на /",
  );
});
