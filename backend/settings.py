from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    MONGODB_URI: str = ""
    TRACIENT_URL: str = "https://tracient.ca"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    SECRET_KEY: str = ""
    ALGORITHM: str = ""

settings = Settings()
