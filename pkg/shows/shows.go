package shows

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/adampresley/adamgokit/rest"
	"github.com/adampresley/adamgokit/rest/calloptions"
	"github.com/adampresley/adamgokit/rest/clientoptions"
	"github.com/adampresley/streaming-tracker/pkg/models"
	"github.com/adampresley/streaming-tracker/pkg/querymodels"
	"github.com/adampresley/streaming-tracker/pkg/requesttypes"
	"github.com/adampresley/streaming-tracker/pkg/services"
	"github.com/adampresley/streaming-tracker/pkg/tvmaze"
	"github.com/alitto/pond/v2"
	"github.com/georgysavva/scany/v2/pgxscan"
	"github.com/jackc/pgx/v5/pgconn"
	orderedmap "github.com/wk8/go-ordered-map/v2"
)

var (
	ErrShowNotFound          = fmt.Errorf("show not found")
	ErrShowHasWatchedSeasons = fmt.Errorf("show has watched seasons and cannot be deleted")
)

type ShowServicer interface {
	AddSeason(accountID, showID int) error
	AddShow(accountID int, req requesttypes.AddShowRequest) (int, error)
	BackToWantToWatch(accountID, showID int) error
	CancelShow(accountID, showID int) error
	DeleteShow(accountID, showID int) error
	FindShowImageByName(showName string) (string, error)
	FinishSeason(accountID, showID int) error
	GetActiveShowsGroupedByStatusAndWatchers(accountID int) (*orderedmap.OrderedMap[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]], error)
	GetActiveShowsGroupedByWatchersAndStatus(accountID int) (*orderedmap.OrderedMap[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]], error)
	GetFinishedShows(accountID int) ([]querymodels.Shows, error)
	GetShowByID(accountID, showID int) (*models.ShowForEdit, error)
	OnlineSearch(searchTerm, country string) ([]models.OnlineShowSearchResult, error)
	SearchShows(accountID int, options ...SearchShowsOption) ([]querymodels.Shows, int, error)
	StartWatching(accountID, showID int) error
	UpdateShow(accountID int, req requesttypes.EditShowRequest) error
}

type ShowServiceConfig struct {
	services.DbServiceBaseConfig
	RestClientOptions *clientoptions.ClientOptions
}

type ShowService struct {
	services.DbServiceBase
	restClientOptions *clientoptions.ClientOptions
}

func NewShowService(config ShowServiceConfig) ShowService {
	return ShowService{
		DbServiceBase: services.DbServiceBase{
			QueryTimeout: config.QueryTimeout,
			DB:           config.DB,
			PageSize:     config.PageSize,
		},
		restClientOptions: config.RestClientOptions,
	}
}

func (s ShowService) AddShow(accountID int, req requesttypes.AddShowRequest) (int, error) {
	var (
		err    error
		showID int
	)

	ctx, cancel := s.GetContext()
	defer cancel()

	// Begin transaction
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("error beginning transaction: %w", err)
	}

	defer tx.Rollback(ctx)

	// Insert the show
	insertShowQuery := `
INSERT INTO shows (name, num_seasons, platform_id, account_id, poster_image, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
RETURNING id
	`

	if err = tx.QueryRow(ctx, insertShowQuery, req.Name, req.TotalSeasons, req.PlatformID, accountID, req.PosterImage).Scan(&showID); err != nil {
		return 0, fmt.Errorf("error inserting show: %w", err)
	}

	// Create show_status record with "Want to Watch" status (watch_status_id = 1)
	insertShowStatusQuery := `
INSERT INTO show_status (show_id, account_id, watch_status_id, current_season)
VALUES ($1, $2, 1, 0)
	`

	if _, err = tx.Exec(ctx, insertShowStatusQuery, showID, accountID); err != nil {
		return 0, fmt.Errorf("error inserting show status: %w", err)
	}

	// Link watchers to the show status
	for _, watcherID := range req.WatcherIDs {
		insertWatcherLinkQuery := `
INSERT INTO watchers_to_show_statuses (watcher_id, show_status_id)
VALUES ($1, (SELECT id FROM show_status WHERE show_id = $2 AND account_id = $3))
		`

		if _, err = tx.Exec(ctx, insertWatcherLinkQuery, watcherID, showID, accountID); err != nil {
			return 0, fmt.Errorf("error linking watcher to show: %w", err)
		}
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("error committing transaction: %w", err)
	}

	return showID, nil
}

func (s ShowService) AddSeason(accountID, showID int) error {
	var (
		err error
	)

	ctx, cancel := s.GetContext()
	defer cancel()

	// Begin transaction
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}

	defer tx.Rollback(ctx)

	// Clear the finished_at value in show_status table
	clearFinishedQuery := `
UPDATE show_status SET 
	finished_at = NULL,
	watch_status_id = 1,
	current_season = current_season + 1
WHERE show_id = $1 AND account_id = $2
	`

	result, err := tx.Exec(ctx, clearFinishedQuery, showID, accountID)
	if err != nil {
		return fmt.Errorf("error clearing finished_at: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrShowNotFound
	}

	// Increment num_seasons in shows table
	incrementSeasonsQuery := `
UPDATE shows 
SET num_seasons = num_seasons + 1, updated_at = NOW() AT TIME ZONE 'UTC'
WHERE id = $1 AND account_id = $2
	`

	result, err = tx.Exec(ctx, incrementSeasonsQuery, showID, accountID)
	if err != nil {
		return fmt.Errorf("error incrementing num_seasons: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrShowNotFound
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("error committing transaction: %w", err)
	}

	return nil
}

func (s ShowService) BackToWantToWatch(accountID, showID int) error {
	var (
		err    error
		result pgconn.CommandTag
	)

	ctx, cancel := s.GetContext()
	defer cancel()

	// Update the show status to "Want to Watch" (watch_status_id = 1)
	updateQuery := `
UPDATE show_status
SET watch_status_id = 1
WHERE show_id = $1
	`

	if result, err = s.DB.Exec(ctx, updateQuery, showID); err != nil {
		return fmt.Errorf("error updating show to want to watch status: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrShowNotFound
	}

	return nil
}

func (s ShowService) CancelShow(accountID, showID int) error {
	var (
		err    error
		result pgconn.CommandTag
	)

	ctx, cancel := s.GetContext()
	defer cancel()

	// Update the show to mark it as cancelled with current date
	updateQuery := `
UPDATE shows 
SET cancelled = true, date_cancelled = NOW() AT TIME ZONE 'UTC', updated_at = NOW() AT TIME ZONE 'UTC'
WHERE id = $1 AND account_id = $2
	`

	if result, err = s.DB.Exec(ctx, updateQuery, showID, accountID); err != nil {
		return fmt.Errorf("error cancelling show: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrShowNotFound
	}

	return nil
}

func (s ShowService) FinishSeason(accountID, showID int) error {
	var (
		err    error
		result pgconn.CommandTag
	)

	ctx, cancel := s.GetContext()
	defer cancel()

	updateQuery := `
UPDATE show_status ss
SET 
	current_season = CASE 
		WHEN ss.current_season = s.num_seasons THEN ss.current_season
		ELSE ss.current_season + 1 
	END,
	watch_status_id = CASE 
		WHEN ss.current_season = s.num_seasons THEN 3
		ELSE ss.watch_status_id 
	END,
	finished_at = CASE 
		WHEN ss.current_season = s.num_seasons THEN NOW() AT TIME ZONE 'UTC'
		ELSE ss.finished_at 
	END
FROM shows s
WHERE ss.show_id = $1 
	AND ss.show_id = s.id
	AND ss.account_id = $2
	`

	if result, err = s.DB.Exec(ctx, updateQuery, showID, accountID); err != nil {
		return fmt.Errorf("error finishing season: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrShowNotFound
	}

	return nil
}

func (s ShowService) GetActiveShowsGroupedByStatusAndWatchers(accountID int) (*orderedmap.OrderedMap[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]], error) {
	var (
		err         error
		queryResult = []querymodels.ActiveShowsGroupedByStatusAndWatchers{}
	)

	result := orderedmap.New[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]]()

	query := `
SELECT
	s.id AS show_id
	, s.name AS show_name
	, s.num_seasons
	, p.name AS platform_name
	, p.icon AS platform_icon
	, s.cancelled
	, s.date_cancelled
	, ws.status AS watch_status
	, ss.current_season
	, ss.finished_at
	, string_agg(w.name, ', ' ORDER BY w.name) AS watcher_name
	, s.poster_image
FROM watch_status AS ws
	INNER JOIN show_status AS ss ON ss.watch_status_id=ws.id
	LEFT JOIN shows AS s ON s.id=ss.show_id
	LEFT JOIN platforms AS p ON  p.id=s.platform_id
	INNER JOIN watchers_to_show_statuses AS wtss ON wtss.show_status_id=ss.id
	INNER JOIN watchers AS w ON w.id=wtss.watcher_id
WHERE 1=1
	AND ss.account_id=$1
	AND ss.watch_status_id IN (1, 2)
GROUP BY
	s.id, p.name, p.icon, ws.status, ss.current_season,
	ss.finished_at, ss.watch_status_id, s.poster_image
ORDER BY
	ss.watch_status_id DESC,
	s.name ASC
	`

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &queryResult, query, accountID); err != nil {
		if pgxscan.NotFound(err) {
			return result, nil
		}

		return result, fmt.Errorf("error fetching active grouped shows: %w", err)
	}

	for _, row := range queryResult {
		var (
			ok               bool
			watchStatusGroup *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]
			rows             []models.ShowGroupedByStatusAndWatchers
		)

		if watchStatusGroup, ok = result.Get(row.WatchStatus); !ok {
			result.Set(row.WatchStatus, orderedmap.New[string, []models.ShowGroupedByStatusAndWatchers]())
			watchStatusGroup, _ = result.Get(row.WatchStatus)
		}

		if rows, ok = watchStatusGroup.Get(row.WatcherName); !ok {
			watchStatusGroup.Set(row.WatcherName, []models.ShowGroupedByStatusAndWatchers{})
			rows = []models.ShowGroupedByStatusAndWatchers{}
		}

		item := models.ShowGroupedByStatusAndWatchers{
			ShowID:        row.ShowID,
			ShowName:      row.ShowName,
			NumSeasons:    row.NumSeasons,
			PlatformName:  row.PlatformName,
			PlatformIcon:  row.PlatformIcon,
			Cancelled:     row.Cancelled,
			WatchStatus:   row.WatchStatus,
			CurrentSeason: row.CurrentSeason,
			WatcherName:   row.WatcherName,
			PosterImage:   row.PosterImage,
		}

		if row.DateCancelled.Valid {
			item.DateCancelled = &row.DateCancelled.Time
		}

		if row.FinishedAt.Valid {
			item.FinishedAt = &row.FinishedAt.Time
		}

		rows = append(rows, item)
		watchStatusGroup.Set(row.WatcherName, rows)
	}

	return result, nil
}

func (s ShowService) GetActiveShowsGroupedByWatchersAndStatus(accountID int) (*orderedmap.OrderedMap[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]], error) {
	var (
		err         error
		queryResult = []querymodels.ActiveShowsGroupedByStatusAndWatchers{}
	)

	result := orderedmap.New[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]]()

	query := `
SELECT
	s.id AS show_id
	, s.name AS show_name
	, s.num_seasons
	, coalesce(s.poster_image, '') AS poster_image
	, p.name AS platform_name
	, p.icon AS platform_icon
	, s.cancelled
	, s.date_cancelled
	, ws.status AS watch_status
	, ss.current_season
	, ss.finished_at
	, string_agg(w.name, ', ' ORDER BY w.name) AS watcher_name
FROM watch_status AS ws
	INNER JOIN show_status AS ss ON ss.watch_status_id=ws.id
	LEFT JOIN shows AS s ON s.id=ss.show_id
	LEFT JOIN platforms AS p ON  p.id=s.platform_id
	INNER JOIN watchers_to_show_statuses AS wtss ON wtss.show_status_id=ss.id
	INNER JOIN watchers AS w ON w.id=wtss.watcher_id
WHERE 1=1
	AND ss.account_id=$1
	AND ss.watch_status_id IN (1, 2)
GROUP BY 
	s.id, s.poster_image, p.name, p.icon, ws.status, ss.current_season, 
	ss.finished_at, ss.watch_status_id
ORDER BY
	watcher_name ASC,
	ss.watch_status_id DESC,
	s.name ASC
;	`

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &queryResult, query, accountID); err != nil {
		if pgxscan.NotFound(err) {
			return result, nil
		}

		return result, fmt.Errorf("error fetching active grouped shows: %w", err)
	}

	for _, row := range queryResult {
		var (
			ok               bool
			watcherNameGroup *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]
			rows             []models.ShowGroupedByStatusAndWatchers
		)

		if watcherNameGroup, ok = result.Get(row.WatcherName); !ok {
			result.Set(row.WatcherName, orderedmap.New[string, []models.ShowGroupedByStatusAndWatchers]())
			watcherNameGroup, _ = result.Get(row.WatcherName)
		}

		if rows, ok = watcherNameGroup.Get(row.WatchStatus); !ok {
			watcherNameGroup.Set(row.WatchStatus, []models.ShowGroupedByStatusAndWatchers{})
			rows = []models.ShowGroupedByStatusAndWatchers{}
		}

		item := models.ShowGroupedByStatusAndWatchers{
			ShowID:        row.ShowID,
			ShowName:      row.ShowName,
			NumSeasons:    row.NumSeasons,
			PlatformName:  row.PlatformName,
			PlatformIcon:  row.PlatformIcon,
			Cancelled:     row.Cancelled,
			WatchStatus:   row.WatchStatus,
			CurrentSeason: row.CurrentSeason,
			WatcherName:   row.WatcherName,
			PosterImage:   row.PosterImage,
		}

		if row.DateCancelled.Valid {
			item.DateCancelled = &row.DateCancelled.Time
		}

		if row.FinishedAt.Valid {
			item.FinishedAt = &row.FinishedAt.Time
		}

		rows = append(rows, item)
		watcherNameGroup.Set(row.WatchStatus, rows)
	}

	return result, nil
}

func (s ShowService) GetFinishedShows(accountID int) ([]querymodels.Shows, error) {
	var (
		err    error
		result = []querymodels.Shows{}
	)

	query := `
SELECT
	s.id AS show_id
	, s.name AS show_name
	, s.num_seasons
	, p.name AS platform_name
	, p.icon AS platform_icon
	, s.cancelled
	, s.date_cancelled
	, ws.status AS watch_status
	, ss.current_season
	, ss.finished_at
	, string_agg(w.name, ', ' ORDER BY w.name) AS watcher_name
FROM watch_status AS ws
	INNER JOIN show_status AS ss ON ss.watch_status_id=ws.id
	LEFT JOIN shows AS s ON s.id=ss.show_id
	LEFT JOIN platforms AS p ON  p.id=s.platform_id
	INNER JOIN watchers_to_show_statuses AS wtss ON wtss.show_status_id=ss.id
	INNER JOIN watchers AS w ON w.id=wtss.watcher_id
WHERE 1=1
	AND ss.account_id = $1
	AND ss.watch_status_id IN (3)
GROUP BY 
	s.id, p.name, p.icon, ws.status, ss.current_season, 
	ss.finished_at, ss.watch_status_id
ORDER BY 
	s.name ASC
	`

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &result, query, accountID); err != nil {
		if pgxscan.NotFound(err) {
			return result, nil
		}

		return result, fmt.Errorf("error fetching active grouped shows: %w", err)
	}

	return result, nil
}

func (s ShowService) GetShowByID(accountID, showID int) (*models.ShowForEdit, error) {
	var (
		err    error
		result models.ShowForEdit
	)

	ctx, cancel := s.GetContext()
	defer cancel()

	query := `
SELECT
	s.id
	, s.name
	, s.num_seasons
	, s.platform_id
	, array_agg(wtss.watcher_id) as watcher_ids
	, ss.finished_at
	, s.cancelled
	, s.date_cancelled
	, coalesce(s.poster_image, '') as poster_image
FROM shows s
	INNER JOIN show_status ss ON ss.show_id = s.id
	INNER JOIN watchers_to_show_statuses wtss ON wtss.show_status_id = ss.id
WHERE s.account_id = $1
	AND s.id = $2
GROUP BY s.id, s.name, s.num_seasons, s.platform_id, ss.finished_at, s.cancelled, s.date_cancelled, s.poster_image
	`

	if err = pgxscan.Get(ctx, s.DB, &result, query, accountID, showID); err != nil {
		if pgxscan.NotFound(err) {
			return nil, ErrShowNotFound
		}
		return nil, fmt.Errorf("error fetching show by ID: %w", err)
	}

	return &result, nil
}

func (s ShowService) OnlineSearch(searchTerm, country string) ([]models.OnlineShowSearchResult, error) {
	var (
		err           error
		response      tvmaze.SearchResults
		httpResult    rest.HttpResult
		result        []models.OnlineShowSearchResult
		unmarshallErr *json.UnmarshalTypeError
	)

	m := &sync.Mutex{}

	response, httpResult, err = rest.Get[tvmaze.SearchResults](
		s.restClientOptions,
		"/search/shows",
		calloptions.WithQueryParams(map[string]string{
			"q": searchTerm,
		}),
	)

	if err != nil {
		if errors.As(err, &unmarshallErr) {
			slog.Info("no results found", "searchTerm", searchTerm, "country", country, "body", httpResult.Body)
			return result, nil
		}

		slog.Error("error fetching online search results", "statusCode", httpResult.StatusCode, "body", httpResult.Body)
		return result, fmt.Errorf("error fetching online search results: %w", err)
	}

	pool := pond.NewPool(3)

	for _, show := range response {
		pool.Submit(func() {
			seasonsResponse, _, err := rest.Get[tvmaze.Seasons](
				s.restClientOptions,
				"/shows/"+strconv.Itoa(show.Show.ID)+"/seasons",
			)

			if err != nil {
				slog.Error("error fetching seasons", "showID", show.Show.ID, "error", err)
			}

			n := models.OnlineShowSearchResult{
				ImageURLs:        []string{},
				ImdbLink:         "",
				Name:             show.Show.Name,
				NumSeasons:       len(seasonsResponse),
				Platforms:        []models.Platform{},
				RawPlatformNames: []string{},
				Weight:           show.Show.Weight,
			}

			slog.Debug("found online show", "name", show.Show.Name, "platforms", n.RawPlatformNames)

			// Images
			if show.Show.Image != nil {
				if show.Show.Image.Medium != "" {
					n.ImageURLs = append(n.ImageURLs, show.Show.Image.Medium)
				}

				if show.Show.Image.Original != "" {
					n.ImageURLs = append(n.ImageURLs, show.Show.Image.Original)
				}
			}

			// Lookup matching platforms from our database
			if show.Show.Network != nil || show.Show.WebChannel != nil {
				if show.Show.WebChannel != nil {
					n.RawPlatformNames = append(n.RawPlatformNames, show.Show.WebChannel.Name)
				}

				if show.Show.Network != nil {
					n.RawPlatformNames = append(n.RawPlatformNames, show.Show.Network.Name)
				}

				lowerNetwork := strings.ToLower(n.RawPlatformNames[0])

				if platforms, lookupErr := s.lookupPlatformsByExternalNames([]string{lowerNetwork}, "tvmaze"); lookupErr != nil {
					slog.Error("error looking up platforms", "error", lookupErr, "externalNames", lowerNetwork)
				} else {
					n.Platforms = platforms
				}
			}

			// IMDB
			if show.Show.Externals.IMDB != nil && *show.Show.Externals.IMDB != "" {
				n.ImdbLink = "https://www.imdb.com/title/" + *show.Show.Externals.IMDB
			}

			m.Lock()
			result = append(result, n)
			m.Unlock()
		})
	}

	pool.StopAndWait()

	// Sort by weight
	sort.Slice(result, func(i, j int) bool {
		return result[i].Weight > result[j].Weight
	})

	return result, nil
}

func (s ShowService) FindShowImageByName(showName string) (string, error) {
	var (
		err        error
		response   tvmaze.Show
		httpResult rest.HttpResult
	)

	response, httpResult, err = rest.Get[tvmaze.Show](
		s.restClientOptions,
		"/singlesearch/shows",
		calloptions.WithQueryParams(map[string]string{
			"q": showName,
		}),
	)

	if err != nil {
		slog.Error("error fetching show image from TVMaze", "statusCode", httpResult.StatusCode, "body", httpResult.Body, "showName", showName)
		return "", fmt.Errorf("error fetching show image: %w", err)
	}

	if response.Image != nil && response.Image.Medium != "" {
		return response.Image.Medium, nil
	}

	return "", nil
}

func (s ShowService) lookupPlatformsByExternalNames(externalNames []string, source string) ([]models.Platform, error) {
	var (
		err       error
		platforms []models.Platform
	)

	if len(externalNames) == 0 {
		return platforms, nil
	}

	ctx, cancel := s.GetContext()
	defer cancel()

	query := `
SELECT DISTINCT p.id, p.created_at, p.updated_at, p.name, p.icon
FROM platforms p
INNER JOIN platform_aliases pa ON pa.platform_id = p.id
WHERE LOWER(pa.external_name) = ANY($1) AND pa.source = $2
ORDER BY p.name
	`

	if err = pgxscan.Select(ctx, s.DB, &platforms, query, externalNames, source); err != nil {
		if pgxscan.NotFound(err) {
			return platforms, nil
		}
		return platforms, fmt.Errorf("error looking up platforms by external names: %w", err)
	}

	return platforms, nil
}

func (s ShowService) UpdateShow(accountID int, req requesttypes.EditShowRequest) error {
	var (
		err error
	)

	ctx, cancel := s.GetContext()
	defer cancel()

	// Begin transaction
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}

	defer tx.Rollback(ctx)

	// Update the show
	updateShowQuery := `
UPDATE shows
SET name = $1, num_seasons = $2, platform_id = $3, poster_image = $4, updated_at = NOW() AT TIME ZONE 'UTC'
WHERE id = $5 AND account_id = $6
	`

	result, err := tx.Exec(ctx, updateShowQuery, req.Name, req.TotalSeasons, req.PlatformID, req.PosterImage, req.ID, accountID)
	if err != nil {
		return fmt.Errorf("error updating show: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrShowNotFound
	}

	if len(req.WatcherIDs) > 0 {
		// Delete existing watcher links
		deleteWatchersQuery := `
DELETE FROM watchers_to_show_statuses 
WHERE show_status_id = (SELECT id FROM show_status WHERE show_id = $1 AND account_id = $2)
	`

		if _, err = tx.Exec(ctx, deleteWatchersQuery, req.ID, accountID); err != nil {
			return fmt.Errorf("error deleting existing watcher links: %w", err)
		}

		// Add new watcher links
		for _, watcherID := range req.WatcherIDs {
			insertWatcherLinkQuery := `
INSERT INTO watchers_to_show_statuses (watcher_id, show_status_id)
VALUES ($1, (SELECT id FROM show_status WHERE show_id = $2 AND account_id = $3))
		`

			if _, err = tx.Exec(ctx, insertWatcherLinkQuery, watcherID, req.ID, accountID); err != nil {
				return fmt.Errorf("error linking watcher to show: %w", err)
			}
		}
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("error committing transaction: %w", err)
	}

	return nil
}

func (s ShowService) SearchShows(accountID int, options ...SearchShowsOption) ([]querymodels.Shows, int, error) {
	var (
		err    error
		result = []querymodels.Shows{}
	)

	opts := &SearchShowsOptions{
		Page:     1,
		ShowName: "",
		Platform: 0,
	}

	for _, opt := range options {
		opt(opts)
	}

	if opts.Page < 1 {
		opts.Page = 1
	}

	offset := s.Paging(opts.Page)

	args := []any{
		accountID,
	}

	query := `
WITH matches AS (
	SELECT
		s.id AS show_id
		, s.name AS show_name
		, s.num_seasons
		, p.name AS platform_name
		, p.icon AS platform_icon
		, s.cancelled
		, s.date_cancelled
		, ws.status AS watch_status
		, ss.current_season
		, ss.finished_at
		, string_agg(w.name, ', ' ORDER BY w.name) AS watcher_name
		, coalesce(s.poster_image, '') AS poster_image
	FROM watch_status AS ws
		INNER JOIN show_status AS ss ON ss.watch_status_id=ws.id
		LEFT JOIN shows AS s ON s.id=ss.show_id
		LEFT JOIN platforms AS p ON  p.id=s.platform_id
		INNER JOIN watchers_to_show_statuses AS wtss ON wtss.show_status_id=ss.id
		INNER JOIN watchers AS w ON w.id=wtss.watcher_id
	WHERE 1=1
		AND ss.account_id = $1
	`

	parameterIndex := 1

	if opts.ShowName != "" {
		parameterIndex++
		query += fmt.Sprintf(` AND s.name ILIKE $%d `, parameterIndex)
		args = append(args, "%"+opts.ShowName+"%")
	}

	if opts.Platform != 0 {
		parameterIndex++
		query += fmt.Sprintf(` AND p.id = $%d `, parameterIndex)
		args = append(args, opts.Platform)
	}

	query += `
	GROUP BY 
		s.id, p.name, p.icon, ws.status, ss.current_season,
		ss.finished_at, ss.watch_status_id, s.poster_image
	ORDER BY 
		s.name ASC
)
SELECT
	*
	, (SELECT COUNT(show_id) FROM matches) AS total_count
FROM matches
`

	parameterIndex++

	query += fmt.Sprintf(` OFFSET $%d LIMIT $%d `, parameterIndex, parameterIndex+1)

	args = append(args, offset, s.PageSize)

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &result, query, args...); err != nil {
		if pgxscan.NotFound(err) {
			return result, 0, nil
		}

		return result, 0, fmt.Errorf("error fetching searched shows: %w", err)
	}

	totalCount := 0

	if len(result) > 0 {
		totalCount = result[0].TotalCount
	}

	return result, totalCount, nil
}

func (s ShowService) StartWatching(accountID, showID int) error {
	var (
		err           error
		currentSeason int
	)

	ctx, cancel := s.GetContext()
	defer cancel()

	// Check if show exists and get current season
	checkQuery := `
SELECT ss.current_season
FROM show_status ss
INNER JOIN shows s ON s.id = ss.show_id
WHERE ss.show_id = $1
	`

	if err = pgxscan.Get(ctx, s.DB, &currentSeason, checkQuery, showID); err != nil {
		if pgxscan.NotFound(err) {
			return ErrShowNotFound
		}
		return fmt.Errorf("error checking show status: %w", err)
	}

	// Determine the season to set based on current season
	var newSeason int
	if currentSeason == 0 {
		newSeason = 1
	} else {
		newSeason = currentSeason
	}

	// Update the show status to "Watching" (watch_status_id = 2) and set appropriate season
	updateQuery := `
UPDATE show_status 
SET watch_status_id = 2, current_season = $2
WHERE show_id = $1
	`

	if _, err = s.DB.Exec(ctx, updateQuery, showID, newSeason); err != nil {
		return fmt.Errorf("error updating show to watching status: %w", err)
	}

	return nil
}

func (s ShowService) DeleteShow(accountID, showID int) error {
	var (
		err           error
		currentSeason int
	)

	ctx, cancel := s.GetContext()
	defer cancel()

	// Check if show exists and has watched seasons
	checkQuery := `
SELECT ss.current_season
FROM show_status ss
INNER JOIN shows s ON s.id = ss.show_id
WHERE ss.show_id = $1 AND ss.account_id = $2
	`

	if err = pgxscan.Get(ctx, s.DB, &currentSeason, checkQuery, showID, accountID); err != nil {
		if pgxscan.NotFound(err) {
			return ErrShowNotFound
		}
		return fmt.Errorf("error checking show status: %w", err)
	}

	// If show has watched seasons (current_season > 0), it cannot be deleted
	if currentSeason > 0 {
		return ErrShowHasWatchedSeasons
	}

	// Begin transaction
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}

	defer tx.Rollback(ctx)

	// Delete watchers_to_show_statuses first (foreign key constraint)
	deleteWatchersQuery := `
DELETE FROM watchers_to_show_statuses 
WHERE show_status_id = (SELECT id FROM show_status WHERE show_id = $1 AND account_id = $2)
	`

	if _, err = tx.Exec(ctx, deleteWatchersQuery, showID, accountID); err != nil {
		return fmt.Errorf("error deleting watcher links: %w", err)
	}

	// Delete show_status
	deleteShowStatusQuery := `
DELETE FROM show_status 
WHERE show_id = $1 AND account_id = $2
	`

	if _, err = tx.Exec(ctx, deleteShowStatusQuery, showID, accountID); err != nil {
		return fmt.Errorf("error deleting show status: %w", err)
	}

	// Delete the show
	deleteShowQuery := `
DELETE FROM shows 
WHERE id = $1 AND account_id = $2
	`

	result, err := tx.Exec(ctx, deleteShowQuery, showID, accountID)
	if err != nil {
		return fmt.Errorf("error deleting show: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrShowNotFound
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("error committing transaction: %w", err)
	}

	return nil
}
