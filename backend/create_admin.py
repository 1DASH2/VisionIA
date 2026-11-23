"""Crear usuario administrador con contraseña oculta."""
from pathlib import Path
from getpass import getpass
from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name(".env"))
from auth import create_admin

if __name__ == "__main__":
    username = input("Usuario administrador: ").strip()
    password = getpass("Contraseña (mínimo 12 caracteres): ")
    confirm = getpass("Repite la contraseña: ")
    if password != confirm:
        raise SystemExit("Las contraseñas no coinciden.")
    try:
        create_admin(username, password)
    except Exception as exc:
        raise SystemExit(f"No se pudo crear el usuario: {exc}") from exc
    print("Administrador creado correctamente.")
