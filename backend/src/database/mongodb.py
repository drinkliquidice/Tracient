from dotenv import load_dotenv
import os

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi

load_dotenv()

database_url = os.getenv("DATABASE_URI")

# Create a new client and connect to the server
client = AsyncIOMotorClient(database_url, server_api=ServerApi('1'))

# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)