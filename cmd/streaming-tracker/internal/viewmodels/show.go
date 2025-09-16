package viewmodels

import (
	"github.com/adampresley/adamgokit/paging"
	"github.com/adampresley/streaming-tracker/pkg/models"
)

type AddShow struct {
	BaseViewModel

	ShowName     string
	TotalSeasons int
	PlatformID   int
	WatcherIDs   []int
	Platforms    []*models.Platform
	Watchers     []SelectableWatcher
}

type EditShow struct {
	BaseViewModel

	ShowID          int
	ShowName        string
	TotalSeasons    int
	PlatformID      int
	WatcherIDs      []int
	Platforms       []*models.Platform
	Watchers        []SelectableWatcher
	ShowIsFinished  bool
	ShowIsCancelled bool
}

type ManageShows struct {
	BaseViewModel

	Platforms []*models.Platform

	Page     int
	ShowName string
	Platform int
	Shows    []Show
	Paging   paging.Paging
}

type Show struct {
	ShowID        int
	ShowName      string
	NumSeasons    int
	PlatformName  string
	PlatformIcon  string
	Cancelled     bool
	DateCancelled string
	WatchStatus   string
	CurrentSeason int
	FinishedAt    string
	WatcherName   string
	TotalCount    int
}
