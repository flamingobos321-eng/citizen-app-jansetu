"""One-shot script: backfill tenant_id=null users/docs with the default tenant."""
import asyncio
import motor.motor_asyncio
import os

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client["jansetu"]

DEFAULT_TID = "7c75a58e-cf38-430e-930d-a4d6297afeeb"

DOMAIN_COLLECTIONS = [
    "users", "households", "issues", "visits", "notifications",
    "devworks", "relationships_v2", "constituencies", "areas",
]

async def main():
    for coll in DOMAIN_COLLECTIONS:
        # Fix docs where tenant_id is explicitly null (not super_admin)
        q_null = {"tenant_id": None, "email": {"$ne": "admin@jansetu.in"}}
        res_null = await db[coll].update_many(q_null, {"$set": {"tenant_id": DEFAULT_TID}})
        # Fix docs where tenant_id field is missing entirely
        q_missing = {"tenant_id": {"$exists": False}}
        res_missing = await db[coll].update_many(q_missing, {"$set": {"tenant_id": DEFAULT_TID}})
        total = res_null.modified_count + res_missing.modified_count
        if total:
            print(f"  {coll}: backfilled {total} docs")

    # Verify key users
    citizen = await db.users.find_one({"mobile": "9999900001"}, {"name": 1, "tenant_id": 1})
    print(f"Citizen Ramesh: tenant_id={citizen.get('tenant_id')}")
    pa = await db.users.find_one({"email": "pa@jansetu.in"}, {"name": 1, "tenant_id": 1})
    print(f"PA: tenant_id={pa.get('tenant_id')}")
    worker = await db.users.find_one({"email": "worker1@jansetu.in"}, {"name": 1, "tenant_id": 1})
    print(f"Worker1: tenant_id={worker.get('tenant_id')}")
    print("Done.")

asyncio.run(main())
