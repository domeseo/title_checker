from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import requests
from bs4 import BeautifulSoup
import traceback
import redis
import time
import os
from dotenv import load_dotenv

app = Flask(__name__)
# Configuración explícita de CORS para permitir cualquier origen
CORS(app, resources={r"/*": {"origins": "*"}})


load_dotenv()  # para cargar las variables de entorno desde .env


def can_use_tool(user_id):
    # Comentamos temporalmente el código que usa Redis
    # key = f'user:{user_id}:tool:usage'
    # count = r.get(key)
    # if count is None:
    #     r.set(key, 1, ex=86400)  # Expira en 24 horas (86400 segundos)
    #     return True
    # elif int(count) < 3:
    #     r.incr(key)
    #     return True
    # return False

    # Temporalmente, siempre permitimos el uso de la herramienta
    return True


@app.route('/extract-meta', methods=['POST'])
def extract_meta():
    data = request.json
    url = data.get("url")
    # Si no se proporciona ID, usar "anonymous"
    user_id = data.get("user_id", "anonymous")

    if not url:
        return jsonify({"message": "inserisci l'url della pagina"}), 400

    # Verificar si el usuario puede usar la herramienta
    if not can_use_tool(user_id):
        return jsonify({
            "error": "Límite de uso excedido",
            "message": "Has alcanzado el límite diario de extracciones (3). Inténtalo mañana."
        }), 429  # 429 = Too Many Requests

    try:
        # Agregar timeout para evitar esperas prolongadas
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/'
        }

        # Iniciar temporizador
        start_time = time.time()

        response = requests.get(url, headers=headers, timeout=10)

        # Calcular tiempo de respuesta
        response_time = time.time() - start_time

        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')

            # Extracción del título
            title = soup.find('title')
            title_text = title.get_text() if title else 'Title not found'

            # Extracción de metadatos
            metadata = {}

            # Meta description - diferentes formatos
            meta_description = soup.find('meta', attrs={'name': 'description'})
            if not meta_description:
                meta_description = soup.find(
                    'meta', attrs={'property': 'og:description'})
            if not meta_description:
                meta_description = soup.find(
                    'meta', attrs={'property': 'twitter:description'})
            if not meta_description:
                meta_description = soup.find(
                    'meta', attrs={'itemprop': 'description'})

            metadata['description'] = meta_description.get(
                'content') if meta_description else 'Meta description not found'

            # Detección de plataforma CMS
            is_wordpress = False
            generator = soup.find('meta', attrs={'name': 'generator'})
            if generator and 'wordpress' in generator.get('content', '').lower():
                is_wordpress = True

            # WordPress suele tener enlaces a wp-json
            wp_api_links = soup.find_all(
                'link', attrs={'rel': 'https://api.w.org/'})
            if wp_api_links:
                is_wordpress = True

            metadata['platform'] = 'WordPress' if is_wordpress else 'Unknown'

            # Open Graph title
            og_title = soup.find('meta', attrs={'property': 'og:title'})
            metadata['og_title'] = og_title.get(
                'content') if og_title else title_text

            # Twitter title
            twitter_title = soup.find(
                'meta', attrs={'property': 'twitter:title'})
            if not twitter_title:
                twitter_title = soup.find(
                    'meta', attrs={'name': 'twitter:title'})
            metadata['twitter_title'] = twitter_title.get(
                'content') if twitter_title else title_text

            # Open Graph image - buscar diferentes variantes
            og_image = soup.find('meta', attrs={'property': 'og:image'})
            if not og_image:
                og_image = soup.find('meta', attrs={'name': 'og:image'})
            if not og_image:
                og_image = soup.find(
                    'meta', attrs={'property': 'twitter:image'})
            if not og_image:
                og_image = soup.find('meta', attrs={'name': 'twitter:image'})

            metadata['og_image'] = og_image.get(
                'content') if og_image else 'Image not found'

            # Canonical URL - varios formatos
            canonical = soup.find('link', attrs={'rel': 'canonical'})
            if not canonical:
                # Buscar en meta tags alternativas
                canonical_meta = soup.find(
                    'meta', attrs={'property': 'og:url'})
                if canonical_meta:
                    metadata['canonical'] = canonical_meta.get('content')
                else:
                    metadata['canonical'] = url
            else:
                metadata['canonical'] = canonical.get(
                    'href') if canonical else url

            # Meta keywords
            keywords = soup.find('meta', attrs={'name': 'keywords'})
            metadata['keywords'] = keywords.get(
                'content') if keywords else 'Keywords not found'

            # Extracción de etiquetas para WordPress
            if is_wordpress:
                # Extraer categorías y etiquetas en WordPress
                categories = []
                tags = []

                # Buscar enlaces a categorías
                category_links = soup.find_all('a', attrs={'rel': 'category'})
                for link in category_links:
                    if link.get_text():
                        categories.append(link.get_text().strip())

                # Buscar enlaces a etiquetas
                tag_links = soup.find_all('a', attrs={'rel': 'tag'})
                for link in tag_links:
                    if link.get_text():
                        tags.append(link.get_text().strip())

                metadata['categories'] = categories if categories else []
                metadata['tags'] = tags if tags else []

                # Si no hay keywords pero hay etiquetas, usar etiquetas como keywords
                if metadata['keywords'] == 'Keywords not found' and tags:
                    metadata['keywords'] = ', '.join(tags)

            # H1 (primer encabezado)
            h1 = soup.find('h1')
            metadata['h1'] = h1.get_text().strip() if h1 else 'H1 not found'

            # Información adicional para diagnóstico
            metadata['response_time'] = f"{response_time:.2f} segundos"
            metadata['status_code'] = response.status_code
            metadata['content_type'] = response.headers.get(
                'Content-Type', 'Unknown')
            # URL final después de redirecciones
            metadata['url_final'] = response.url

            return jsonify({
                "title": title_text,
                "meta_description": metadata['description'],
                "metadata": metadata
            })
        else:
            return jsonify({
                "error": f"Failed with status code: {response.status_code}",
                "message": f"La solicitud falló con código de estado {response.status_code}"
            }), 500
    except requests.exceptions.Timeout:
        return jsonify({
            "error": "Timeout",
            "message": "La solicitud excedió el tiempo de espera (10 segundos)"
        }), 504
    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Connection Error",
            "message": "No se pudo conectar al servidor. Verifica la URL y tu conexión a internet."
        }), 502
    except requests.exceptions.TooManyRedirects:
        return jsonify({
            "error": "Too Many Redirects",
            "message": "La solicitud encontró demasiadas redirecciones. Verifica la URL."
        }), 500
    except Exception as e:
        # Registrar el error completo
        print(f"Error al extraer metadatos de {url}: {str(e)}")
        print(traceback.format_exc())

        return jsonify({
            "error": str(e),
            "message": "Ocurrió un error al procesar la solicitud"
        }), 500


@app.route('/analyze', methods=['POST'])
def analyze_AI():
    try:
        # Obtener datos del request
        data = request.json
        title = data.get(
            "title", "Cosa vedere a Malaga: 10 cose da non perdersi")
        meta_description = data.get(
            "description", "Tutto quello che devi assolutamente vedere a Malaga e 10 cose che non devi perdere")
        # Si no se proporciona ID, usar "anonymous"
        user_id = data.get("user_id", "anonymous")

        # Verificar si el usuario puede usar la herramienta
        if not can_use_tool(user_id):
            return jsonify({
                "error": "Límite de uso excedido",
                "message": "Has alcanzado el límite diario de análisis (3). Inténtalo mañana."
            }), 429  # 429 = Too Many Requests

        # Crear el prompt para OpenAI
        prompt = f"""
       As a SEO Expert, please evaluate the current Title "{title}" and Meta Description "{meta_description}" for SEO effectiveness and CTR potential in the SERP. 

- Create an estimation of the CTR for the current Title and Meta Description.
- Suggest a new SEO-optimized Title and Meta Description that would be more likely to increase CTR.
- In your analysis, please indicate how much the new Title and Meta Description could potentially increase CTR compared to the original.

Important:
- The Title should not exceed 60 characters. MUST RESPECT THIS.
- The Meta Description should not exceed 155 characters. MUST RESPECT THIS.

Please provide the response in this style:

SEO Title: [new title]
Meta Description: [new description]
CTR Estimation (Original): [estimated CTR in % for the original title/description]
CTR Estimation (Optimized): [estimated CTR in % for the optimized title/description]
CTR Increase: [estimated percentage increase in CTR]

YOU MUST REPLY in the language of the user."""

        client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"))

        response = client.responses.create(
            model="gpt-4.1",
            instructions="You are SEO Expert with more over 11 years of experience",
            input=prompt
        )

        result = response.output_text
        token = response.max_output_tokens
        print(token)

        # Devolver respuesta
        return jsonify({
            'status': 'success',
            'data': {
                'analysis': result,
                'original': {
                    'title': title,
                    'description': meta_description
                }
            }
        })
    except Exception as e:
        # Loguear el error
        import traceback
        print("ERROR:", str(e))
        print(traceback.format_exc())

        # Devolver error al cliente
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)
