import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
import joblib

# Load dataset
df = pd.read_csv("YoutubeCommentsDataSet.csv")
df = df.dropna(subset=["Comment"])
df["Comment"] = df["Comment"].str.lower().str.strip()

X = df["Comment"]
y = df["Sentiment"]

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Build pipeline (TF-IDF + Logistic Regression)
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(max_features=10000, ngram_range=(1, 2))),
    ("clf", LogisticRegression(max_iter=1000, C=1.0))
])

# Train
print("Training model...")
pipeline.fit(X_train, y_train)

# Evaluate
y_pred = pipeline.predict(X_test)
print(classification_report(y_test, y_pred))

# Save model
joblib.dump(pipeline, "sentiment_model.pkl")
print("✅ Model saved as sentiment_model.pkl")