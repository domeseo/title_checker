# SERP Title Checker

Esta aplicación te permite analizar y mejorar tus títulos y meta descripciones para SEO, utilizando IA para generar sugerencias optimizadas que aumenten el CTR en los resultados de búsqueda.

## Características principales

- Extracción automática de metadatos desde cualquier URL
- Análisis de títulos y descripciones con GPT-4.1
- Optimización basada en palabras clave y marca
- Previsualización de resultados en formato SERP
- Estimación de mejora de CTR

## Requisitos previos

- Node.js y npm (para el frontend)
- Python 3.8 o superior (para el backend)
- Una clave API de OpenAI

## Estructura del proyecto

```
serp_title/
  ├── src/
  │   ├── frontend/         # Componentes React
  │   │   ├── api/         
  │   │   │   ├── routes.py # Rutas de la API
  │   │   ├── app.py        # Punto de entrada del backend
  │   └── .env              # Variables de entorno (no incluido en el repositorio)
  ├── public/               # Archivos estáticos
  ├── package.json          # Dependencias del frontend
  └── requirements.txt      # Dependencias del backend
```

## Instalación

### Frontend (React)

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm start
```

### Backend (Flask)

```bash
# Instalar dependencias de Python
pip install -r requirements.txt

# Iniciar el servidor de backend
cd src/backend
python app.py
```

El frontend estará disponible en http://localhost:3000 y el backend en http://localhost:5002.

## Configuración

1. Crea un archivo `.env` en la carpeta `src/` con las variables necesarias (consulta la documentación para más detalles).

## Cómo usar la aplicación

1. **Configurar la API Key de OpenAI**:
   - Introduce tu clave API de OpenAI en el campo correspondiente
   - Haz clic en "Set your Key"

2. **Analizar una URL existente**:
   - Introduce la URL en el campo correspondiente
   - Haz clic en "Get Metadata" para extraer automáticamente el título y la meta descripción

3. **Optimizar manualmente**:
   - Escribe o edita el título (máximo 60 caracteres)
   - Escribe o edita la meta descripción (máximo 155 caracteres)
   - Añade tu palabra clave principal
   - Añade el nombre de tu marca

4. **Obtener análisis y sugerencias**:
   - Haz clic en "Meta Analysis"
   - La aplicación generará sugerencias optimizadas para el título y la meta descripción

5. **Ver los resultados**:
   - Se mostrará una estimación del CTR actual
   - Se mostrará una estimación del CTR optimizado
   - Se mostrará el porcentaje de mejora esperado

## Contribuciones

Las contribuciones son bienvenidas. Para contribuir:

1. Haz un fork del repositorio
2. Crea una rama para tu funcionalidad
3. Realiza tus cambios y haz commit
4. Sube los cambios a tu fork
5. Crea un Pull Request

## Licencia

Este proyecto está licenciado bajo la licencia MIT. 