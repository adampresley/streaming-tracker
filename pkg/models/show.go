package models

import "time"

type Show struct {
	ID
	Created
	Updated
	Account       Account   `json:"account"`
	Name          string    `json:"name"`
	NumSeasons    int       `json:"numSeasons"`
	Platform      Platform  `json:"platform"`
	Cancelled     bool      `json:"cancelled"`
	DateCancelled time.Time `json:"dateCancelled"`
	PosterImage   string    `json:"posterImage"`
}

type CreateShowRequest struct {
	Name        string `json:"name"`
	NumSeasons  int    `json:"numSeasons"`
	PlatformID  int    `json:"platformID"`
	PosterImage string `json:"posterImage"`
}

type ShowForEdit struct {
	ID            int        `json:"id"`
	Name          string     `json:"name"`
	NumSeasons    int        `json:"numSeasons"`
	PlatformID    int        `json:"platformID"`
	WatcherIds    []int      `json:"watcherIDs"`
	FinishedAt    *time.Time `json:"finishedAt"`
	Cancelled     bool       `json:"cancelled"`
	DateCancelled *time.Time `json:"dateCancelled"`
	PosterImage   string     `json:"posterImage"`
}

type ShowGroupedByStatusAndWatchers struct {
	ShowID        int        `json:"showID"`
	ShowName      string     `json:"showName"`
	NumSeasons    int        `json:"numSeasons"`
	PlatformName  string     `json:"platformName"`
	PlatformIcon  string     `json:"platformIcon"`
	Cancelled     bool       `json:"cancelled"`
	DateCancelled *time.Time `json:"dateCancelled"`
	WatchStatus   string     `json:"watchStatus"`
	CurrentSeason int        `json:"currentSeason"`
	FinishedAt    *time.Time `json:"finishedAt"`
	WatcherName   string     `json:"watcherName"`
	PosterImage   string     `json:"posterImage"`
}

type ShowsGroupedByStatusAndWatchers struct {
	Shows map[string]map[string][]ShowGroupedByStatusAndWatchers `json:"shows"`
}
