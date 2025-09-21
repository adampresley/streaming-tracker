package utelly

type SearchResults struct {
	Term    string         `json:"term"`
	Results []SearchResult `json:"results"` // Note, if no results are found, this will be an empty object. So unmarshal will fail

	Type    string `json:"type"`
	Title   string `json:"title"`
	Detail  string `json:"detail"`
	Message string `json:"message"`
}

type SearchResult struct {
	Locations   []Location             `json:"locations"`
	Weight      int                    `json:"weight"`
	ID          string                 `json:"id"`
	ExternalIDs map[string]*ExternalID `json:"external_ids"`
	Picture     string                 `json:"picture"`
	Provider    string                 `json:"provider"`
	Name        string                 `json:"name"`
}

type Location struct {
	DisplayName string `json:"display_name"`
	ID          string `json:"id"`
	URL         string `json:"url"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
}

type ExternalID struct {
	URL string `json:"url"`
	ID  string `json:"id"`
}
