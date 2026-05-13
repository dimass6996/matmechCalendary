package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/google/uuid"
	"github.com/dmitriy/syncstudy-backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

var (
	instance *sql.DB
	once     sync.Once
	mu       sync.RWMutex
)

func Init(dbPath string) (*sql.DB, error) {
	var err error
	once.Do(func() {
		instance, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_foreign_keys=on")
		if err == nil {
			instance.SetMaxOpenConns(1)
			instance.SetMaxIdleConns(1)
			err = migrate(instance)
		}
	})
	return instance, err
}

func migrate(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			login TEXT UNIQUE NOT NULL,
			first_name TEXT NOT NULL DEFAULT '',
			last_name TEXT NOT NULL DEFAULT '',
			group_id TEXT NOT NULL,
			password_hash TEXT NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS subjects (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			color_hex TEXT NOT NULL DEFAULT '#3b82f6'
		)`,
		`CREATE TABLE IF NOT EXISTS lessons_cache (
			group_id TEXT NOT NULL,
			lesson_date TEXT NOT NULL,
			raw_json TEXT NOT NULL,
			PRIMARY KEY (group_id, lesson_date)
		)`,
		`CREATE TABLE IF NOT EXISTS tasks (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL DEFAULT 'default',
			lesson_id TEXT NOT NULL DEFAULT '',
			subject_name TEXT NOT NULL,
			target_date TEXT NOT NULL,
			content TEXT NOT NULL DEFAULT '',
			is_done INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_subject_date ON tasks(subject_name, target_date)`,
		`CREATE TABLE IF NOT EXISTS notes (
			lesson_id TEXT NOT NULL,
			user_id TEXT NOT NULL DEFAULT 'default',
			content TEXT NOT NULL DEFAULT '',
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (lesson_id, user_id)
		)`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	// Add columns and indexes if missing (for dev schema evolution)
	alterQueries := []string{
		`ALTER TABLE users ADD COLUMN login TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE lessons_cache ADD COLUMN id TEXT`,
	}
	for _, q := range alterQueries {
		db.Exec(q)
	}
	db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON users(login)`)
	db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_cache_group_date ON lessons_cache(group_id, lesson_date)`)

	return nil
}

func GetDB() *sql.DB {
	return instance
}

func SeedDefaultSubject(db *sql.DB, name, color string) string {
	var id string
	err := db.QueryRow("SELECT id FROM subjects WHERE name = ?", name).Scan(&id)
	if err == sql.ErrNoRows {
		id = uuid.New().String()
		_, err = db.Exec("INSERT INTO subjects (id, name, color_hex) VALUES (?, ?, ?)", id, name, color)
		if err != nil {
			log.Printf("seed subject error: %v", err)
			return ""
		}
	}
	return id
}

func InsertLessonCache(db *sql.DB, groupID, date, rawJSON string) error {
	_, err := db.Exec(
		`INSERT INTO lessons_cache (group_id, lesson_date, raw_json) VALUES (?, ?, ?)
		 ON CONFLICT(group_id, lesson_date) DO UPDATE SET raw_json = excluded.raw_json`,
		groupID, date, rawJSON,
	)
	return err
}

func GetLessonCache(db *sql.DB, groupID, dateGte, dateLte string) ([]models.UrFUDay, error) {
	rows, err := db.Query(
		"SELECT lesson_date, raw_json FROM lessons_cache WHERE group_id = ? AND lesson_date >= ? AND lesson_date <= ? ORDER BY lesson_date",
		groupID, dateGte, dateLte,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.UrFUDay
	for rows.Next() {
		var dateStr, raw string
		if err := rows.Scan(&dateStr, &raw); err != nil {
			return nil, err
		}
		var lessons []models.UrFULessonItem
		if err := json.Unmarshal([]byte(raw), &lessons); err != nil {
			return nil, err
		}
		results = append(results, models.UrFUDay{
			Date:    dateStr,
			Lessons: lessons,
		})
	}
	return results, nil
}

func CreateTask(db *sql.DB, userID, lessonID, subjectName, targetDate, content string) (*models.Task, error) {
	id := uuid.New().String()
	now := time.Now()
	_, err := db.Exec(
		`INSERT INTO tasks (id, user_id, lesson_id, subject_name, target_date, content) VALUES (?, ?, ?, ?, ?, ?)`,
		id, userID, lessonID, subjectName, targetDate, content,
	)
	if err != nil {
		return nil, err
	}
	return &models.Task{
		ID:          id,
		UserID:      userID,
		LessonID:    lessonID,
		SubjectName: subjectName,
		TargetDate:  targetDate,
		Content:     content,
		IsDone:      false,
		CreatedAt:   now,
	}, nil
}

func UpdateTask(db *sql.DB, id string, content *string, isDone *bool) (*models.Task, error) {
	mu.Lock()
	defer mu.Unlock()

	if content != nil {
		if _, err := db.Exec("UPDATE tasks SET content = ? WHERE id = ?", *content, id); err != nil {
			return nil, err
		}
	}
	if isDone != nil {
		val := 0
		if *isDone {
			val = 1
		}
		if _, err := db.Exec("UPDATE tasks SET is_done = ? WHERE id = ?", val, id); err != nil {
			return nil, err
		}
	}

	var task models.Task
	err := db.QueryRow(
		`SELECT id, user_id, lesson_id, subject_name, target_date, content, is_done, created_at FROM tasks WHERE id = ?`, id,
	).Scan(&task.ID, &task.UserID, &task.LessonID, &task.SubjectName, &task.TargetDate, &task.Content, &task.IsDone, &task.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func DeleteTask(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM tasks WHERE id = ?", id)
	return err
}

func GetTasksBySubjectDate(db *sql.DB, userID, subjectName, targetDate string) ([]models.Task, error) {
	rows, err := db.Query(
		`SELECT id, user_id, lesson_id, subject_name, target_date, content, is_done, created_at
		 FROM tasks WHERE user_id = ? AND subject_name = ? AND target_date = ? ORDER BY created_at`,
		userID, subjectName, targetDate,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []models.Task
	for rows.Next() {
		var t models.Task
		if err := rows.Scan(&t.ID, &t.UserID, &t.LessonID, &t.SubjectName, &t.TargetDate, &t.Content, &t.IsDone, &t.CreatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func checkPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func CreateUser(database *sql.DB, login, password, firstName, lastName, groupID string) (*models.User, error) {
	id := uuid.New().String()
	passwordHash, err := hashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}
	_, err = database.Exec(
		`INSERT INTO users (id, login, first_name, last_name, group_id, password_hash) VALUES (?, ?, ?, ?, ?, ?)`,
		id, login, firstName, lastName, groupID, passwordHash,
	)
	if err != nil {
		return nil, err
	}
	return &models.User{
		ID:        id,
		Login:     login,
		FirstName: firstName,
		LastName:  lastName,
		GroupID:   groupID,
		CreatedAt: time.Now(),
	}, nil
}

func GetUserByLogin(database *sql.DB, login string) (*models.UserFull, error) {
	var u models.UserFull
	err := database.QueryRow(
		`SELECT id, login, first_name, last_name, group_id, password_hash, created_at FROM users WHERE login = ?`, login,
	).Scan(&u.ID, &u.Login, &u.FirstName, &u.LastName, &u.GroupID, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func GetUserByID(database *sql.DB, id string) (*models.User, error) {
	var u models.User
	err := database.QueryRow(
		`SELECT id, login, first_name, last_name, group_id, created_at FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.Login, &u.FirstName, &u.LastName, &u.GroupID, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func GetAllUsers(database *sql.DB) ([]models.User, error) {
	rows, err := database.Query(`SELECT id, login, first_name, last_name, group_id, created_at FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Login, &u.FirstName, &u.LastName, &u.GroupID, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func UpsertNote(database *sql.DB, lessonID, userID, content string) error {
	_, err := database.Exec(
		`INSERT INTO notes (lesson_id, user_id, content, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(lesson_id, user_id) DO UPDATE SET content = ?, updated_at = CURRENT_TIMESTAMP`,
		lessonID, userID, content, content,
	)
	return err
}

func GetNote(database *sql.DB, lessonID, userID string) (string, error) {
	var content string
	err := database.QueryRow(
		`SELECT content FROM notes WHERE lesson_id = ? AND user_id = ?`, lessonID, userID,
	).Scan(&content)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return content, nil
}

func GetAllTasksForDateRange(db *sql.DB, userID, dateGte, dateLte string) ([]models.Task, error) {
	rows, err := db.Query(
		`SELECT id, user_id, lesson_id, subject_name, target_date, content, is_done, created_at
		 FROM tasks WHERE user_id = ? AND target_date >= ? AND target_date <= ? ORDER BY target_date, created_at`,
		userID, dateGte, dateLte,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []models.Task
	for rows.Next() {
		var t models.Task
		if err := rows.Scan(&t.ID, &t.UserID, &t.LessonID, &t.SubjectName, &t.TargetDate, &t.Content, &t.IsDone, &t.CreatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}
