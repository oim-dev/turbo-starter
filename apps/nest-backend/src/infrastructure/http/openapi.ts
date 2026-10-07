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
          : 'Закрытое административное API. Самостоятельная регистрация не предусмотрена. Учётная запись создаётся через bootstrap/CLI. Текущая роль доступна в /auth/me; разрешённые роли защищённой операции — в x-admin-roles.',
        'Вход, обновление токенов и выход через браузер требуют заголовков Origin и X-CSRF-Protection: 1. Origin должен входить в allowlist соответствующего API (CLIENT_ALLOWED_ORIGINS или ADMIN_ALLOWED_ORIGINS); тот же список используется для CORS с учётными данными. Для Swagger включите собственный origin API в allowlist.',
        'Каждый токен обновления используется только один раз; подтверждённое повторное использование отзывает сессию. Выполняйте обновление токенов последовательно во всех вкладках и на всех устройствах, использующих одну сессию.',
        'При потере ответа на запрос обновления токенов может потребоваться повторный вход. Срок действия сессии фиксирован.',
      ].join('\n\n'),
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addCookieAuth(
      config.cookieName,
      { type: 'apiKey', in: 'cookie' },
      'refresh-cookie',
    );
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
