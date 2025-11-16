from http.server import BaseHTTPRequestHandler
import os
import psycopg2
from datetime import datetime
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

        # severity: prefer faultStates.effectiveStatus
        fault_states = f.get("faultStates")
        if isinstance(fault_states, dict):
            severity = fault_states.get("effectiveStatus")
        else:
            severity = f.get("faultState")

        # is_active
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
            None,
            f.get("description"),
            severity,
            controller_id,
            is_active
        ))

    conn.commit()
    cur.close()


class handler(BaseHTTPRequestHandler):
    """Vercel Serverless API Function"""
    def do_GET(self):
        try:
            # Connect to Neon
            conn = psycopg2.connect(DATABASE_URL)

            # 1. Last timestamp
            last_ts = get_last_timestamp(conn)

            # 2. Geotab auth
            api = mygeotab.API(
                username=GEOTAB_USERNAME,
                password=GEOTAB_PASSWORD,
                database=GEOTAB_DATABASE
            )
            api.authenticate()

            # 3. Fetch incremental FaultData
            results = api.get("FaultData", search={"fromDate": last_ts})

            # 4. Insert
            insert_fault_data(conn, results)

            # 5. Update timestamp
            if results:
                max_ts = max([r["dateTime"] for r in results])
                update_last_timestamp(conn, max_ts)

            conn.close()

            # RESPONSE
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(
                f'{{"status":"ok","inserted":{len(results)}}}'.encode()
            )

        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode())
