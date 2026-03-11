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
    display_name: str | None = None
    profile_picture_url: str | None = None
    status_text: str | None = None
    age_range: str | None = None
    fitness_level: str | None = None

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    display_name: str | None = None
    profile_picture_url: str | None = None
    status_text: str | None = None
    age_range: str | None = None
    fitness_level: str | None = None


class PublicUserProfile(BaseModel):
    id: int
    name: str
    display_name: str | None = None
    profile_picture_url: str | None = None
    status_text: str | None = None
    age_range: str | None = None
    fitness_level: str | None = None

    class Config:
        from_attributes = True