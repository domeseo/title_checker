# Guía de Seguridad para SERP Title Checker

Este documento proporciona una guía para mantener la seguridad de la aplicación SERP Title Checker.

## Configuración Segura

### Variables de Entorno
- **NUNCA** incluyas el archivo `.env` en el repositorio
- Utiliza el archivo `.env.example` como plantilla
- Genera claves seguras utilizando el script `src/generate_keys.py`
- Cambia regularmente las claves secretas

### Claves API
- Almacena las claves API de manera segura
- Nunca expongas la clave API de OpenAI en el cliente
- Utiliza el mecanismo de encriptación proporcionado en la aplicación

## Prácticas Recomendadas

### Actualizaciones
- Mantén todas las dependencias actualizadas
- Ejecuta regularmente `pip install -r requirements.txt --upgrade`
- Supervisa las alertas de seguridad de GitHub

### CORS y Acceso
- Configura correctamente los orígenes permitidos en CORS
- Limita el acceso a la API según sea necesario
- Implementa rate limiting para prevenir abusos

### Entrada del Usuario
- Valida todas las entradas del usuario
- Sanitiza correctamente cualquier entrada antes de procesarla
- Evita almacenar datos sensibles proporcionados por el usuario

## Despliegue

### Servidor
- Utiliza HTTPS en producción
- Configura correctamente los encabezados de seguridad HTTP
- Considera el uso de un WAF (Web Application Firewall)

### Monitoreo
- Implementa registro (logging) para eventos de seguridad
- Supervisa intentos de acceso sospechosos
- Configura alertas para comportamientos anómalos

## Respuesta a Incidentes

Si descubres una vulnerabilidad de seguridad, por favor:
1. No la expongas públicamente
2. Contacta al equipo de desarrollo inmediatamente
3. Proporciona detalles suficientes para reproducir el problema

## Lista de Verificación de Seguridad

- [ ] Archivo `.env` actualizado con claves seguras y no incluido en el repositorio
- [ ] Todas las dependencias actualizadas a las últimas versiones
- [ ] Configuración CORS limitada a orígenes específicos
- [ ] Validación de entradas implementada en todos los endpoints
- [ ] Encriptación adecuada para datos sensibles
- [ ] Implementación de HTTPS en producción 

## Vulnerabilidades Conocidas y Mitigaciones

### Gunicorn Request Smuggling (CVE-2023-41265)

**Problema**: Gunicorn versiones anteriores a 22.0.0 no validan correctamente el encabezado 'Transfer-Encoding' según los estándares RFC, lo que lleva al uso del método de fallback 'Content-Length'. Esto hace que la aplicación sea vulnerable a ataques de "Request Smuggling" tipo TE.CL.

**Impacto potencial**:
- Envenenamiento de caché
- Exposición de datos
- Manipulación de sesiones
- Server-Side Request Forgery (SSRF)
- Cross-Site Scripting (XSS)
- Denegación de servicio (DoS)
- Compromiso de integridad de datos
- Bypass de seguridad
- Fuga de información
- Abuso de lógica de negocio

**Mitigación**:
1. Se actualizó Gunicorn a la versión 22.0.0 o superior
2. Se implementó un archivo de configuración personalizado (`gunicorn_config.py`)
3. Se añadió validación adicional de encabezados en `pre_request` para rechazar solicitudes con encabezados Transfer-Encoding y Content-Length simultáneos

**Verificación**:
Para verificar que estás usando una versión segura de Gunicorn, ejecuta:
```bash
pip show gunicorn
```

Para implementar la mitigación adicional:
1. Usa el script `src/backend/run.sh` para iniciar la aplicación
2. O inicia Gunicorn manualmente con:
```bash
gunicorn --config src/backend/gunicorn_config.py --bind 0.0.0.0:5002 api.routes:app
```

### Regular Expression Denial of Service (ReDoS) en nth-check (CVE-2021-3803)

**Problema**: El paquete `nth-check` contiene una vulnerabilidad de Regular Expression Denial of Service (ReDoS) que puede causar una denegación de servicio cuando se analizan expresiones CSS nth-check malformadas.

**Impacto potencial**:
- Denegación de servicio (DoS)
- Consumo excesivo de CPU
- Tiempos de respuesta del servidor extremadamente largos
- Caída de la aplicación en casos graves

**Detalles técnicos**:
Las vulnerabilidades ReDoS se producen principalmente debido al subpatrón `\s*(?:([+-]?)\s*(\d+))?` con adyacencia superpuesta cuantificada. Un atacante puede explotar esto con entrada como `2n` seguido de un gran número de espacios y luego un carácter no válido.

**Mitigación**:
1. Se actualizó la dependencia `nth-check` a la versión 2.1.1 o superior mediante:
   - Resoluciones en package.json
   - Parche directo de las instancias vulnerables en node_modules
2. Se ejecutó un script personalizado (`fix-security.js`) para asegurar que todas las instancias anidadas del paquete también estén parcheadas

**Verificación**:
Para verificar que la aplicación está protegida contra este ataque, ejecuta el siguiente script para identificar y actualizar cualquier instancia de nth-check vulnerable:
```bash
node fix-security.js
```

**Referencias**:
- [CVE-2021-3803](https://nvd.nist.gov/vuln/detail/CVE-2021-3803)
- [GitHub Advisory GHSA-rp65-9cf3-cjxr](https://github.com/advisories/GHSA-rp65-9cf3-cjxr)

### Persistencia insegura de verificación de certificados en Requests (CVE-2023-32681)

**Problema**: En versiones de Requests anteriores a 2.32.0, si la primera solicitud a través de una sesión se realiza con `verify=False` (para deshabilitar la verificación de certificados), todas las solicitudes posteriores al mismo origen continuarán ignorando la verificación de certificados, independientemente de los cambios en el valor de `verify`. Este comportamiento persiste durante todo el ciclo de vida de la conexión en el pool de conexiones.

**Impacto potencial**:
- Vulnerabilidad a ataques Man-in-the-Middle (MitM)
- Exposición de datos sensibles en tránsito
- Bypass de verificación de certificados incluso cuando el código intenta habilitar explícitamente la verificación
- Compromiso de la seguridad de la capa de transporte (TLS/SSL)

**Detalles técnicos**:
El problema ocurre porque las conexiones en el pool se reutilizan y las opciones TLS aplicadas a la primera conexión se mantienen para todas las conexiones subsiguientes al mismo origen. Esto significa que si la primera solicitud deshabilita la verificación del certificado, todas las solicitudes posteriores heredarán esta configuración insegura, incluso si el código establece explícitamente `verify=True`.

**Mitigación**:
1. Se actualizó Requests a la versión 2.32.2
2. Se aseguró que todas las llamadas a `requests.get()` tengan `verify=True` explícitamente
3. Se implementó una práctica de nunca usar `verify=False` en el código de producción

**Verificación**:
Para verificar que la aplicación está protegida contra este problema:
```bash
pip show requests
# Debería mostrar versión 2.32.0 o superior
```

**Referencias**:
- [CVE-2023-32681](https://nvd.nist.gov/vuln/detail/CVE-2023-32681)
- [GitHub Issue psf/requests#6655](https://github.com/psf/requests/issues/6655)
- [Requests Security Advisory](https://github.com/advisories/GHSA-5r9g-qh6m-jxff)

### Error de análisis de líneas en PostCSS (CVE-2023-26964)

**Problema**: En versiones de PostCSS anteriores a 8.4.31, existe una vulnerabilidad en la forma en que se analizan los retornos de carro (`\r`) en los comentarios CSS. Un atacante puede preparar CSS malicioso de tal manera que incluya partes que PostCSS analiza como comentarios CSS, pero que luego se incluirán en la salida de PostCSS como nodos CSS (reglas, propiedades) a pesar de estar originalmente incluidos en un comentario.

**Impacto potencial**:
- Bypass de linters de CSS y filtros de seguridad
- Inyección de CSS malicioso en aplicaciones que aceptan CSS de fuentes no confiables
- Posible ejecución de código en el navegador a través de CSS malformado
- Afectación a la integridad de las hojas de estilo procesadas

**Detalles técnicos**:
La vulnerabilidad se puede demostrar con reglas como `@font-face{ font:(\r/*);}`
donde el retorno de carro (\r) causa una discrepancia en el análisis que permite que el código después del comentario sea interpretado como código CSS válido en lugar de parte del comentario.

**Mitigación**:
1. Se actualizó PostCSS a la versión 8.4.35 (que incluye la corrección para 8.4.31 y mejoras adicionales)
2. Se implementaron resoluciones en package.json para forzar la versión segura
3. Se actualizó el script `fix-security.js` para parchear todas las instancias de PostCSS en el proyecto

**Verificación**:
Para verificar que la aplicación está protegida contra este problema:
```bash
# Ejecutar el script de parche para asegurar todas las instancias
node fix-security.js

# Verificar la versión actual de PostCSS
npm list postcss | grep postcss@
# Todas las instancias deberían mostrar 8.4.31 o superior
```

**Referencias**:
- [CVE-2023-26964](https://nvd.nist.gov/vuln/detail/CVE-2023-26964)
- [GitHub Advisory GHSA-7fh5-64p2-3v2j](https://github.com/advisories/GHSA-7fh5-64p2-3v2j)
- [PostCSS Issue #1864](https://github.com/postcss/postcss/issues/1864) 