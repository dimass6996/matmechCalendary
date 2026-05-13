package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/dmitriy/syncstudy-backend/internal/api"
	"github.com/dmitriy/syncstudy-backend/internal/cron"
	"github.com/dmitriy/syncstudy-backend/internal/db"
)

func main() {
	dbPath := os.Getenv("SYNCSTUDY_DB_PATH")
	if dbPath == "" {
		dbPath = "./syncstudy.db"
	}

	database, err := db.Init(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	seedTestUser(database)

	groups := []string{"МЕН-151001"}
	scheduler := cron.NewScheduler(database, groups)
	scheduler.Start()
	defer scheduler.Stop()

	handler := api.NewHandler(database)

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024 * 1024, // 10MB
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PATCH,DELETE,OPTIONS",
		AllowHeaders: "Content-Type,Authorization",
	}))

	app.Post("/api/auth/register", handler.Register)
	app.Post("/api/auth/login", handler.Login)

	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Protected routes
	protected := app.Group("/api", api.AuthMiddleware)
	protected.Get("/schedule", handler.GetSchedule)
	protected.Post("/tasks", handler.CreateTask)
	protected.Patch("/tasks/:id", handler.UpdateTask)
	protected.Delete("/tasks/:id", handler.DeleteTask)
	protected.Post("/notes", handler.SaveNote)
	protected.Get("/notes", handler.GetNote)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[SERVER] Starting SyncStudy backend on :%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func seedTestUser(database *sql.DB) {
	users, err := db.GetAllUsers(database)
	if err != nil || len(users) > 0 {
		return
	}
	_, err = db.CreateUser(database, "ivanov", "12345678", "Иван", "Иванов", "МЕН-151001")
	if err != nil {
		log.Printf("[SEED] Failed to create test user: %v", err)
	} else {
		log.Println("[SEED] Test user created: ivanov / 12345678")
	}
}
