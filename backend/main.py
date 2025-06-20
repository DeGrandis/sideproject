from typing import Union
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

origins = os.environ.get("CORS_ORIGIN", "http://localhost:5173").split(",")


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/hello")
def read_root():
    return {"data": {"message": "Response from FastAPI backend!"}}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}