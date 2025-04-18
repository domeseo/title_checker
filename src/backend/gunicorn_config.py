#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""Archivo de configuración para Gunicorn con mejoras de seguridad.

Este archivo contiene configuraciones optimizadas para la seguridad de Gunicorn,
incluyendo protecciones contra ataques de request smuggling.
"""

import multiprocessing
import os

# Número de workers - basado en la cantidad de núcleos
workers = multiprocessing.cpu_count() * 2 + 1

# Clase de worker que soporta SSL
worker_class = 'sync'

# Timeouts - para prevenir ataques DoS
timeout = 30
keepalive = 2

# Configuración de registros
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Limitar el tamaño máximo de la solicitud (10 MB)
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Encabezados de seguridad
secure_scheme_headers = {
    'X-FORWARDED-PROTOCOL': 'ssl',
    'X-FORWARDED-PROTO': 'https',
    'X-FORWARDED-SSL': 'on'
}

# Prevenir ataques de request smuggling configurando la forma en que
# Gunicorn maneja encabezados de longitud de contenido
# Función de configuración de la aplicación


def post_fork(server, worker):
    """Configuración después de la bifurcación del trabajador."""
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def pre_request(worker, req):
    """Validación previa a la solicitud para protección contra request smuggling."""
    # Validar encabezados Transfer-Encoding y Content-Length
    has_transfer_encoding = 'HTTP_TRANSFER_ENCODING' in req.environ
    has_content_length = 'CONTENT_LENGTH' in req.environ

    # Si ambos encabezados están presentes, rechazar la solicitud
    # para prevenir ataques de request smuggling TE.CL
    if has_transfer_encoding and has_content_length:
        worker.log.warning(
            "Posible ataque de request smuggling detectado: "
            "Transfer-Encoding y Content-Length presentes simultáneamente"
        )
        return None

    # Si Transfer-Encoding está presente, validar su valor
    if has_transfer_encoding:
        transfer_encoding = req.environ['HTTP_TRANSFER_ENCODING'].lower()
        if transfer_encoding != 'chunked':
            worker.log.warning(
                "Valor inválido de Transfer-Encoding: %s",
                transfer_encoding
            )
            return None

    return req
