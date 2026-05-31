package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var db *mongo.Database

type AnalysisRecord struct {
	ID        primitive.ObjectID     `bson:"_id,omitempty" json:"id"`
	VideoID   string                 `bson:"videoId" json:"videoId"`
	VideoURL  string                 `bson:"videoUrl" json:"videoUrl"`
	Title     string                 `bson:"title" json:"title"`
	Summary   map[string]interface{} `bson:"summary" json:"summary"`
	Results   []interface{}          `bson:"results" json:"results"`
	CreatedAt time.Time              `bson:"createdAt" json:"createdAt"`
}

func main() {
	godotenv.Load()

	// Connect MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(os.Getenv("MONGO_URI")))
	if err != nil {
		log.Fatal("MongoDB connection failed:", err)
	}
	db = client.Database("sentimentdb")
	fmt.Println("✅ MongoDB connected")

	r := gin.Default()
	r.Use(cors.Default())

	r.POST("/api/analyse", analyseVideo)
	r.GET("/api/history", getHistory)
	r.DELETE("/api/history/:id", deleteHistory)

	port := os.Getenv("PORT")
	if port == "" {
		port = "9000"
	}
	fmt.Println("🚀 Backend running on port", port)
	r.Run(":" + port)
}

func analyseVideo(c *gin.Context) {
	var body struct {
		URL string `json:"url"`
	}
	if err := c.BindJSON(&body); err != nil || body.URL == "" {
		c.JSON(400, gin.H{"error": "Invalid URL"})
		return
	}

	videoID := extractVideoID(body.URL)
	if videoID == "" {
		c.JSON(400, gin.H{"error": "Could not extract video ID"})
		return
	}

	// Fetch comments from YouTube
	comments, title, err := fetchYouTubeComments(videoID)
	if err != nil || len(comments) == 0 {
		c.JSON(500, gin.H{"error": "Could not fetch comments: " + err.Error()})
		return
	}

	// Call ML service
	mlURL := os.Getenv("ML_SERVICE_URL") + "/analyse"
	payload, _ := json.Marshal(map[string]interface{}{"comments": comments})
	resp, err := http.Post(mlURL, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		c.JSON(500, gin.H{"error": "ML service error"})
		return
	}
	defer resp.Body.Close()
	bodyBytes, _ := io.ReadAll(resp.Body)

	var mlResult map[string]interface{}
	json.Unmarshal(bodyBytes, &mlResult)

	// Save to MongoDB
	record := AnalysisRecord{
		ID:        primitive.NewObjectID(),
		VideoID:   videoID,
		VideoURL:  body.URL,
		Title:     title,
		Summary:   mlResult["summary"].(map[string]interface{}),
		Results:   mlResult["results"].([]interface{}),
		CreatedAt: time.Now(),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db.Collection("analyses").InsertOne(ctx, record)

	c.JSON(200, record)
}

func getHistory(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.Collection("analyses").Find(ctx, bson.M{},
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(20))
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	var records []AnalysisRecord
	cursor.All(ctx, &records)
	c.JSON(200, records)
}

func deleteHistory(c *gin.Context) {
	id, _ := primitive.ObjectIDFromHex(c.Param("id"))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db.Collection("analyses").DeleteOne(ctx, bson.M{"_id": id})
	c.JSON(200, gin.H{"message": "Deleted"})
}

func extractVideoID(url string) string {
	patterns := []string{"v=", "youtu.be/", "embed/", "shorts/"}
	for _, p := range patterns {
		if idx := indexOf(url, p); idx != -1 {
			id := url[idx+len(p):]
			for i, ch := range id {
				if ch == '&' || ch == '?' || ch == '/' {
					return id[:i]
				}
			}
			return id
		}
	}
	return ""
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func fetchYouTubeComments(videoID string) ([]string, string, error) {
	apiKey := os.Getenv("YOUTUBE_API_KEY")
	url := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=%s&maxResults=100&key=%s",
		videoID, apiKey,
	)
	resp, err := http.Get(url)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	var comments []string
	title := videoID

	items, ok := result["items"].([]interface{})
	if !ok {
		return nil, title, fmt.Errorf("no comments found or video comments are disabled")
	}
	for _, item := range items {
		snippet := item.(map[string]interface{})["snippet"].(map[string]interface{})
		topComment := snippet["topLevelComment"].(map[string]interface{})["snippet"].(map[string]interface{})
		text := topComment["textDisplay"].(string)
		comments = append(comments, text)
	}
	return comments, title, nil
}