package watchers

import (
	"fmt"

	"github.com/adampresley/streaming-tracker/pkg/models"
	"github.com/adampresley/streaming-tracker/pkg/services"
	"github.com/georgysavva/scany/v2/pgxscan"
)

type WatcherServicer interface {
	/*
	   CreateWatcher creates a new watcher record for a user.
	*/
	CreateWatcher(user *models.User) (*models.Watcher, error)

	/*
		CreateWatcherManual creates a new watcher record without a user association.
	*/
	CreateWatcherManual(accountID int, name string) (*models.Watcher, error)

	/*
		GetWatchers retrieves all watchers for a given account.
	*/
	GetWatchers(accountID int) ([]*models.Watcher, error)

	/*
		GetWatchersWithUserInfo retrieves watchers with user information and owner status.
	*/
	GetWatchersWithUserInfo(accountID, currentUserID int) ([]*models.WatcherWithUserInfo, error)

	/*
		UpdateWatcherName updates a watcher's name with permission validation.
	*/
	UpdateWatcherName(watcherID, accountID, currentUserID int, name string) error
}

type WatcherServiceConfig struct {
	services.DbServiceBaseConfig
}

type WatcherService struct {
	services.DbServiceBase
}

func NewWatcherService(config WatcherServiceConfig) WatcherService {
	return WatcherService{
		DbServiceBase: services.DbServiceBase{
			QueryTimeout: config.QueryTimeout,
			DB:           config.DB,
		},
	}
}

/*
CreateWatcher creates a new watcher record for a user.
*/
func (s WatcherService) CreateWatcher(user *models.User) (*models.Watcher, error) {
	var (
		err          error
		newWatcherID int64
	)

	query := `
INSERT INTO watchers (
	user_id
	, name
	, account_id
) VALUES (
	$1
	, $2
	, $3
)
RETURNING id
	`

	args := []any{
		user.ID.ID,
		user.Email,
		user.Account.ID.ID,
	}

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Get(ctx, s.DB, &newWatcherID, query, args...); err != nil {
		return nil, fmt.Errorf("error creating watcher: %w", err)
	}

	newWatcher := &models.Watcher{
		ID:   models.ID{ID: int(newWatcherID)},
		User: user,
		Name: user.Email,
	}

	return newWatcher, nil
}

func (s WatcherService) GetWatchers(accountID int) ([]*models.Watcher, error) {
	var (
		err          error
		queryResults []*models.QueryWatcher
		results      []*models.Watcher
	)

	query := `
SELECT
	w.id
	, coalesce(w.user_id, 0) AS user_id
	, coalesce(u.email, '') AS user_email
	, w.name
FROM watchers AS w
LEFT JOIN users AS u ON w.user_id = u.id
WHERE 1=1
	AND w.account_id = $1
ORDER BY w.name ASC
	`

	args := []any{accountID}

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &queryResults, query, args...); err != nil {
		return results, fmt.Errorf("error fetching watchers: %w", err)
	}

	for _, qr := range queryResults {
		newWatcher := &models.Watcher{
			ID: qr.ID,
			User: &models.User{
				ID:    models.ID{ID: qr.UserID},
				Email: qr.UserEmail,
			},
			Name: qr.Name,
		}

		results = append(results, newWatcher)
	}

	return results, nil
}

/*
CreateWatcherManual creates a new watcher record without a user association.
*/
func (s WatcherService) CreateWatcherManual(accountID int, name string) (*models.Watcher, error) {
	var (
		err          error
		newWatcherID int64
	)

	query := `
INSERT INTO watchers (
	user_id
	, name
	, account_id
) VALUES (
	NULL
	, $1
	, $2
)
RETURNING id
	`

	args := []any{
		name,
		accountID,
	}

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Get(ctx, s.DB, &newWatcherID, query, args...); err != nil {
		return nil, fmt.Errorf("error creating manual watcher: %w", err)
	}

	newWatcher := &models.Watcher{
		ID:   models.ID{ID: int(newWatcherID)},
		User: nil,
		Name: name,
	}

	return newWatcher, nil
}

/*
GetWatchersWithUserInfo retrieves watchers with user information and owner status.
*/
func (s WatcherService) GetWatchersWithUserInfo(accountID, currentUserID int) ([]*models.WatcherWithUserInfo, error) {
	var (
		err     error
		results []*models.WatcherWithUserInfo
	)

	query := `
SELECT
	w.id
	, coalesce(w.user_id, 0) as user_id
	, coalesce(u.email, '') AS user_email
	, w.name
	, CASE WHEN u.id = a.owner THEN true ELSE false END AS is_owner
	, ` + fmt.Sprintf("%d", currentUserID) + ` AS current_user_id
FROM watchers AS w
	LEFT JOIN users AS u ON w.user_id = u.id
	LEFT JOIN accounts AS a ON w.account_id = a.id
WHERE w.account_id = $1
ORDER BY
	CASE WHEN u.id = a.owner THEN 0 ELSE 1 END,
	w.name ASC
	`

	args := []any{accountID}

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &results, query, args...); err != nil {
		return results, fmt.Errorf("error fetching watchers with user info: %w", err)
	}

	return results, nil
}

/*
UpdateWatcherName updates a watcher's name with permission validation.
Rules:
- Account owners can edit any watcher without a user_id (manual watchers)
- Any user can edit their own watcher name
- Users cannot edit other users' watcher names
*/
func (s WatcherService) UpdateWatcherName(watcherID, accountID, currentUserID int, name string) error {
	var (
		err           error
		targetWatcher models.WatcherWithUserInfo
	)

	// First, get the watcher info to validate permissions
	checkQuery := `
SELECT
	w.id
	, coalesce(w.user_id, 0) as user_id
	, coalesce(u.email, '') AS user_email
	, w.name
	, CASE WHEN u.id = a.owner THEN true ELSE false END AS is_owner
	, ` + fmt.Sprintf("%d", currentUserID) + ` AS current_user_id
FROM watchers AS w
	LEFT JOIN users AS u ON w.user_id = u.id
	LEFT JOIN accounts AS a ON w.account_id = a.id
WHERE w.id = $1 AND w.account_id = $2
	`

	checkArgs := []any{watcherID, accountID}

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Get(ctx, s.DB, &targetWatcher, checkQuery, checkArgs...); err != nil {
		return fmt.Errorf("error fetching watcher for permission check: %w", err)
	}

	// Check if current user is the account owner
	var isCurrentUserOwner bool
	ownerQuery := `SELECT CASE WHEN owner = $1 THEN true ELSE false END FROM accounts WHERE id = $2`
	if err = pgxscan.Get(ctx, s.DB, &isCurrentUserOwner, ownerQuery, currentUserID, accountID); err != nil {
		return fmt.Errorf("error checking account ownership: %w", err)
	}

	// Validate permissions
	canEdit := false

	// Can edit if it's the current user's own watcher
	if targetWatcher.UserID == currentUserID {
		canEdit = true
	}

	// Can edit if current user is account owner and target watcher has no user account
	if isCurrentUserOwner && targetWatcher.UserID == 0 {
		canEdit = true
	}

	if !canEdit {
		return fmt.Errorf("permission denied: cannot edit this watcher's name")
	}

	// Perform the update
	updateQuery := `
UPDATE watchers
SET name = $1
WHERE id = $2
	AND account_id = $3
	`

	updateArgs := []any{
		name,
		watcherID,
		accountID,
	}

	if _, err = s.DB.Exec(ctx, updateQuery, updateArgs...); err != nil {
		return fmt.Errorf("error updating watcher name: %w", err)
	}

	return nil
}
