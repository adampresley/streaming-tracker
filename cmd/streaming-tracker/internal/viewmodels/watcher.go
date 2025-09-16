package viewmodels

import "github.com/adampresley/streaming-tracker/pkg/models"

type SelectableWatcher struct {
	Watcher    *models.Watcher
	IsSelected bool
}

type ManageWatchers struct {
	BaseViewModel
	Watchers []WatcherDisplay `json:"watchers"`
}

type WatcherDisplay struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	UserEmail      string `json:"userEmail"`
	IsOwner        bool   `json:"isOwner"`
	IsCurrentUser  bool   `json:"isCurrentUser"`
	HasUserAccount bool   `json:"hasUserAccount"`
	CanEditName    bool   `json:"canEditName"`
}
