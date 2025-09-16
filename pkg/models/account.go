package models

type Account struct {
	ID        `db:"account_id"`
	Owner     int    `json:"owner" db:"account_owner"`
	JoinToken string `json:"joinToken" db:"join_token"`
}

type CreateAccountRequest struct {
	UserID int `json:"userID"`
}
