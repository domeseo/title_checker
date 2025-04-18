#!/bin/bash

# Script para ejecutar Gunicorn con configuración segura
# Este script debe tener permisos de ejecución: chmod +x run.sh

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    echo "Activando entorno virtual..."
    source venv/bin/activate
fi

# Verificar que Gunicorn está instalado
if ! command -v gunicorn &> /dev/null; then
    echo "Gunicorn no está instalado. Instalando..."
    pip install gunicorn>=22.0.0
fi

# Definir variables de entorno para SSL si se usa HTTPS
export GUNICORN_CMD_ARGS="--keyfile=./certs/key.pem --certfile=./certs/cert.pem" 

# Crear directorio de certificados si no existe (para producción)
if [ ! -d "./certs" ]; then
    mkdir -p ./certs
    # Esto es solo para desarrollo, en producción usar certificados reales
    echo "Creando certificados autofirmados para desarrollo..."
    openssl req -x509 -newkey rsa:4096 -keyout ./certs/key.pem -out ./certs/cert.pem -days 365 -nodes -subj "/CN=localhost" 2>/dev/null
fi

echo "Iniciando Gunicorn con configuración segura..."
gunicorn \
    --config gunicorn_config.py \
    --bind 0.0.0.0:5002 \
    api.routes:app 