from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str
    age_range: str | None = None
    fitness_level: str | None = None


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    age_range: str | None = None
    fitness_level: str | None = None

    class Config:
        from_attributes = True