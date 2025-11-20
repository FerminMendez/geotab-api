import mygeotab
from dotenv import load_dotenv
import os
import json

load_dotenv()

api = mygeotab.API(
    username=os.getenv("GEOTAB_USERNAME"),
    password=os.getenv("GEOTAB_PASSWORD"),
    database=os.getenv("GEOTAB_DATABASE")
)

api.authenticate()

devices = api.get("Device", resultsLimit=1)

print(json.dumps(devices[0], indent=2))
