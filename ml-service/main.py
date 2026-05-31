from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import joblib

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = joblib.load("sentiment_model.pkl")

class CommentRequest(BaseModel):
    comments: List[str]

@app.post("/analyse")
def analyse(req: CommentRequest):
    results = []
    for comment in req.comments:
        prediction = model.predict([comment])[0]
        proba = model.predict_proba([comment])[0]
        classes = model.classes_.tolist()
        scores = {cls: round(float(p), 3) for cls, p in zip(classes, proba)}
        results.append({
            "comment": comment,
            "sentiment": prediction,
            "scores": scores
        })

    sentiments = [r["sentiment"] for r in results]
    summary = {
        "positive": sentiments.count("positive"),
        "negative": sentiments.count("negative"),
        "neutral": sentiments.count("neutral"),
        "total": len(sentiments)
    }
    return {"results": results, "summary": summary}

@app.get("/health")
def health():
    return {"status": "ok"}