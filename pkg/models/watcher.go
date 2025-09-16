package models

type Watcher struct {
	ID
	User *User  `json:"user"`
	Name string `json:"name"`
}

type QueryWatcher struct {
	ID
	UserID    int
	UserEmail string
	Name      string
}

type WatcherWithUserInfo struct {
	ID            int    `db:"id"`
	UserID        int    `db:"user_id"`
	UserEmail     string `db:"user_email"`
	Name          string `db:"name"`
	IsOwner       bool   `db:"is_owner"`
	CurrentUserID int    `db:"current_user_id"`
}

type CreateWatcherRequest struct {
	Name      string `json:"name"`
	AccountID int    `json:"accountID"`
}
