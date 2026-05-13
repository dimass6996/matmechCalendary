package cron

import (
	"database/sql"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/dmitriy/syncstudy-backend/internal/db"
	"github.com/dmitriy/syncstudy-backend/internal/parser"
)

type Scheduler struct {
	cron     *cron.Cron
	db       *sql.DB
	groups   []string
	entryID  cron.EntryID
	mu       sync.Mutex
}

func NewScheduler(database *sql.DB, groups []string) *Scheduler {
	return &Scheduler{
		cron:   cron.New(cron.WithLocation(time.Local)),
		db:     database,
		groups: groups,
	}
}

func (s *Scheduler) Start() {
	var err error
	s.entryID, err = s.cron.AddFunc("@every 24h", s.fetchAndCache)
	if err != nil {
		log.Printf("cron add func error: %v", err)
		return
	}

	s.cron.Start()
	log.Println("[CRON] Scheduler started (every 24h)")

	// Run immediately on start
	go s.fetchAndCache()
}

func (s *Scheduler) Stop() {
	s.cron.Stop()
	log.Println("[CRON] Scheduler stopped")
}

func (s *Scheduler) fetchAndCache() {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Println("[CRON] Starting scheduled fetch for all groups...")

	now := time.Now()
	dateGte := now.Format("2006-01-02")
	dateLte := now.Add(7 * 24 * time.Hour).Format("2006-01-02")

	for _, groupID := range s.groups {
		log.Printf("[CRON] Fetching schedule for group: %s", groupID)

		result, err := parser.FetchGroupSchedule(groupID, dateGte, dateLte)
		if err != nil {
			log.Printf("[CRON] Error fetching for %s: %v", groupID, err)
			continue
		}

		for _, day := range result {
			rawBytes, err := json.Marshal(day.Lessons)
			if err != nil {
				log.Printf("[CRON] Error marshaling for %s on %s: %v", groupID, day.Date, err)
				continue
			}

			if err := db.InsertLessonCache(s.db, groupID, day.Date, string(rawBytes)); err != nil {
				log.Printf("[CRON] Error caching for %s on %s: %v", groupID, day.Date, err)
			}
		}

		parser.LogCachedSchedule(result)
		log.Printf("[CRON] Cached %d days for group %s", len(result), groupID)
	}

	log.Println("[CRON] Scheduled fetch complete")
}
