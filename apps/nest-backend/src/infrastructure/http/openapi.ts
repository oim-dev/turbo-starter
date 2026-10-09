import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, getSchemaPath, SwaggerModule } from '@nestjs/swagger';
import type { ApiConfig } from '../config/api-config';
import { ApiErrorDto } from './api-error.dto';

export function createOpenApiDocument(
  app: INestApplication,
  config: ApiConfig,
) {
  const builder = new DocumentBuilder()
    .setTitle(
      `Starter — ${config.realm === 'client' ? 'клиентское' : 'административное'} API`,
    )
    .setVersion('1.0.0')
    .setDescription(
      [
        config.realm === 'client'
          ? 'Публичное клиентское API. Регистрация создаёт учётную запись, но не сессию.'
          : 'Административное API с настраиваемыми ролями. Первый владелец создаётся при запуске на пустой БД; дополнительные аккаунты — через OWNER API. Роль и permissions доступны в /auth/me; требования операции — в x-admin-permissions. OWNER имеет все права, ADMIN — все несистемные, USER — собственный аккаунт. Управление доступом и Keycloak доступно только OWNER.',
        'Вход и выход через браузер требуют заголовков Origin и X-CSRF-Protection: 1. Принимается любой корректный HTTP(S) Origin без allowlist; CORS открыт.',
        'Авторизация — только Bearer JWT в заголовке Authorization. При входе JWT возвращается в accessToken, cookie авторизации не устанавливаются. JWT и сессия действуют 7 дней (604800 секунд), включая Keycloak. Продления нет; после истечения срока нужен новый вход.',
        'Logout требует валидный JWT текущей сессии и немедленно отзывает её; повторный запрос возвращает 401. Успешная смена credentials отзывает все сессии аккаунта. Клиент удаляет сохранённый JWT после выхода, успешной смены credentials или терминального отказа Bearer. Исключение: 401 CURRENT_PASSWORD_INVALID при неверном текущем пароле не отзывает сессию и не требует удаления JWT. Клиентские и административные JWT не взаимозаменяемы.',
      ].join('\n\n'),
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    );
  if (config.realm === 'admin') {
    builder.addCookieAuth(
      'admin_oidc_complete',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'Одноразовый browser-bound grant после OIDC callback; дополнительно требуется browser-binding cookie. Только для завершения входа, не для авторизации API.',
      },
      'admin-keycloak-completion',
    );
    builder.addCookieAuth(
      '__Host-admin_oidc_complete',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'HTTPS-вариант одноразового completion grant; имя и Secure определяются callback URL из настроек Keycloak в БД.',
      },
      'admin-keycloak-completion-secure',
    );
  }
  const document = SwaggerModule.createDocument(app, builder.build(), {
    extraModels: [ApiErrorDto],
  });
  for (const path of Object.values(document.paths)) {
    if (!path) continue;
    for (const method of ['get', 'post', 'patch', 'put', 'delete'] as const) {
      const operation = path[method];
      if (!operation) continue;
      for (const [status, description] of Object.entries({
        400: 'Некорректный запрос или неизвестные входные поля.',
        401: 'Неверные учётные данные или токен либо неактивная сессия.',
        403: 'Нет прав на действие либо некорректные заголовки браузерной авторизации.',
        404: 'Ресурс не найден или недоступен текущему пользователю.',
        409: 'Конфликт с существующими данными или повторное действие.',
        413: 'Превышен лимит: 64 КиБ для JSON.',
        415: 'Неподдерживаемое кодирование содержимого или кодировка символов.',
        429: 'Превышен лимит запросов.',
        500: 'Внутренняя ошибка сервера.',
      })) {
        operation.responses[status] ??= { description };
        const response = operation.responses[status];
        if (response && !('$ref' in response))
          response.content = {
            'application/json': {
              schema: { $ref: getSchemaPath(ApiErrorDto) },
            },
          };
      }
    }
  }
  return document;
}
