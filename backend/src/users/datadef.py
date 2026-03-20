from datetime import datetime 

from beanie import Document


class StudentUser(Document):
    name: str
    student_id: str
    parent_name: str
    parent_number: str
    sign_in_time: datetime
    sign_out_time: datetime
    last_signed_in: datetime

    class Settings:
        name = "student_users"
