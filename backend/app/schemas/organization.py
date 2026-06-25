"""Organization DTOs."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

PayerType = Literal["legal", "indiv", "yatt"]


class OrganizationCreate(BaseModel):
    stir: str
    name: str
    payer_type: PayerType = "legal"


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    stir: str
    name: str
    payer_type: str
