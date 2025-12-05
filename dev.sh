#!/bin/bash

# ============================================
# AURA Messaging Service - Script de Desarrollo
# ============================================

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   🚀 AURA Messaging Service - Modo Desarrollo${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. Verificar Node.js
echo -e "${YELLOW}[1/4]${NC} Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instala Node.js 20+"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# 2. Instalar dependencias
echo -e "${YELLOW}[2/4]${NC} Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "   Instalando dependencias (npm install)..."
    npm install
else
    echo -e "${GREEN}✓${NC} node_modules existe"
fi

# 3. Verificar archivo .env
echo -e "${YELLOW}[3/4]${NC} Verificando configuración..."
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado"
    if [ -f ".env.example" ]; then
        echo "   Copiando .env.example a .env..."
        cp .env.example .env
        echo -e "${GREEN}✓${NC} .env creado desde .env.example"
    else
        echo "❌ No hay .env.example. Crea el archivo .env manualmente"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} .env existe"
fi

# 4. Ejecutar migraciones (solo si la BD está disponible)
echo -e "${YELLOW}[4/4]${NC} Verificando migraciones..."
npm run db:migrate 2>/dev/null && echo -e "${GREEN}✓${NC} Migraciones ejecutadas" || echo "⚠️  Migraciones omitidas (BD no disponible)"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   ▶ Iniciando servidor de desarrollo...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Iniciar servidor de desarrollo
npm run dev
