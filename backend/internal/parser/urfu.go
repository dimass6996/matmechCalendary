package parser

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/dmitriy/syncstudy-backend/internal/models"
)

var (
	subjectColorMap map[string]string
	colorOnce       sync.Once
	apiClient       = &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			Proxy: nil, // bypass system proxy for UrFU API
			DialContext: (&net.Dialer{
				Timeout: 10 * time.Second,
			}).DialContext,
		},
	}
	searchClient = &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			Proxy: nil,
			DialContext: (&net.Dialer{
				Timeout: 10 * time.Second,
			}).DialContext,
		},
	}
	colors = []string{
		"#3b82f6", // blue
		"#ef4444", // red
		"#22c55e", // green
		"#f59e0b", // amber
		"#8b5cf6", // violet
		"#ec4899", // pink
		"#14b8a6", // teal
		"#f97316", // orange
		"#84cc16", // lime
		"#06b6d4", // cyan
	}
	colorIndex int
	colorMu    sync.Mutex
)

func init() {
	subjectColorMap = make(map[string]string)
}

func NormalizeSubjectName(name string) string {
	name = strings.TrimSpace(name)
	name = strings.ToLower(name)

	// Map common variations to canonical names
	replacements := map[string]string{
		"математический анализ": "Математический анализ",
		"математика":            "Математический анализ",
		"мат. анализ":           "Математический анализ",
		"мат анализ":            "Математический анализ",
		"алгоритмы и структуры данных": "Алгоритмы и СД",
		"алгоритмы":                   "Алгоритмы и СД",
		"асд":                         "Алгоритмы и СД",
		"базы данных":                 "Базы данных",
		"бд":                          "Базы данных",
		"физическая культура":         "Физическая культура",
		"физра":                       "Физическая культура",
		"физ-ра":                      "Физическая культура",
		"физика":                      "Физика",
		"английский язык":             "Английский язык",
		"англ. язык":                  "Английский язык",
		"иностранный язык":            "Иностранный язык",
		"дискретная математика":       "Дискретная математика",
		"дискретка":                   "Дискретная математика",
		"линейная алгебра":            "Линейная алгебра",
		"лин. алгебра":                "Линейная алгебра",
		"инженерная графика":          "Инженерная графика",
		"история россии":                       "История России",
		"теория вероятностей":                  "Теория вероятностей",
		"тервер":                               "Теория вероятностей",
		"русский язык и культура речи":         "Русский язык и культура речи",
		"алгебра и геометрия":                  "Алгебра и геометрия",
		"прикладная физическая культура":       "Физическая культура",
		"языки и технологии программирования":  "Языки и технологии программирования",
		"правоведение":                         "Правоведение",
	}

	// Try direct match
	if v, ok := replacements[name]; ok {
		return v
	}

	// Fuzzy match: check if any key is contained in the name
	for key, val := range replacements {
		if strings.Contains(name, key) {
			return val
		}
	}

	// Capitalize first letter of each word as fallback
	return capitalize(name)
}

func capitalize(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		if len(w) > 0 {
			runes := []rune(w)
			runes[0] = unicode.ToUpper(runes[0])
			words[i] = string(runes)
		}
	}
	return strings.Join(words, " ")
}

func GetColorForSubject(name string) string {
	colorMu.Lock()
	defer colorMu.Unlock()

	if c, ok := subjectColorMap[name]; ok {
		return c
	}
	c := colors[colorIndex%len(colors)]
	colorIndex++
	subjectColorMap[name] = c
	return c
}

type groupSearchResult struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
}

func resolveGroupID(groupName string) (int, error) {
	searchURL := "https://urfu.ru/api/schedule/groups/"
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return 0, fmt.Errorf("create search request: %w", err)
	}
	q := req.URL.Query()
	q.Add("search", groupName)
	req.URL.RawQuery = q.Encode()
	req.Header.Set("User-Agent", "SyncStudy/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := searchClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("search group: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("read search body: %w", err)
	}

	var results []groupSearchResult
	if err := json.Unmarshal(body, &results); err != nil {
		return 0, fmt.Errorf("parse search json: %w", err)
	}

	for _, r := range results {
		if r.Title == groupName {
			return r.ID, nil
		}
	}

	if len(results) > 0 {
		return results[0].ID, nil
	}

	return 0, fmt.Errorf("group %q not found", groupName)
}

func seedSchedule(groupID, dateGte, dateLte string) []models.UrFUDay {
	now, err := time.Parse("2006-01-02", dateGte)
	if err != nil {
		log.Printf("[SEED] invalid date_gte %q: %v", dateGte, err)
		return nil
	}
	var days []models.UrFUDay

	log.Printf("[SEED] Generating mock schedule for group %s", groupID)

	subjects := map[time.Weekday][]models.UrFULessonItem{
		time.Monday: {
			{BeginLesson: "09:00", EndLesson: "10:30", Discipline: "Математический анализ", Teacher: "Козлова Н.В.", Auditorium: "ГУК-312", Type: "Лекция"},
			{BeginLesson: "10:45", EndLesson: "12:15", Discipline: "Информатика", Teacher: "Боровков А.С.", Auditorium: "И-319", Type: "Лабораторная"},
			{BeginLesson: "12:50", EndLesson: "14:20", Discipline: "Иностранный язык", Teacher: "Смирнова Е.А.", Auditorium: "ГУК-415", Type: "Практика"},
		},
		time.Tuesday: {
			{BeginLesson: "09:00", EndLesson: "10:30", Discipline: "Линейная алгебра", Teacher: "Козлова Н.В.", Auditorium: "ГУК-312", Type: "Лекция"},
			{BeginLesson: "10:45", EndLesson: "12:15", Discipline: "Физика", Teacher: "Медведев Д.А.", Auditorium: "Ф-201", Type: "Лекция"},
			{BeginLesson: "12:50", EndLesson: "14:20", Discipline: "История России", Teacher: "Кузнецов И.В.", Auditorium: "ГУК-101", Type: "Практика"},
		},
		time.Wednesday: {
			{BeginLesson: "09:00", EndLesson: "10:30", Discipline: "Математический анализ", Teacher: "Козлова Н.В.", Auditorium: "ГУК-312", Type: "Практика"},
			{BeginLesson: "10:45", EndLesson: "12:15", Discipline: "Инженерная графика", Teacher: "Попов С.И.", Auditorium: "Ч-108", Type: "Лабораторная"},
		},
		time.Thursday: {
			{BeginLesson: "09:00", EndLesson: "10:30", Discipline: "Физика", Teacher: "Медведев Д.А.", Auditorium: "Ф-201", Type: "Практика"},
			{BeginLesson: "10:45", EndLesson: "12:15", Discipline: "Иностранный язык", Teacher: "Смирнова Е.А.", Auditorium: "ГУК-415", Type: "Практика"},
			{BeginLesson: "12:50", EndLesson: "14:20", Discipline: "Линейная алгебра", Teacher: "Козлова Н.В.", Auditorium: "ГУК-312", Type: "Практика"},
		},
		time.Friday: {
			{BeginLesson: "09:00", EndLesson: "10:30", Discipline: "Физическая культура", Teacher: "Зайцев П.В.", Auditorium: "Спортзал", Type: "Практика"},
			{BeginLesson: "10:45", EndLesson: "12:15", Discipline: "Информатика", Teacher: "Боровков А.С.", Auditorium: "И-319", Type: "Лекция"},
		},
	}

	for i := 0; i < 14; i++ {
		d := now.AddDate(0, 0, i)
		dateStr := d.Format("2006-01-02")
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}
		lessons := subjects[d.Weekday()]
		if len(lessons) == 0 {
			continue
		}
		days = append(days, models.UrFUDay{
			Date:    dateStr,
			Lessons: lessons,
		})
	}
	return days
}

func FetchGroupSchedule(groupID string, dateGte, dateLte string) ([]models.UrFUDay, error) {
	numericID, err := resolveGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("resolve group: %w", err)
	}

	baseURL := fmt.Sprintf("https://urfu.ru/api/v2/schedule/groups/%d/schedule", numericID)
	req, err := http.NewRequest("GET", baseURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	q := req.URL.Query()
	q.Add("date_gte", dateGte)
	q.Add("date_lte", dateLte)
	req.URL.RawQuery = q.Encode()

	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
	req.Header.Set("Accept", "application/json")

	resp, err := apiClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch schedule: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	if resp.StatusCode != 200 || len(body) == 0 || body[0] == '<' {
		log.Printf("[PARSER] API unavailable for %s (id=%d, status=%d), using seed data", groupID, numericID, resp.StatusCode)
		seed := seedSchedule(groupID, dateGte, dateLte)
		return seed, nil
	}

	var result models.ScheduleV2Response
	if err := json.Unmarshal(body, &result); err != nil {
		snippet := body
		if len(snippet) > 100 {
			snippet = snippet[:100]
		}
		return nil, fmt.Errorf("parse json for group %s (id=%d): %w (body: %s...)", groupID, numericID, err, string(snippet))
	}

	return v2EventsToUrFUDays(result.Events), nil
}

func v2EventsToUrFUDays(events []models.ScheduleV2Event) []models.UrFUDay {
	dateMap := make(map[string][]models.UrFULessonItem)
	dateOrder := []string{}
	seen := make(map[string]bool)

	for _, ev := range events {
		if _, ok := dateMap[ev.Date]; !ok {
			dateOrder = append(dateOrder, ev.Date)
		}

		teacher := ""
		if ev.TeacherName != nil {
			teacher = *ev.TeacherName
		}
		if teacher == "" && ev.Comment != nil && !strings.Contains(*ev.Comment, "ауд.") {
			teacher = *ev.Comment
		}

		room := ""
		if ev.AuditoryTitle != nil {
			room = *ev.AuditoryTitle
		}
		if room == "" && ev.Comment != nil && strings.Contains(*ev.Comment, "ауд.") {
			room = strings.TrimPrefix(*ev.Comment, "ауд. ")
		}

		// Deduplicate events with same date + time + title
		key := ev.Date + "|" + ev.TimeBegin + "|" + ev.Title
		if seen[key] {
			continue
		}
		seen[key] = true

		dateMap[ev.Date] = append(dateMap[ev.Date], models.UrFULessonItem{
			BeginLesson: ev.TimeBegin[:5],
			EndLesson:   ev.TimeEnd[:5],
			Discipline:  ev.Title,
			Teacher:     teacher,
			Auditorium:  room,
			Type:        ev.LoadType,
		})
	}

	var days []models.UrFUDay
	for _, dateStr := range dateOrder {
		lessons := dateMap[dateStr]
		if len(lessons) == 0 {
			continue
		}
		days = append(days, models.UrFUDay{
			Date:    dateStr,
			Lessons: lessons,
		})
	}

	sort.Slice(days, func(i, j int) bool {
		return days[i].Date < days[j].Date
	})

	return days
}

func ParseLessons(apiResponses []models.UrFUDay, groupID string, today time.Time) []models.Lesson {
	var lessons []models.Lesson

	for _, day := range apiResponses {
		for _, l := range day.Lessons {
			discipline := strings.TrimSuffix(l.Discipline, " (подгруппа)")
			subjectName := NormalizeSubjectName(discipline)
			lessonDate := day.Date

			isPast := false
			if parsed, err := time.Parse("2006-01-02", lessonDate); err == nil {
				if parsed.Before(today) || (parsed.Equal(today) && l.EndLesson < today.Format("15:04")) {
					isPast = true
				}
			}

			lesson := models.Lesson{
				ID:          fmt.Sprintf("%s-%s-%s", groupID, lessonDate, l.BeginLesson),
				GroupID:     groupID,
				SubjectID:   "",
				SubjectName: subjectName,
				ColorHex:    GetColorForSubject(subjectName),
				Date:        lessonDate,
				TimeStart:   l.BeginLesson,
				TimeEnd:     l.EndLesson,
				Teacher:     l.Teacher,
				Room:        l.Auditorium,
				LessonType:  l.Type,
				IsPast:      isPast,
				TaskCount:   0,
			}
			lessons = append(lessons, lesson)
		}
	}

	return lessons
}

func LogCachedSchedule(result []models.UrFUDay) {
	for _, day := range result {
		for _, l := range day.Lessons {
			log.Printf("[CACHE] %s %s : %s: %s (%s)", day.Date, l.BeginLesson, l.Discipline, l.Teacher, l.Auditorium)
		}
	}
}
