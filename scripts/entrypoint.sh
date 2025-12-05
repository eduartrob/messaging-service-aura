#!/bin/sh
set -e

echo "🚀 Iniciando AURA Messaging Service..."
echo "──────────────────────────────────────────────────"

# Esperar a que PostgreSQL esté listo
echo "📦 Esperando a que PostgreSQL esté listo..."

max_retries=30
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    if pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" > /dev/null 2>&1; then
        echo "✅ PostgreSQL está listo!"
        break
    fi
    retry_count=$((retry_count + 1))
    echo "⏳ Esperando PostgreSQL... ($retry_count/$max_retries)"
    sleep 2
done

if [ $retry_count -eq $max_retries ]; then
    echo "❌ PostgreSQL no respondió después de $max_retries intentos"
    exit 1
fi

# Ejecutar migraciones
echo "📦 Ejecutando migraciones de base de datos..."
if npx sequelize-cli db:migrate --config src/infrastructure/database/config/config.js; then
    echo "✅ Migraciones completadas exitosamente"
else
    echo "⚠️ Error en migraciones, pero continuando..."
fi

echo "──────────────────────────────────────────────────"

# Iniciar la aplicación
echo "🚀 Iniciando servidor..."
exec node src/index.js
