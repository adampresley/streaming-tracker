package shows

type SearchShowsOption func(s *SearchShowsOptions)

type SearchShowsOptions struct {
	Page     int
	ShowName string
	Platform int
	Watcher  int
}

func WithPage(page int) SearchShowsOption {
	return func(s *SearchShowsOptions) {
		s.Page = page
	}
}

func WithShowName(showName string) SearchShowsOption {
	return func(s *SearchShowsOptions) {
		s.ShowName = showName
	}
}

func WithPlatform(platform int) SearchShowsOption {
	return func(s *SearchShowsOptions) {
		s.Platform = platform
	}
}

func WithWatcher(watcher int) SearchShowsOption {
	return func(s *SearchShowsOptions) {
		s.Watcher = watcher
	}
}
