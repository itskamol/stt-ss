#!/bin/sh

set -e

echo "Running database migrations..."

npx prisma migrate deploy

echo "Migrations complete. Starting the application..."
exec "$@"