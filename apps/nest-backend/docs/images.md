# Изображения

Изображение получает UUID при создании загрузки. Оригинал хранится побайтно,
а все производные заранее записываются в приватный MinIO. HTTP API не преобразует
изображения и не подключается к RabbitMQ/imgproxy при запуске. Отдельный
`image-worker` — Nest application context без HTTP-порта.

## Запуск

Из корня репозитория:

```sh
pnpm --filter @oim/nest-backend prisma:generate
pnpm --filter @oim/nest-backend dev:client
pnpm --filter @oim/nest-backend dev:admin
pnpm --filter @oim/nest-backend dev:worker
```

`dev`, `build`, `start` backend охватывают все три процесса. Отдельные команды:
`build:worker`, `start:worker`; последняя запускает `dist/image-worker/main.js`.
Для контейнера backend worker используется тот же runtime image и команда
`node dist/image-worker/main.js`. Инфраструктура — профиль `images` из
[infra/dev](../../../infra/dev/README.md).

Новая миграция `20261011120000_images_pipeline` добавляет `Image`, `ImageVariant`,
`ImageJob`, `ImageOutbox` и индексы; существующие аккаунты не меняются. Применение
миграций выполняется отдельно от запуска приложений. Проверять миграции следует
на изолированной БД: исторические миграции проекта содержат удаление прежних
продуктовых данных.

## Настройки

Канонический набор — `.env.example` (копия `env.example` идентична).
Явное окружение приоритетнее env-файлов; `DOTENV_CONFIG_PATH=/dev/null`
отключает их загрузку при изолированных проверках.

| Параметр | Значение по умолчанию / назначение |
| --- | --- |
| `S3_ENDPOINT` | `http://localhost:9000`; адрес MinIO для backend и браузерных presigned URL |
| `S3_INTERNAL_ENDPOINT` | `http://minio:9000`; источник для imgproxy внутри Compose |
| `S3_REGION`, `S3_BUCKET` | `us-east-1`, `default-bucket` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Учетные данные MinIO; dev-значения в шаблоне |
| `RABBITMQ_URL` | AMQP URL с vhost `/images`; dev-значение в шаблоне |
| `IMGPROXY_URL` | `http://localhost:18080`; worker → imgproxy |
| `IMGPROXY_KEY`, `IMGPROXY_SALT` | По 32 байта в hex, совпадают с imgproxy |
| `IMAGE_PUBLIC_BASE_URL` | `http://localhost:4000`; внешний адрес Client API, без `/media` |
| `IMAGE_MAX_UPLOAD_BYTES` | `20971520` (20 МиБ) |
| `IMAGE_MAX_SOURCE_PIXELS` | `40000000` (после учета ориентации) |
| `IMAGE_WORKER_CONCURRENCY` | `2`, диапазон 1–16; одновременно обрабатываемые изображения |

Все обращения к MinIO используют официальный `minio` SDK. Два ленивых `Client`
отдельно подписывают public/internal URL: host после подписи не подменяется.
`S3_ENDPOINT` должен быть доступен и процессам backend, и браузеру; в контейнерном
развёртывании нужен общий доступный hostname/reverse proxy. Только imgproxy
использует `S3_INTERNAL_ENDPOINT`. Bucket закрыт; его создание и CORS принадлежат
инфраструктуре, а не startup API.

## HTTP-контракт

Все `/images` защищены Bearer JWT соответствующего API, `Cache-Control: no-store`.
Client видит и изменяет только записи с `(ownerRealm=client, ownerId=subject)`;
попытка обратиться к чужому UUID даёт 404. Admin видит глобальную галерею.
Снимок имени и логина автора фиксируется на момент загрузки.

| Метод и путь | OperationId Admin / Client | Право Admin |
| --- | --- | --- |
| `GET /images` | `adminImageList` / `clientImageList` | `images.read` |
| `GET /images/facets` | `adminImageFacets` / `clientImageFacets` | `images.read` |
| `GET /images/:id` | `adminImageGet` / `clientImageGet` | `images.read` |
| `POST /images/uploads` | `adminImageCreateUpload` / `clientImageCreateUpload` | `images.upload` |
| `POST /images/:id/complete` | `adminImageComplete` / `clientImageComplete` | `images.upload` |
| `PATCH /images/:id` | `adminImageUpdate` / `clientImageUpdate` | `images.update` |
| `POST /images/:id/retry` | `adminImageRetry` / `clientImageRetry` | `images.upload` |
| `GET /images/:id/original` | `adminImageOriginal` / `clientImageOriginal` | `images.read` |

Все три permissions несистемные, доступны OWNER/ADMIN, назначаются дополнительным
ролям. USER по умолчанию их не получает. Client проверяет собственную сессию и owner
scope, административные permissions к нему не применяются.

### Загрузка

1. `POST /images/uploads` принимает `CreateImageUploadDto`:
   `{ filename, contentType, byteSize, title?, folder?, tags? }`.
   Принимаются только `image/jpeg`, `image/png`, `image/webp`. `byteSize` — точный
   размер файла, не оценка; превышение лимита даёт 413. Все варианты сохраняют
   пропорции исходника. Неизвестные поля, включая прежнее `presets`, дают 400.
2. Ответ 201 — `ImageUploadDto`: `{ image, upload: { url, method:'PUT', headers,
   expiresAt } }`. URL действителен 15 минут и указывает только на staging key.
   Браузер отправляет исходный файл и возвращённые headers непосредственно в MinIO,
   без JWT API. Создание загрузки не идемпотентно: автоматически повторять POST нельзя.
   Presigned PUT SDK не ограничивает размер тела при приёме MinIO; проверка точного
   размера выполняется на complete и ещё раз worker до преобразования.
3. `POST /images/:id/complete` без тела делает stat staging и server-side copy в
   новый приватный UUID key, с `MatchETag` и `VersionID` при наличии versioning.
   Ссылка на замороженный оригинал, job и outbox фиксируются одной транзакцией.
   При параллельных complete только один результат становится оригиналом.
   Повторный PUT старой staging-ссылкой не может изменить оригинал/варианты.
4. Ответ — `ImageDto`, 202 для queued/processing, 200 для уже ready/failed.
   Complete идемпотентен; повтор не создаёт второй job. При отсутствующем или
   изменившемся staging — 409 `UPLOAD_NOT_AVAILABLE`; при ошибке MinIO — 503.
5. После complete UI опрашивает список/метаданные до ready/failed. GET никогда
   не создаёт сообщения, задания или производные.

`ImageDto` содержит `id`, `filename`, `title`, `folder: string|null`, `tags`,
`status: uploading|queued|processing|ready|failed`, `createdAt`, `updatedAt`,
`uploadedBy:{id,realm,name,login}`, `original:{contentType,byteSize,width,height}`,
`variants`, `error:{code,message}|null`. Геометрия оригинала до успешной
обработки nullable, после неё учитывает EXIF orientation. Никаких S3 keys или
служебных сообщений брокера в DTO нет.

`variants` пуст до атомарного ready всего набора. Каждый `ImageVariantDto` содержит
`id`, `width`, `height`, `format`, `mimeType`, `byteSize`, `url`.
На одной ширине могут быть два формата: выбирать нужно по `(width,format)`.
Manifest отсортирован по ширине, затем формату; `srcset` собирается отдельно для
каждого формата. Полей `presets`/`preset` в JSON-ответах нет.

### Галерея и классификация

`GET /images` возвращает `{items,total,page,pageSize}`. Query: `page` (default 1),
`pageSize` (default 24, максимум 100), `search`, `folder`, `tag`, `status`, `unfiled`.
Поиск нечувствителен к регистру, подстрока имени, заголовка или тега. `%` и `_`
считаются обычными символами. Папка/тег фильтруются точным совпадением после
нормализации; `unfiled=true` несовместим с непустым `folder`. Сортировка
`createdAt DESC, id DESC`, count и страница читаются в одном snapshot.

`GET /images/facets` возвращает `{folders:[{name,count}],tags:[{name,count}],total,
unfiledCount}` по всей доступной галерее, независимо от текущих фильтров страницы.

`PATCH /images/:id` принимает только `{title?,folder?,tags?}`. Папка — категория-путь
до 255 символов; `null`/пустая строка убирает папку. Пробелы вокруг сегментов и
пустые сегменты `/` удаляются; `.`/`..` запрещены. Теги: максимум 20, до 64 символов,
NFC, trim, нижний регистр, уникальность, стабильная сортировка; `[]` удаляет все.
Название до 255 символов, пустая строка допустима. Метаданные не меняют object key,
геометрию вариантов или оригинальные байты.

### Доставка

`GET /media/images/:id/:variantId` принадлежит Client API (`clientImageMedia`).
Это публичный бинарный ответ только для ready-набора, с MIME из проверенного
результата, `Content-Length`, `ETag`, `Cache-Control: public,max-age=31536000,immutable`,
`Cross-Origin-Resource-Policy: cross-origin`. `If-None-Match` даёт 304. URL не содержит
transform-параметров. Оригинал/сторонний UUID/частично записанный набор даёт 404.

`GET /images/:id/original` возвращает `ImageOriginalLinkDto: {url,expiresAt}`.
Ссылка MinIO действует 5 минут, привязана к versionId при его наличии, выдаёт файл
как attachment с `application/octet-stream`, `private,no-store`. До complete — 409.
Получение ссылки требует авторизации; готовая временная ссылка является bearer
capability и может использоваться браузером для скачивания без JWT MinIO.

### Совместимость ранее опубликованных изображений

Существующая схема БД сохраняет enum `ImagePreset`, `Image.presets` и
`ImageVariant.preset` как узкий переходный слой хранения прежних записей.
Это не API пресетов: клиент не выбирает режим, planner не принимает его,
worker не исполняет старые настройки даже после complete/retry. Новые Image и
ImageVariant записывают только внутренний маркер `original`.

Для старого ready-изображения manifest выбирает все варианты семьи `original`.
Если их нет, выбирается ровно одна существующая legacy-семья: сначала `square`,
иначе `landscape`. Только в этом переходном случае manifest может показывать
ранее сохранённое кадрирование; разные геометрии никогда не смешиваются в `srcset`.
Размеры `original` по-прежнему описывают исходник после EXIF, размеры каждого
варианта — его фактические байты.

Старые объекты, строки вариантов, UUID и публичные URL сохраняются, включая
варианты вне выбранной семьи manifest. `/media/images/:id/:variantId` продолжает
выдавать любой существующий вариант ready-изображения по прежнему UUID.
GET не выполняет миграцию, перегенерацию или запись; схема и исторические миграции
для этого перехода не меняются.

## Геометрия и качество

- Только пропорциональный resize исходника: `resize:fit:<width>:0:0`, без
  кадрирования и увеличения (`enlarge=0`), каждый размер независимо от исходника.
  Высота округляется до целого пикселя, минимум 1; при проверке результата
  допускается расхождение высоты на 1 px из-за округления imgproxy.
- Максимальная ширина `maximum = min(2000, source.width)` берётся **после EXIF
  orientation**. Строится сетка 200, 400, … до maximum. Если maximum не кратен 200,
  он добавляется в конец; при остатке `maximum - lastGrid < 100` последняя сеточная
  ширина предварительно удаляется. Ровно 100 px сохраняет обе ширины. Если сетка
  пуста, остаётся только maximum. Лимит 2000 относится к ширине, не к высоте.

  | Ширина исходника после EXIF | Итоговые ширины |
  | --- | --- |
  | 73 / 199 / 200 / 201 / 299 | `[73]` / `[199]` / `[200]` / `[201]` / `[299]` |
  | 300 | `[200,300]` |
  | 810 | `[200,400,600,810]` |
  | 850 | `[200,400,600,850]` |
  | 900 | `[200,400,600,800,900]` |
  | 950 | `[200,400,600,800,950]` |
  | 2000 / 2001 и больше | `[200,400,600,800,1000,1200,1400,1600,1800,2000]` |

- Известный непрозрачный JPEG получает AVIF quality 80 и JPEG quality 92.
  PNG/WebP (включая графику и alpha) получают AVIF quality 80 и PNG без quantize.
  PNG не получает параметр quality. При любой стороне меньше 16 px AVIF пропускается,
  остаётся JPEG/PNG: это избегает неявного fallback AVIF-кодера.
- Только indexed PNG (`IHDR.colorType=3`) сначала нормализуется один раз в
  полноразмерный несжатый RGB/RGBA8 TIFF через тот же imgproxy:
  `ar:1/sm:1/kcr:0/scp:0/ph:1/f:tiff`, без resize. Это устраняет дополнительную
  палитровую квантизацию и искажение alpha, которые imgproxy иначе допускает даже
  при `IMGPROXY_PNG_QUANTIZE=false`. ICC сохраняется (`scp:0`) до обычного конечного
  преобразования в sRGB (`scp:1`). Все ширины строятся независимо из одного
  TIFF, без каскадов resize или промежуточных JPEG/AVIF. Обычные JPEG, truecolor
  PNG и WebP идут непосредственно из оригинала.
- Политика — **визуально высокое качество**, не pixel-lossless. JPEG/AVIF используют
  сжатие с потерями; ресайз и преобразование цвета также меняют пиксели.
  Ни q92, ни q100 не означают lossless JPEG. Вес производной может превосходить
  оригинал. Оригинал сохраняется побайтно и скачивается отдельно.
- OSS imgproxy закреплён инфраструктурой на `4.0.12` с digest. Нужны
  `IMGPROXY_STRIP_METADATA=true`, `IMGPROXY_AUTO_ROTATE=true`,
  `IMGPROXY_PNG_QUANTIZE=false`, `IMGPROXY_ENABLE_DEBUG_HEADERS=true`.
  Worker явно передаёт `auto_rotate:1`, `strip_metadata:1`, `strip_color_profile:1`:
  последний выполняет ICC→sRGB перед удалением профиля, а не просто выкидывает ICC.
  HDR/исходная битность производных не гарантируются.
- Worker проверяет magic/type, реальную длину и pixel limit до обращения к imgproxy.
  JPEG orientation 5–8 меняет местами width/height; PNG tRNS/цветовые типы 4/6 и
  WebP VP8X/ALPH/VP8L учитываются для alpha. EXIF PNG/WebP также читается.
  Анимация PNG/WebP, GIF, SVG, AVIF, HEIC и прочие типы входа отклоняются с понятной
  ошибкой; MIME, заявленный клиентом, не является доказательством типа.
- Байты результата снова проверяются `image-size`, Content-Type и ожидаемой
  геометрией. Для AVIF debug headers содержат реальный размер вместо BMFF tile;
  fallback без debug использует parser и отклоняет несовпадение. Обработка только
  в imgproxy, Node не содержит sharp/libvips transforms.

### Временный TIFF для indexed PNG

TIFF хранится только под `images/normalization/<uuid>.tiff` в приватном bucket,
`Content-Type: image/tiff`, `Cache-Control: private,no-store`. Он не попадает в
`ImageVariant`, DTO, галерею или публичную выдачу. Для чтения imgproxy получает
отдельный internal presigned URL, подписанный официальным MinIO SDK.

Нормализация имеет таймаут 120 секунд под общим lease heartbeat задания.
Допустимый размер — максимум `IMAGE_MAX_SOURCE_PIXELS × 4 + 1 МиБ`, дополнительно
ограниченный фактической геометрией источника по той же формуле. При 40 МП это
около 160 МБ плюс запас на TIFF headers/ICC, а не upload-лимит 20 МиБ. Проверяются
HTTP MIME, Content-Length, отсутствие Content-Encoding, debug width/height и точная
длина потока. Передача imgproxy → MinIO потоковая; SDK использует части по 8 МиБ,
полного TIFF Buffer в worker нет.

После записи worker читает только небольшие MinIO ranges (до 4096 байт) и проверяет
TIFF magic, единственный ограниченный IFD, width/height, Compression=1,
PhotometricInterpretation=RGB, 8-битные каналы, отсутствие ColorMap и
непредумноженную alpha (`ExtraSamples=2`). Ориентация уже применена, TIFF имеет
Orientation=1. Ошибка этих проверок даёт `INVALID_NORMALIZED_IMAGE`.

Глобальный `IMGPROXY_MAX_RESULT_DIMENSION=2000` использовать нельзя: нормализация
должна сохранять полный размер исходника. Ограничение 2000 относится только к
URL конечных вариантов. Если у imgproxy задан `IMGPROXY_MAX_SRC_FILE_SIZE`, он
должен пропускать внутренний TIFF по указанной формуле, а не только upload PNG.

TIFF и незавершённый multipart удаляются best-effort при завершении/ошибке попытки.
После аварийного завершения процесса может остаться приватный orphan; для префикса
`images/normalization/` допустим отдельный lifecycle с запасом больше 30-минутного
дедлайна задания. Cleanup оригиналов и публичных вариантов к этому префиксу
не относится. TIFF-этап сохраняет данные палитры без дополнительной ошибки, но
конечные JPEG/AVIF по-прежнему имеют политику визуально высокого качества,
а не гарантию pixel-lossless.

## Надёжность

- Одна запись job на изображение, sequential variants; одновременно по умолчанию
  два изображения на worker. Semaphore сохраняет предел и при reconnect AMQP.
- Durable очереди `images.process.v1` и `images.dead.v1`, persistent сообщения
  `{jobId,dispatchVersion}`. Publisher confirmations + mandatory routing; отметка
  outbox `publishedAt` пишется после confirm. Потеря ответа даёт безопасную повторную
  доставку. AMQP consumer использует manual ack после persist ready/failed/retry.
- Claim и финализация защищены leaseToken, статусом и dispatchVersion в PostgreSQL.
  Дубликаты/устаревшие сообщения не запускают вторую конверсию. Lease 120 секунд,
  heartbeat 30 секунд, восстановление каждые 2 секунды и при запуске worker.
- До трёх попыток обработки, паузы 10 и 30 секунд; ошибки типа/геометрии/pixel limit
  терминальные сразу. Каждая повторная попытка получает новую версию доставки.
  После отказа новый DLQ outbox фиксируется в той же транзакции, что и failed.
  Ошибка БД не приводит к ACK: закрытие канала возвращает unacked сообщение.
- Общий дедлайн ожидания/обработки — 30 минут. Recovery работает даже при отказе
  broker и переводит такие задания в failed с `PROCESSING_TIMEOUT`. Незавершённые
  uploads через 15 минут становятся `UPLOAD_EXPIRED`. Пока все worker-процессы
  остановлены, обновлений статусов нет; при восстановлении дедлайны проверяются.
- Publisher повторяет недоставленные outbox с экспоненциальной паузой до 5 минут;
  processing retry ограничен тремя попытками/дедлайном. DLQ сохраняется при отказе
  брокера и доставляется после его восстановления.
- `POST /images/:id/retry` — только failed исходное задание, 202. Сбрасывает бюджет
  попыток/дедлайн, фиксирует outbox; оригинал остаётся прежним, создаются только
  пропорциональные варианты по текущей сетке ширин. До complete
  задания нет, retry даёт 409: нужна новая загрузка. Повтор retry уже queued даёт 409.
- Каждый объект получает уникальный key; новые попытки не перезаписывают публичные
  байты. Ready публикуется только после записи всего набора и транзакции вариантов.
  Оборванная до commit загрузка может оставить приватный orphan. Автоматического
  удаления orphan-оригиналов/вариантов нет: их нельзя удалять после неясного commit.
  Staging удаляется best-effort; для просроченных staging уместен отдельный lifecycle
  по префиксу `images/staging/` с запасом больше 15 минут. Originals/variants этим
  lifecycle охватывать нельзя.

## Проверки

```sh
DOTENV_CONFIG_PATH=/dev/null pnpm --filter @oim/nest-backend check-types
pnpm --filter @oim/nest-backend lint
DOTENV_CONFIG_PATH=/dev/null pnpm --filter @oim/nest-backend build
DOTENV_CONFIG_PATH=/dev/null pnpm --filter @oim/nest-backend openapi:generate
pnpm env:check
```

Генерация OpenAPI/Prisma и сборка не требуют БД, MinIO, RabbitMQ или imgproxy.
Не запускать lint одновременно с `prisma generate`: генератор заменяет каталог
типов. SDK регенерирует назначенный владелец workspace после экспорта OpenAPI.
Автоматических тестов backend нет. Ручная приёмка в изолированной среде:

1. JWT обоих контуров, owner scope, ADMIN/OWNER/USER и каждая permission.
2. JPEG с EXIF orientation, PNG alpha/tRNS/indexed, WebP; пропорциональные размеры,
   ширины 73, 199, 200, 201, 299, 300, 810, 850, 900, 950, 2000, 2001.
   MIME/геометрия скачанных вариантов; AVIF q80, JPEG q92, PNG без quantize.
3. Параллельный complete, повторный PUT staging, неизменный hash скачанного оригинала.
4. `GET /images`/facets/metadata/public media при остановленном broker/imgproxy;
   новые GET не создают outbox/job.
5. Ложный MIME, несовпадение размеров, превышение pixel limit, animation/unsupported.
6. Остановка imgproxy, ограниченные retry, failed и DLQ; восстановление через retry.
7. Аварийное завершение worker посреди обработки, истечение lease, отсутствие дублей
    в ready-наборе; падение broker между публикацией и persist outbox.
8. Старые ready-наборы с несколькими геометриями и без original-семьи: одна семья
   в manifest, прежние UUID URL доступны, полей `presets`/`preset` в JSON нет.
   Старое failed-задание после retry использует только пропорции исходника.

Артефакты ручных сценариев сохраняются в `.artifacts/nest-backend/<сессия>/`.
