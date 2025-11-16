# test_neon.py
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()  # Carga las variables de .env

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no está definido en .env")

def main():
    print("Conectando a Neon...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT NOW();")
    now = cur.fetchone()[0]
    print("Conexión OK. Hora en Neon:", now)

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
