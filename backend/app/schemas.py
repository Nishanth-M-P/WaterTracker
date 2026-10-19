from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class CustomerType(str, Enum):
    HOTEL = "Hotel"
    SHOP = "Shop"
    OFFICE = "Office"
    OTHER = "Other"


class BottleSizeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    volume_ml: Optional[int] = Field(None, ge=1)
    is_active: bool = True
    default_unit_price: Optional[float] = Field(None, ge=0.0)


class BottleSizeCreate(BottleSizeBase):
    pass


class BottleSize(BottleSizeBase):
    id: int
    created_at: str
    updated_at: str


class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    customer_type: CustomerType = CustomerType.OTHER
    phone: Optional[str] = Field(None, max_length=25)
    address: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=500)
    is_archived: bool = False

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Customer name cannot be blank")
        return s


class CustomerCreate(CustomerBase):
    pass


class Customer(CustomerBase):
    id: int
    created_at: str
    updated_at: str


class DeliveryItemBase(BaseModel):
    bottle_size_id: int
    bottle_size_name_snapshot: str
    quantity: int = Field(..., ge=0)
    unit_price_snapshot: Optional[float] = Field(None, ge=0.0)


class DeliveryItemCreate(DeliveryItemBase):
    pass


class DeliveryItem(DeliveryItemBase):
    id: int
    delivery_id: int
    created_at: str


class DeliveryBase(BaseModel):
    customer_id: int
    delivery_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    delivered_at: str
    delivery_location: str
    notes: Optional[str] = None


class DeliveryCreate(DeliveryBase):
    items: List[DeliveryItemCreate] = Field(..., min_length=1)

    @field_validator("items")
    @classmethod
    def validate_positive_bottles(cls, items: List[DeliveryItemCreate]) -> List[DeliveryItemCreate]:
        total_qty = sum(item.quantity for item in items)
        if total_qty <= 0:
            raise ValueError("At least one bottle quantity must be greater than zero")
        return items


class Delivery(DeliveryBase):
    id: int
    created_at: str
    updated_at: str
    customer_name: Optional[str] = None
    customer_type: Optional[str] = None
    items: List[DeliveryItem] = []
    total_bottles: int = 0


# Reports
class DateRangeFilter(BaseModel):
    start_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    customer_id: Optional[int] = None
    customer_type: Optional[str] = None

    @field_validator("end_date")
    @classmethod
    def validate_range(cls, end_date: str, info) -> str:
        start_date = info.data.get("start_date")
        if start_date and end_date < start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        return end_date


class BottleSizeSummary(BaseModel):
    bottle_size_id: int
    bottle_size_name: str
    total_quantity: int
    total_amount: Optional[float] = 0.0


class CustomerSummary(BaseModel):
    customer_id: int
    customer_name: str
    customer_type: str
    total_deliveries: int
    total_bottles: int


class DailyDistribution(BaseModel):
    date: str
    total_bottles: int
    delivery_count: int


class SummaryReport(BaseModel):
    start_date: str
    end_date: str
    total_bottles: int
    total_deliveries: int
    unique_customers: int
    avg_bottles_per_delivery: float
    bottle_size_breakdown: List[BottleSizeSummary]
    daily_breakdown: List[DailyDistribution]
    customer_breakdown: List[CustomerSummary]


class BackupMetadata(BaseModel):
    app_name: str = "WaterTrack"
    version: str = "1.0.0"
    schema_version: int = 1
    exported_at: str


class BackupPayload(BaseModel):
    metadata: BackupMetadata
    customers: List[Customer]
    bottle_sizes: List[BottleSize]
    deliveries: List[Delivery]
    settings: Dict[str, Any] = {}
