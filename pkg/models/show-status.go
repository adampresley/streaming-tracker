package models

import "time"

type ShowStatus struct {
	ID
	Account       Account     `json:"account"`
	Show          Show        `json:"show"`
	WatchStatus   WatchStatus `json:"watchStatus"`
	CurrentSeason int         `json:"currentSeason"`
	FinishedAt    time.Time   `json:"finishedAt"`
}
