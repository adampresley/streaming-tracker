package tvmaze

type SearchResults []SearchResult

type Seasons []Season

// SearchResult represents a single search result from TVMaze API
type SearchResult struct {
	Score float64 `json:"score"`
	Show  Show    `json:"show"`
}

// Show represents a TV show from TVMaze API
type Show struct {
	ID             int       `json:"id"`
	URL            string    `json:"url"`
	Name           string    `json:"name"`
	Type           string    `json:"type"`
	Language       string    `json:"language"`
	Genres         []string  `json:"genres"`
	Status         string    `json:"status"`
	Runtime        *int      `json:"runtime"`
	AverageRuntime *int      `json:"averageRuntime"`
	Premiered      *string   `json:"premiered"`
	Ended          *string   `json:"ended"`
	OfficialSite   *string   `json:"officialSite"`
	Schedule       Schedule  `json:"schedule"`
	Rating         Rating    `json:"rating"`
	Weight         int       `json:"weight"`
	Network        *Network  `json:"network"`
	WebChannel     *Network  `json:"webChannel"`
	DVDCountry     *Country  `json:"dvdCountry"`
	Externals      Externals `json:"externals"`
	Image          *Image    `json:"image"`
	Summary        *string   `json:"summary"`
	Updated        int64     `json:"updated"`
	Links          Links     `json:"_links"`
}

// Schedule represents the show's broadcast schedule
type Schedule struct {
	Time string   `json:"time"`
	Days []string `json:"days"`
}

// Rating represents the show's rating information
type Rating struct {
	Average *float64 `json:"average"`
}

// Network represents a TV network or web channel
type Network struct {
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	Country      Country `json:"country"`
	OfficialSite *string `json:"officialSite"`
}

// Country represents country information
type Country struct {
	Name     string `json:"name"`
	Code     string `json:"code"`
	Timezone string `json:"timezone"`
}

// Externals represents external IDs for the show
type Externals struct {
	TVRage  *int    `json:"tvrage"`
	TheTVDB *int    `json:"thetvdb"`
	IMDB    *string `json:"imdb"`
}

// Image represents image URLs for the show
type Image struct {
	Medium   string `json:"medium"`
	Original string `json:"original"`
}

// Links represents related links
type Links struct {
	Self            Link  `json:"self"`
	PreviousEpisode *Link `json:"previousepisode"`
}

// Link represents a single link with href and optional name
type Link struct {
	Href string  `json:"href"`
	Name *string `json:"name,omitempty"`
}

// Season represents a TV show season from TVMaze API
type Season struct {
	ID           int      `json:"id"`
	URL          string   `json:"url"`
	Number       int      `json:"number"`
	Name         string   `json:"name"`
	EpisodeOrder int      `json:"episodeOrder"`
	PremiereDate *string  `json:"premiereDate"`
	EndDate      *string  `json:"endDate"`
	Network      *Network `json:"network"`
	WebChannel   *Network `json:"webChannel"`
	Image        *Image   `json:"image"`
	Summary      *string  `json:"summary"`
	Links        Links    `json:"_links"`
}
