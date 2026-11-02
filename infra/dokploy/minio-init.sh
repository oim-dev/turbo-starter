#!/bin/sh
set -eu

mc alias set local http://minio:9000 "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}"
mc mb --ignore-existing "local/${S3_BUCKET}"
mc anonymous set none "local/${S3_BUCKET}"

if ! mc ilm rule ls --json "local/${S3_BUCKET}" | grep -F 'files/staging/' >/dev/null; then
  mc ilm rule add --prefix 'files/staging/' --expire-days 1 --noncurrent-expire-days 1 "local/${S3_BUCKET}"
fi
