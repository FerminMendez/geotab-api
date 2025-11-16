import os
import psycopg2
from datetime import datetime, timezone
from dotenv import load_dotenv
import mygeotab

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GEOTAB_USERNAME = os.getenv("GEOTAB_USERNAME")
GEOTAB_PASSWORD = os.getenv("GEOTAB_PASSWORD")
GEOTAB_DATABASE = os.getenv("GEOTAB_DATABASE")


def get_last_timestamp(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT last_timestamp 
        FROM sync_state
        WHERE source = 'fault_data'
    """)
    ts = cur.fetchone()[0]
    cur.close()
    return ts


def update_last_timestamp(conn, ts):
    cur = conn.cursor()
    cur.execute("""
        UPDATE sync_state
        SET last_timestamp = %s
        WHERE source = 'fault_data'
    """, (ts,))
    conn.commit()
    cur.close()


def insert_fault_data(conn, rows):
    cur = conn.cursor()

    for f in rows:

        # device_id
        device_id = None
        if isinstance(f.get("device"), dict):
            device_id = f["device"].get("id")

        # diagnostic code
        diagnostic_id = None
        if isinstance(f.get("diagnostic"), dict):
            diagnostic_id = f["diagnostic"].get("id")

        # controller_id
        controller_id = None
        if isinstance(f.get("controller"), dict):
            controller_id = f["controller"].get("id")

        # severity: preferimos faultStates.effectiveStatus
        fault_states = f.get("faultStates")
        if isinstance(fault_states, dict):
            severity = fault_states.get("effectiveStatus")
        else:
            # fallback: usarems faultState directo (string)
            severity = f.get("faultState")

        # is_active según faultState
        is_active = True if f.get("faultState") == "Active" else False

        cur.execute("""
            INSERT INTO fault_data 
            (id, device_id, occurred_at, code, source, description, severity, controller_id, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (
            f.get("id"),
            device_id,
            f.get("dateTime"),
            diagnostic_id,
            None,                       # sourceAddress no existe en tus registros
            f.get("description"),
            severity,
            controller_id,
            is_active
        ))

    conn.commit()
    cur.close()


def main():
    print("🔄 Iniciando sync incremental de FaultData...")

    # 1. Conectar a Neon
    conn = psycopg2.connect(DATABASE_URL)

    # 2. Leer último timestamp
    last_ts = get_last_timestamp(conn)
    print("Último timestamp sincronizado →", last_ts)

    # 3. Autenticar con Geotab usando el SDK
    api = mygeotab.API(
        username=GEOTAB_USERNAME,
        password=GEOTAB_PASSWORD,
        database=GEOTAB_DATABASE
    )
    api.authenticate()
    print("🔐 Autenticación exitosa en Geotab.")

    # 4. Obtener datos incrementalmente
    print("📥 Descargando FaultData más reciente...")

    results = api.get("FaultData", search={"fromDate": last_ts})
    print(f"Registros nuevos encontrados → {len(results)}")
    results = results[:20]
    print(f"Procesando solo {len(results)} registros para prueba…")
    if results:
        # 5. Insertamos en Neon
        insert_fault_data(conn, results)

        # 6. Nuevo timestamp máximo
        max_ts = max([r["dateTime"] for r in results])
        new_ts = max_ts
        update_last_timestamp(conn, new_ts)
        print("🕒 Nuevo timestamp guardado →", new_ts)

    print("✔️ Sync de FaultData completada.")
    conn.close()


if __name__ == "__main__":
    main()
