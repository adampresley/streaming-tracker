package responsetypes

type ActiveShowsGroupedByStatusAndWatchers struct {
	ShowID        int    `json:"showID"`
	ShowName      string `json:"showName"`
	NumSeasons    int    `json:"numSeasons"`
	PlatformName  string `json:"platformName"`
	PlatformIcon  string `json:"platformIcon"`
	Cancelled     bool   `json:"cancelled"`
	DateCancelled string `json:"dateCancelled"`
	WatchStatus   string `json:"watchStatus"`
	CurrentSeason int    `json:"currentSeason"`
	FinishedAt    string `json:"finishedAt"`
	WatcherName   string `json:"watcherName"`
}

type Show struct {
	ShowID        int    `json:"showID"`
	ShowName      string `json:"showName"`
	NumSeasons    int    `json:"numSeasons"`
	PlatformName  string `json:"platformName"`
	PlatformIcon  string `json:"platformIcon"`
	Cancelled     bool   `json:"cancelled"`
	DateCancelled string `json:"dateCancelled"`
	WatchStatus   string `json:"watchStatus"`
	CurrentSeason int    `json:"currentSeason"`
	FinishedAt    string `json:"finishedAt"`
	WatcherName   string `json:"watcherName"`
}

type PagedShows struct {
	Shows    []Show `json:"shows"`
	Page     int    `json:"page"`
	NumPages int    `json:"numPages"`
}
