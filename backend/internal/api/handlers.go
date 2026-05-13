package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"regexp"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/golang-jwt/jwt/v5"
	"github.com/dmitriy/syncstudy-backend/internal/db"
	"github.com/dmitriy/syncstudy-backend/internal/models"
	"github.com/dmitriy/syncstudy-backend/internal/parser"
)

var (
	jwtSecret = func() []byte {
		s := os.Getenv("JWT_SECRET")
		if s == "" {
			s = "syncstudy-dev-secret-change-in-production"
		}
		return []byte(s)
	}()
	reLogin    = regexp.MustCompile(`^[a-zA-Z0-9]+$`)
	rePassword = regexp.MustCompile(`^[a-zA-Z0-9]+$`)
	reName     = regexp.MustCompile(`^[А-ЯЁ][а-яё]+$`)
	reGroup    = regexp.MustCompile(`^[А-ЯЁ]{3}-\d{6}$`)
)

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func generateToken(userID, login string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"login":   login,
		"exp":     time.Now().Add(7 * 24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func AuthMiddleware(c *fiber.Ctx) error {
	auth := c.Get("Authorization")
	if auth == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Missing authorization header"})
	}

	tokenStr := auth
	if len(auth) > 7 && auth[:7] == "Bearer " {
		tokenStr = auth[7:]
	}

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token claims"})
	}

	userID, _ := claims["user_id"].(string)
	if userID == "" {
		userID = "default"
	}
	c.Locals("user_id", userID)
	return c.Next()
}

type RegisterRequest struct {
	Login     string `json:"login"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	GroupID   string `json:"group_id"`
}

type LoginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Login == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" || req.GroupID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "All fields are required"})
	}

	if !reLogin.MatchString(req.Login) {
		return c.Status(400).JSON(fiber.Map{"error": "Login must contain only English letters"})
	}
	if utf8.RuneCountInString(req.Password) < 8 || !rePassword.MatchString(req.Password) {
		return c.Status(400).JSON(fiber.Map{"error": "Password must be at least 8 characters, English letters and digits only"})
	}
	if !reName.MatchString(req.FirstName) {
		return c.Status(400).JSON(fiber.Map{"error": "First name must start with a capital Russian letter followed by lowercase Russian letters"})
	}
	if !reName.MatchString(req.LastName) {
		return c.Status(400).JSON(fiber.Map{"error": "Last name must start with a capital Russian letter followed by lowercase Russian letters"})
	}
	if !reGroup.MatchString(req.GroupID) {
		return c.Status(400).JSON(fiber.Map{"error": "Group must be 3 Russian letters, a dash, and 6 digits (e.g. МЕН-151001)"})
	}

	user, err := db.CreateUser(h.DB, req.Login, req.Password, req.FirstName, req.LastName, req.GroupID)
	if err != nil {
		log.Printf("[API] Register error: %v", err)
		return c.Status(409).JSON(fiber.Map{"error": "User with this login already exists"})
	}

	token, err := generateToken(user.ID, user.Login)
	if err != nil {
		log.Printf("[API] Token generation error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.Status(201).JSON(AuthResponse{Token: token, User: *user})
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Login == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "login and password are required"})
	}

	user, err := db.GetUserByLogin(h.DB, req.Login)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Invalid login or password"})
	}

	if !user.CheckPassword(req.Password) {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid login or password"})
	}

	token, err := generateToken(user.ID, user.Login)
	if err != nil {
		log.Printf("[API] Token generation error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.JSON(AuthResponse{Token: token, User: user.User})
}

func userIDFromCtx(c *fiber.Ctx) string {
	uid, ok := c.Locals("user_id").(string)
	if !ok || uid == "" {
		uid = "default"
	}
	return uid
}

type Handler struct {
	DB *sql.DB
}

func NewHandler(database *sql.DB) *Handler {
	return &Handler{DB: database}
}

func (h *Handler) GetSchedule(c *fiber.Ctx) error {
	groupID := c.Query("group_id", "МЕН-151001")
	dateGte := c.Query("date_gte", time.Now().Format("2006-01-02"))
	dateLte := c.Query("date_lte", time.Now().Add(7*24*time.Hour).Format("2006-01-02"))

	// Try to fetch from remote API
	apiResult, err := parser.FetchGroupSchedule(groupID, dateGte, dateLte)
	if err != nil {
		log.Printf("[API] Fetch error: %v, falling back to cache", err)
	}

	today := time.Now()
	var lessons []models.Lesson

	if err == nil && len(apiResult) > 0 {
		// Cache the results
		for _, day := range apiResult {
			rawBytes, _ := json.Marshal(day.Lessons)
			if cacheErr := db.InsertLessonCache(h.DB, groupID, day.Date, string(rawBytes)); cacheErr != nil {
				log.Printf("[API] Cache insert error: %v", cacheErr)
			}
		}
		lessons = parser.ParseLessons(apiResult, groupID, today)
	} else {
		log.Println("[API] Using cached schedule data")
		cachedResults, cacheErr := db.GetLessonCache(h.DB, groupID, dateGte, dateLte)
		if cacheErr != nil || len(cachedResults) == 0 {
			return c.Status(503).JSON(fiber.Map{"error": "Schedule unavailable"})
		}
		lessons = parser.ParseLessons(cachedResults, groupID, today)
	}

	tasks, err := db.GetAllTasksForDateRange(h.DB, userIDFromCtx(c), dateGte, dateLte)
	if err != nil || tasks == nil {
		tasks = []models.Task{}
	}

	// Merge task counts into lessons
	taskMap := make(map[string]int)
	for _, t := range tasks {
		key := t.SubjectName + "|" + t.TargetDate
		if !t.IsDone {
			taskMap[key]++
		}
	}

	for i := range lessons {
		key := lessons[i].SubjectName + "|" + lessons[i].Date
		lessons[i].TaskCount = taskMap[key]
	}

	resp := models.ScheduleResponse{
		Date:    today.Format("2006-01-02"),
		Lessons: lessons,
		Tasks:   tasks,
	}

	return c.JSON(resp)
}

type CreateTaskRequest struct {
	LessonID    string `json:"lesson_id"`
	SubjectName string `json:"subject_name"`
	TargetDate  string `json:"target_date"`
	Content     string `json:"content"`
}

func (h *Handler) CreateTask(c *fiber.Ctx) error {
	var req CreateTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.SubjectName == "" || req.TargetDate == "" {
		return c.Status(400).JSON(fiber.Map{"error": "subject_name and target_date are required"})
	}

	task, err := db.CreateTask(h.DB, userIDFromCtx(c), req.LessonID, req.SubjectName, req.TargetDate, req.Content)
	if err != nil {
		log.Printf("[API] Create task error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create task"})
	}

	return c.Status(201).JSON(task)
}

type UpdateTaskRequest struct {
	Content *string `json:"content,omitempty"`
	IsDone  *bool   `json:"is_done,omitempty"`
}

func (h *Handler) UpdateTask(c *fiber.Ctx) error {
	id := c.Params("id")
	if _, err := uuid.Parse(id); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid task ID"})
	}

	var req UpdateTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	task, err := db.UpdateTask(h.DB, id, req.Content, req.IsDone)
	if err != nil {
		log.Printf("[API] Update task error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update task"})
	}

	return c.JSON(task)
}

func (h *Handler) DeleteTask(c *fiber.Ctx) error {
	id := c.Params("id")
	if _, err := uuid.Parse(id); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid task ID"})
	}

	if err := db.DeleteTask(h.DB, id); err != nil {
		log.Printf("[API] Delete task error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete task"})
	}

	return c.SendStatus(204)
}

type SaveNoteRequest struct {
	LessonID string `json:"lesson_id"`
	Content  string `json:"content"`
}

func (h *Handler) SaveNote(c *fiber.Ctx) error {
	var req SaveNoteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.LessonID == "" || req.Content == "" {
		return c.Status(400).JSON(fiber.Map{"error": "lesson_id and content are required"})
	}

	if err := db.UpsertNote(h.DB, req.LessonID, userIDFromCtx(c), req.Content); err != nil {
		log.Printf("[API] Save note error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save note"})
	}

	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *Handler) GetNote(c *fiber.Ctx) error {
	lessonID := c.Query("lesson_id")
	if lessonID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "lesson_id is required"})
	}

	content, err := db.GetNote(h.DB, lessonID, userIDFromCtx(c))
	if err != nil {
		log.Printf("[API] Get note error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get note"})
	}

	return c.JSON(fiber.Map{"content": content})
}
