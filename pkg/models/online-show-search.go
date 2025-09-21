package models

type OnlineShowApiSettings struct {
	ApiKey  string
	Header1 string
	Host    string
}

type OnlineShowSearchResult struct {
	ImageURLs        []string   `json:"imageUrls"`
	ImdbLink         string     `json:"imdbLink"`
	Name             string     `json:"name"`
	NumSeasons       int        `json:"numSeasons"`
	Platforms        []Platform `json:"platforms"`
	RawPlatformNames []string   `json:"rawPlatformNames"`
	Weight           int        `json:"weight"`
}
