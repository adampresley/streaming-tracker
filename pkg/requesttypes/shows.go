package requesttypes

type SearchShowsRequest struct {
	Page int
}

type AddShowRequest struct {
	Name         string `json:"name"`
	TotalSeasons int    `json:"totalSeasons"`
	PlatformID   int    `json:"platformID"`
	WatcherIDs   []int  `json:"watcherIDs"`
	PosterImage  string `json:"posterImage"`
}

type EditShowRequest struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	TotalSeasons int    `json:"totalSeasons"`
	PlatformID   int    `json:"platformID"`
	WatcherIDs   []int  `json:"watcherIDs"`
	PosterImage  string `json:"posterImage"`
}
