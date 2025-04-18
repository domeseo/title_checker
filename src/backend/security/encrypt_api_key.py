from Crypto.Cipher import AES
import base64
import hashlib
import os
from dotenv import load_dotenv
import sys

load_dotenv()


def encrypt_api_key(api_key, passphrase):
    key = hashlib.sha256(passphrase.encode()).digest()
    iv = os.urandom(16)  # Vector de inicialización aleatorio
    cipher = AES.new(key, AES.MODE_CFB, iv)
    encrypted = iv + cipher.encrypt(api_key.encode())
    return base64.b64encode(encrypted).decode()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        api_key = os.getenv("OPENAI_API_KEY")
    else:
        api_key = sys.argv[1]

    passphrase = os.getenv("ENCRYPTION_KEY", "NO_KEY_HARDCODED")

    if not api_key:
        print("Error: No se encontró OPENAI_API_KEY en el archivo .env o como argumento")
        sys.exit(1)

    encrypted = encrypt_api_key(api_key, passphrase)
    print("\nAPI Key encriptada:")
    print(encrypted)
    print("\nAñade esta línea a tu archivo .env:")
    print(f"ENCRYPTED_API_KEY={encrypted}")
