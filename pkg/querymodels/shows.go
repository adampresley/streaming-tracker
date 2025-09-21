package querymodels

import (
	"database/sql"
)

type ActiveShowsGroupedByStatusAndWatchers struct {
	ShowID        int          `db:"show_id"`
	ShowName      string       `db:"show_name"`
	NumSeasons    int          `db:"num_seasons"`
	PlatformName  string       `db:"platform_name"`
	PlatformIcon  string       `db:"platform_icon"`
	Cancelled     bool         `db:"cancelled"`
	DateCancelled sql.NullTime `db:"date_cancelled"`
	WatchStatus   string       `db:"watch_status"`
	CurrentSeason int          `db:"current_season"`
	FinishedAt    sql.NullTime `db:"finished_at"`
	WatcherName   string       `db:"watcher_name"`
	PosterImage   string       `db:"poster_image"`
}

type Shows struct {
	ShowID        int          `db:"show_id"`
	ShowName      string       `db:"show_name"`
	NumSeasons    int          `db:"num_seasons"`
	PlatformName  string       `db:"platform_name"`
	PlatformIcon  string       `db:"platform_icon"`
	Cancelled     bool         `db:"cancelled"`
	DateCancelled sql.NullTime `db:"date_cancelled"`
	WatchStatus   string       `db:"watch_status"`
	CurrentSeason int          `db:"current_season"`
	FinishedAt    sql.NullTime `db:"finished_at"`
	WatcherName   string       `db:"watcher_name"`
	TotalCount    int          `db:"total_count"`
	PosterImage   string       `db:"poster_image"`
}
