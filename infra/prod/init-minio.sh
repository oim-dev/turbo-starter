#!/bin/sh
set -eu

mc alias set local http://minio:9000 "${MINIO_ROOT_USER:?}" "${MINIO_ROOT_PASSWORD:?}"
mc ready local
mc mb --ignore-existing local/demo-media
# Backend публикует постоянные ссылки CATALOG/EVIDENCE по решению пользователя.
mc anonymous set download local/demo-media/photos/
mc admin user add local "${S3_ACCESS_KEY:?}" "${S3_SECRET_KEY:?}"
mc admin policy create local demo-media /scripts/minio-policy.json
mc admin policy attach local demo-media --user "$S3_ACCESS_KEY"
