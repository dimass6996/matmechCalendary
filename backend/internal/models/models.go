package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID        string    `json:"id"`
	Login     string    `json:"login"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	GroupID   string    `json:"group_id"`
	CreatedAt time.Time `json:"created_at"`
}

type UserFull struct {
	User
	PasswordHash string `json:"-"`
}

func (u *UserFull) CheckPassword(password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) == nil
}

type Subject struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ColorHex string `json:"color_hex"`
}

type Lesson struct {
	ID          string `json:"id"`
	GroupID     string `json:"group_id"`
	SubjectID   string `json:"subject_id"`
	SubjectName string `json:"subject_name"`
	ColorHex    string `json:"color_hex"`
	Date        string `json:"date"`
	TimeStart   string `json:"time_start"`
	TimeEnd     string `json:"time_end"`
	Teacher     string `json:"teacher"`
	Room        string `json:"room"`
	LessonType  string `json:"lesson_type"`
	IsPast      bool   `json:"is_past"`
	TaskCount   int    `json:"task_count"`
}

type Task struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	LessonID    string    `json:"lesson_id"`
	SubjectName string    `json:"subject_name"`
	TargetDate  string    `json:"target_date"`
	Content     string    `json:"content"`
	IsDone      bool      `json:"is_done"`
	CreatedAt   time.Time `json:"created_at"`
}

type ScheduleResponse struct {
	Date    string   `json:"date"`
	Lessons []Lesson `json:"lessons"`
	Tasks   []Task   `json:"tasks"`
}

type UrFUDay struct {
	Date    string           `json:"date"`
	Lessons []UrFULessonItem `json:"lessons"`
}

type UrFULessonItem struct {
	BeginLesson string `json:"beginLesson"`
	EndLesson   string `json:"endLesson"`
	Discipline  string `json:"discipline"`
	Teacher     string `json:"teacher"`
	Auditorium  string `json:"auditorium"`
	Type        string `json:"type"`
}

// V2 API response from urfu.ru/api/v2/schedule
type ScheduleV2Response struct {
	Group  ScheduleV2Group  `json:"group"`
	Events []ScheduleV2Event `json:"events"`
}

type ScheduleV2Group struct {
	ID         int    `json:"id"`
	DivisionID int    `json:"divisionId"`
	Course     int    `json:"course"`
	Title      string `json:"title"`
}

type ScheduleV2Event struct {
	ID                   string  `json:"id"`
	EventID              int     `json:"eventId"`
	Title                string  `json:"title"`
	LoadType             string  `json:"loadType"`
	Date                 string  `json:"date"`
	TimeBegin            string  `json:"timeBegin"`
	TimeEnd              string  `json:"timeEnd"`
	PairNumber           int     `json:"pairNumber"`
	AuditoryTitle        *string `json:"auditoryTitle"`
	AuditoryLocation     *string `json:"auditoryLocation"`
	TeacherName          *string `json:"teacherName"`
	Comment              *string `json:"comment"`
}
