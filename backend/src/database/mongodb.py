import certifi
from motor.motor_asyncio import AsyncIOMotorClient

from settings import settings

database_url = settings.MONGODB_URI

client = AsyncIOMotorClient(
    database_url,
    tlsCAFile=certifi.where(),
)
mongo = client.get_default_database()

async def set_up_mongo():
    try:
        await client.admin.command('ping')
        print("Pinged your deployment. You successfully connected to MongoDB!")
    except Exception as e:
        print(e)