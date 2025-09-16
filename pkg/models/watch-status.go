package models

const (
	WantToWatch      int = 1
	Watching         int = 2
	FinishedWatching int = 3
)

type WatchStatus struct {
	ID
	Status string `json:"status"`
}
