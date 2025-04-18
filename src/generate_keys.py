#!/usr/bin/env python3
"""
Script para generar claves seguras para la aplicación.
Ejecutar este script para crear nuevas claves y actualizar el archivo .env
"""

import os
import secrets
import string
import base64


def generate_secure_key(length=32):
    """Genera una clave segura aleatoria de la longitud especificada."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def generate_random_bytes(length=32):
    """Genera bytes aleatorios y los devuelve en formato base64."""
    random_bytes = secrets.token_bytes(length)
    return base64.b64encode(random_bytes).decode('utf-8')


def update_env_file():
    """Actualiza el archivo .env con nuevas claves seguras."""
    # Comprobar si existe el archivo .env
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    env_example_path = os.path.join(os.path.dirname(__file__), '.env.example')

    # Si no existe .env pero sí .env.example, copiar el ejemplo
    if not os.path.exists(env_path) and os.path.exists(env_example_path):
        with open(env_example_path, 'r') as example_file:
            example_content = example_file.read()
        with open(env_path, 'w') as env_file:
            env_file.write(example_content)

    # Leer el archivo .env actual
    env_content = ""
    if os.path.exists(env_path):
        with open(env_path, 'r') as file:
            env_content = file.read()

    # Generar nuevas claves
    encryption_key = generate_secure_key(32)
    secret_key = generate_secure_key(32)

    # Reemplazar o añadir las claves en el contenido
    lines = env_content.split('\n')
    updated_lines = []

    keys_updated = {
        'REACT_APP_ENCRYPTION_KEY': False,
        'ENCRYPTION_KEY': False,
        'SECRET_KEY': False
    }

    for line in lines:
        if line.startswith('REACT_APP_ENCRYPTION_KEY='):
            updated_lines.append(f'REACT_APP_ENCRYPTION_KEY={encryption_key}')
            keys_updated['REACT_APP_ENCRYPTION_KEY'] = True
        elif line.startswith('ENCRYPTION_KEY='):
            updated_lines.append(f'ENCRYPTION_KEY={encryption_key}')
            keys_updated['ENCRYPTION_KEY'] = True
        elif line.startswith('SECRET_KEY='):
            updated_lines.append(f'SECRET_KEY={secret_key}')
            keys_updated['SECRET_KEY'] = True
        else:
            updated_lines.append(line)

    # Añadir claves que no estaban presentes
    for key, updated in keys_updated.items():
        if not updated:
            if key == 'SECRET_KEY':
                updated_lines.append(f'{key}={secret_key}')
            else:
                updated_lines.append(f'{key}={encryption_key}')

    # Escribir el archivo actualizado
    with open(env_path, 'w') as file:
        file.write('\n'.join(updated_lines))

    print(f"Archivo .env actualizado en: {env_path}")
    print("Se han generado nuevas claves seguras para la aplicación.")
    print("\nIMPORTANTE: No compartas estas claves ni las incluyas en el repositorio.")


if __name__ == "__main__":
    update_env_file()
