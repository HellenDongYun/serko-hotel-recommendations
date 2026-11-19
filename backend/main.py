import asyncio
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StrictStr


class RecommendationRequest(BaseModel):
    message: StrictStr = Field(min_length=1, pattern=r"\S")
    scenario: Literal["success", "empty", "error"]


class Hotel(BaseModel):
    id: str
    name: str
    nightlyPrice: float
    currency: str
    breakfastIncluded: bool
    explanation: str


class RecommendationResponse(BaseModel):
    message: str
    hotels: list[Hotel]


HOTELS = [
    Hotel(id="h1", name="Harbour House", nightlyPrice=220, currency="NZD",
          breakfastIncluded=True, explanation="Within budget; breakfast included."),
    Hotel(id="h2", name="City Garden", nightlyPrice=245, currency="NZD",
          breakfastIncluded=True, explanation="Near the meeting district."),
    Hotel(id="h3", name="Quay Rooms", nightlyPrice=195, currency="NZD",
          breakfastIncluded=False, explanation="Lower price; breakfast costs extra."),
]

app = FastAPI(title="Serko Hotel Recommendations Demo", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost(?::[0-9]{1,5})?",
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


@app.post("/recommendations", response_model=RecommendationResponse)
async def recommendations(request: RecommendationRequest) -> RecommendationResponse:
    if request.scenario == "error":
        raise HTTPException(
            status_code=503,
            detail="Synthetic fixture demo: recommendations are temporarily unavailable. Select Success and retry.",
        )
    if request.scenario == "empty":
        return RecommendationResponse(
            message="Synthetic fixture data: no hotels found for this demo scenario.",
            hotels=[],
        )
    await asyncio.sleep(0.7)
    return RecommendationResponse(
        message="Synthetic fixture data: here are three demo hotel recommendations.",
        hotels=HOTELS,
    )
