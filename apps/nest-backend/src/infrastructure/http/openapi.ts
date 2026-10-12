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
          : 'Административное API с настраиваемыми ролями. Первый владелец создаётся при запуске на пустой БД. Первый вход Keycloak создаёт USER с isActive=false; до разрешения входа сессия не выдаётся. accounts.read позволяет просматривать пользователей, accounts.activate — разрешать вход без изменения роли. Роль и permissions доступны в /auth/me; требования операции — в x-admin-permissions. OWNER имеет все права, ADMIN — все несистемные, USER — собственный аккаунт. Назначение ролей, управление credentials и Keycloak доступно только OWNER.',
        'Файлы: любые расширения и содержимое, без прикладного лимита размера. /files защищён files.read/upload/update. SHA-256 обязателен; проверенные совпадения переиспользуются без передачи. Для крупных файлов S3 multipart: части подписываются POST /files/uploads/:id/parts/:part, complete проверяет точный размер и SHA-256 и публикует версию. Публичный Client API /files/:publicId/:filename отдаёт поток 200/206 без редиректов и раскрытия S3, поддерживает HEAD, Range, ETag. Имя документа берётся из первой загрузки и меняется только явно через PATCH /files/:id (title); оно задаёт отображение, URL и имя скачивания. Старые ссылки работают, имена и ссылки версий неизменны. По умолчанию выдаётся текущая версия; новая загрузка делает её текущей, PATCH /files/:id/current-version позволяет выбрать другую. Кеш требует revalidation; ETag учитывает версию, имя и MIME ответа. ?version=N — конкретная неизменяемая версия. Обычная ссылка — inline с MIME версии (текстовые исходники, включая MD, как text/plain), ?download=1 — attachment с исходным MIME. MIME определяется по расширению при загрузке и сохраняется в БД/S3; старый application/octet-stream уточняется по расширению версии. Размер хранится BIGINT, публичный контракт — точное число байтов.',
        'Вход и выход через браузер требуют заголовков Origin и X-CSRF-Protection: 1. Принимается любой корректный HTTP(S) Origin без allowlist; CORS открыт.',
        'Авторизация — только Bearer JWT в заголовке Authorization. При входе JWT возвращается в accessToken, cookie авторизации не устанавливаются. JWT и сессия действуют 7 дней (604800 секунд), включая Keycloak. Продления нет; после истечения срока нужен новый вход.',
        'Logout требует валидный JWT текущей сессии и немедленно отзывает её; повторный запрос возвращает 401. Успешная смена credentials отзывает все сессии аккаунта. Клиент удаляет сохранённый JWT после выхода, успешной смены credentials или терминального отказа Bearer. Исключение: 401 CURRENT_PASSWORD_INVALID при неверном текущем пароле не отзывает сессию и не требует удаления JWT. Клиентские и административные JWT не взаимозаменяемы.',
        'Изображения: /images защищён Bearer; Client видит только свои загрузки, Admin — глобальную галерею по images.read/upload/update. Presigned PUT передаёт файл непосредственно в MinIO, complete замораживает оригинал и сохраняет задание. GET не запускает обработку. Только ready-варианты публично доступны через Client API /media/images; оригинал выдаётся защищённой операцией как временная ссылка {url,expiresAt}.',
        'ImageDto сохраняет внутренний id UUID и содержит publicId (8 регистрозависимых base62 символов) и original.sha256 (серверно проверенный SHA-256 либо null). CreateImageUploadDto.sha256 необязателен: preflight возвращает {image,reused:true,upload:null} для доступного проверенного совпадения, иначе {image,reused:false,upload:{…}}. Complete возвращает плоский ImageCompleteDto с reused; при несовпадении заявленного SHA-256 — 400 IMAGE_HASH_MISMATCH. Дедупликация общая для admin-uploaded, Client — только в своём owner scope; admin без images.read не получает канонические метаданные через upload/complete/retry. Переиспользование сохраняет title/folder/tags/автора; queued/processing опрашиваются, failed можно retry без нового PUT.',
        'Читаемые URL вариантов: /media/images/:publicId/:format/:widthxheight, латинская x и фактическая геометрия готового файла. Legacy UUID/variantId URL сохраняют байты. search ищет подстроку filename/title/tags, полный UUID/publicId или ID из media URL, включая алиасы после backfill.',
        'Новые варианты изображений сохраняют пропорции исходника после EXIF без кадрирования и увеличения. Ширины 200,400,… до min(2000,ширина исходника); некратный максимум добавляется, заменяя последнюю сеточную ширину при остатке меньше 100 px. AVIF q80 и JPEG q92 либо PNG; выбор вариантов по (width,format). Для старых ready-записей manifest выбирает одну ранее опубликованную семью без смешения геометрии, все прежние UUID URL сохраняются.',
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
        413: 'Превышен лимит: 64 КиБ для JSON или настроенный лимит загрузки изображения.',
        415: 'Неподдерживаемое кодирование содержимого или кодировка символов.',
        500: 'Внутренняя ошибка сервера.',
        503: 'Хранилище или другая необходимая зависимость временно недоступны.',
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
