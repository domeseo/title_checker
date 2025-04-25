from flask import Flask, request, jsonify, session, render_template, redirect, url_for, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import requests
from bs4 import BeautifulSoup
import traceback
import time
import os
from dotenv import load_dotenv
from Crypto.Cipher import AES
import base64
import hashlib
import uuid
from Crypto.Util.Padding import unpad
from urllib.parse import urlparse
import socket
import ipaddress
import html
from datetime import datetime, timedelta
from collections import defaultdict

app = Flask(__name__)
# Configuración de secreto para las sesiones
app.secret_key = os.getenv("SECRET_KEY")
# Configurar la permanencia de las sesiones
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 horas

# Configuración de CORS más segura
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000").split(",")
CORS(app, resources={r"/*": {"origins": allowed_origins}},
     supports_credentials=True)

# Cargar variables de entorno usando una ruta relativa
load_dotenv()

# Protección contra ataques de fuerza bruta
login_attempts = defaultdict(int)
blocked_ips = {}
MAX_ATTEMPTS = 5
BLOCK_TIME_MINUTES = 15

# Añadir encabezados de seguridad a todas las respuestas


@app.after_request
def add_security_headers(response):
    # Prevenir que el navegador MIME-sniff la respuesta
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # Habilitar protección XSS en navegadores antiguos
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Prevenir clickjacking
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    # Configurar política de seguridad de contenido
    response.headers['Content-Security-Policy'] = "default-src 'self'; img-src *; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
    # No almacenar en caché datos sensibles
    response.headers['Cache-Control'] = 'no-store'
    # No exponer información de la plataforma
    response.headers['Server'] = ''
    return response


def decrypt_api_key(encrypted_key, passphrase=None):
    try:
        if not passphrase:
            passphrase = os.getenv("ENCRYPTION_KEY")
            if not passphrase:
                raise ValueError("Encryption key is missing")

        from base64 import b64decode
        encrypted_bytes = b64decode(encrypted_key)
        iv = encrypted_bytes[:16]
        ciphertext = encrypted_bytes[16:]
        key = hashlib.sha256(passphrase.encode()).digest()
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = unpad(cipher.decrypt(ciphertext), AES.block_size)
        return decrypted.decode('utf-8')
    except Exception as e:
        print(f"Error al desencriptar: {e}")
        return None



# api key encrypting
encryption_key = os.getenv("ENCRYPTION_KEY")
encrypted_key = os.getenv("ENCRYPTED_API_KEY")

# Intentamos inicializar con la clave encriptada si está disponible
default_api_key = None
if encrypted_key:
    try:
        default_api_key = decrypt_api_key(encrypted_key, encryption_key)
    except Exception as e:
        print(f"Error al desencriptar la API key: {e}")


def get_current_api_key():
    return session.get("openai_key") or default_api_key


@app.route("/set-key", methods=["POST"])
def set_key():
    try:
        # Obtener la IP del cliente
        client_ip = request.remote_addr

        # Comprobar si la IP está bloqueada
        allowed, message = check_brute_force(client_ip)
        if not allowed:
            return {"error": "Brute force protection", "message": message}, 429

        data = request.get_json()
        encrypted_key = data.get("encryptedKey")
        if not encrypted_key:
            # Incrementar intentos fallidos
            increment_attempts(client_ip)
            return {"error": "No encrypted API key provided"}, 400

        # Usar la nueva función de desencriptación
        api_key = decrypt_api_key(encrypted_key)
        if not api_key:
            # Incrementar intentos fallidos
            increment_attempts(client_ip)
            return {"error": "Could not decrypt API key"}, 400

        # Guardar en la sesión
        session["openai_key"] = api_key
        # Opcional: Generar un ID de sesión único si no existe
        if "session_id" not in session:
            session["session_id"] = str(uuid.uuid4())

        # Intento exitoso, restablecer contador
        increment_attempts(client_ip, success=True)

        return {"message": "Key decrypted and saved successfully"}, 200
    except Exception as e:
        print(f"Error in set-key: {e}")
        # Incrementar intentos fallidos en caso de error
        client_ip = request.remote_addr
        increment_attempts(client_ip)
        return {"error": str(e)}, 500


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


@app.route('/')
def index():
    return jsonify({
        "status": "online",
        "message": "SERP Title Checker API is running",
        "endpoints": {
            "analyze": "/analyze - POST: Analyze title and meta description",
            "extract-meta": "/extract-meta - POST: Extract metadata from URL",
            "health": "/api/health - GET: Check API health"
        }
    })


@app.route('/extract-meta', methods=['POST'])
def extract_meta():
    data = request.json
    url = data.get("url")
    # Si no se proporciona ID, usar "anonymous"
    user_id = data.get("user_id", "anonymous")

    if not url:
        return jsonify({"message": "Please provide a URL"}), 400

    # Validación de URL para evitar SSRF y otros ataques
    try:
        # Comprobar si la URL es válida
        parsed_url = urlparse(url)

        # Verificar que tiene esquema y dominio
        if not parsed_url.scheme or not parsed_url.netloc:
            return jsonify({"error": "Invalid URL format"}), 400

        # Verificar que el esquema es http o https
        if parsed_url.scheme not in ['http', 'https']:
            return jsonify({"error": "URL must use HTTP or HTTPS protocol"}), 400

        # Opcional: bloquear IPs privadas/localhost para prevenir SSRF
        try:
            domain = parsed_url.netloc.split(':')[0]
            ip = socket.gethostbyname(domain)
            ip_obj = ipaddress.ip_address(ip)

            if ip_obj.is_private or ip_obj.is_loopback:
                return jsonify({"error": "Private or loopback IPs are not allowed"}), 403
        except:
            # Si no se puede resolver el dominio, continuar (podría ser un nombre de dominio válido pero no resoluble)
            pass
    except Exception as e:
        return jsonify({"error": f"URL validation error: {str(e)}"}), 400

    # Verificar si el usuario puede usar la herramienta
    if not can_use_tool(user_id):
        return jsonify({
            "error": "Usage limit exceeded",
            "message": "You have reached the daily extraction limit (3). Please try again tomorrow."
        }), 429  # 429 = Too Many Requests

    # Verificar que tenemos una API key
    current_api_key = get_current_api_key()
    if not current_api_key:
        return jsonify({
            "error": "API key not available",
            "message": "Please provide your OpenAI API key"
        }), 400

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

        # Asegurar la verificación de certificados
        response = requests.get(url, headers=headers, timeout=10, verify=True)

        # Calcular tiempo de respuesta
        response_time = time.time() - start_time

        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')

            # Extracción del título
            title = soup.find('title')
            title_text = title.get_text() if title else 'Title not found'

            # Sanitizar salida
            title_text = html.escape(title_text)

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

            desc_content = meta_description.get(
                'content') if meta_description else 'Meta description not found'
            # Sanitizar contenido
            desc_content = html.escape(desc_content)
            metadata['description'] = desc_content

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
            metadata['response_time'] = f"{response_time:.2f} seconds"
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
                "message": f"Request failed with status code {response.status_code}"
            }), 500
    except requests.exceptions.Timeout:
        return jsonify({
            "error": "Timeout",
            "message": "Request exceeded timeout (10 seconds)"
        }), 504
    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Connection Error",
            "message": "Could not connect to server. Please check the URL and your internet connection."
        }), 502
    except requests.exceptions.TooManyRedirects:
        return jsonify({
            "error": "Too Many Redirects",
            "message": "The request encountered too many redirects. Please check the URL."
        }), 500
    except Exception as e:
        # Registrar el error completo
        print(f"Error extracting metadata from {url}: {str(e)}")
        print(traceback.format_exc())

        return jsonify({
            "error": str(e),
            "message": "An error occurred while processing the request"
        }), 500


@app.route('/analyze', methods=['POST'])
def analyze_AI():
    try:
        # Obtener datos del request
        data = request.json
        title = data.get("title", "")
        meta_description = data.get("description", "")
        user_id = data.get("user_id", "anonymous")
        keyword = data.get("keyword", "")
        brand = data.get("brand", "")

        # Validar entradas
        if not title or len(title) > 150:
            return jsonify({
                "error": "Invalid title",
                "message": "Title is required and must be less than 150 characters"
            }), 400

        if len(meta_description) > 500:
            return jsonify({
                "error": "Invalid description",
                "message": "Description must be less than 500 characters"
            }), 400

        # Sanitizar entradas para evitar inyección
        title = html.escape(title)
        meta_description = html.escape(meta_description)
        keyword = html.escape(keyword)
        brand = html.escape(brand)

        # Verificar si el usuario puede usar la herramienta
        if not can_use_tool(user_id):
            return jsonify({
                "error": "Usage limit exceeded",
                "message": "You have reached the daily analysis limit (3). Please try again tomorrow."
            }), 429

        # Usar la clave de la sesión si está disponible, o la clave del entorno como respaldo
        current_api_key = get_current_api_key()

        if not current_api_key:
            return jsonify({
                "error": "API key not available",
                "message": "Please provide your OpenAI API key"
            }), 400

        # Crear el prompt para OpenAI
        prompt = f"""
       As a SEO Expert, evaluate the current Title "{title}" and Meta Description "{meta_description}" for SEO effectiveness and CTR potential in the SERP.

The focus keyword is: "{keyword} and brand is: {brand}"

Your task:

1. Estimate the CTR of the current Title and Meta Description.
2. Propose a new SEO-optimized Title and Meta Description, using the focus keyword to increase both ranking and CTR.
3. STRICTLY RESPECT character limits:
   - Title: maximum 60 characters including spaces and {brand} at the end.
   - Meta Description: maximum 155 characters including spaces.
   - You MUST count the characters (including spaces) and ensure the Title is max 60 and the Meta Description max 155. Never exceed. If needed, rewrite or shorten.
4. Capitalize every word in the Title, except for articles, prepositions, and conjunctions (e.g., "di", "e", "a", "con", "su").
5. The Meta Description must include the focus keyword **if possible** in a natural way and should help to increase the CTR by being clear, appealing, and action-oriented.
6. Provide an estimation of how much the new Title and Description could increase the CTR.

Format your answer exactly as follows and REPLY IN THE SAME LANGUAGE as the user:

SEO Title: [new title, max 60 characters]  
Meta Description: [new description, max 155 characters]  
CTR Estimation (Original): [estimated CTR in %]  
CTR Estimation (Optimized): [estimated CTR in %]  
CTR Increase: [estimated % increase]



"""

        client = OpenAI(api_key=current_api_key)
        

        response = client.responses.create(
            model="gpt-4.1",
            instructions="You are SEO Expert with more over 11 years of experience, please provide the best solution for the user to increase CTR in SERP.",
            input=prompt
        )

        result = response.output_text
        token_input = response.usage.input_tokens
        token_input_cost = int(token_input) * (3 / 1000000)
        token_output = response.usage.output_tokens
        token_output_cost = int(token_output) * (12 / 1000000)
        token_cost = token_input_cost + token_output_cost
        print(f"{token_cost} $")
        print(result)

        # Devolver respuesta
        return jsonify({
            'status': 'success',
            'data': {
                'analysis': result,
                'original': {
                    'title': title,
                    'description': meta_description,
                    'token_cost': token_cost
                }
            }
        })
    except Exception as e:
        # Loguear el error
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


@app.route('/favicon.ico')
def favicon():
    # Respuesta No Content para evitar errores de favicon
    return jsonify({"status": "no favicon"}), 204


def check_brute_force(ip):
    """Verificar si una IP debe ser bloqueada por muchos intentos fallidos"""
    if ip in blocked_ips:
        block_until = blocked_ips[ip]
        if datetime.now() < block_until:
            # IP aún bloqueada
            remaining = (block_until - datetime.now()).total_seconds() / 60
            return False, f"Too many failed attempts. Please try again in {int(remaining)} minutes."
        else:
            # Ha pasado el tiempo de bloqueo, eliminar el bloqueo
            del blocked_ips[ip]
            login_attempts[ip] = 0

    return True, None


def increment_attempts(ip, success=False):
    """Incrementar conteo de intentos y bloquear IP si necesario"""
    if success:
        # Restablece el contador si es exitoso
        login_attempts[ip] = 0
        return

    login_attempts[ip] += 1

    if login_attempts[ip] >= MAX_ATTEMPTS:
        # Bloquear la IP por el tiempo configurado
        blocked_ips[ip] = datetime.now(
        ) + timedelta(minutes=BLOCK_TIME_MINUTES)
        login_attempts[ip] = 0


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)
