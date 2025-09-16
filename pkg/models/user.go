package models

import "time"

type User struct {
	ID
	Created
	Active         bool     `json:"active"`
	Email          string   `json:"email"`
	Password       string   `json:"-"`
	AuthToken      string   `json:"authToken"`
	Account        *Account `json:"account,omitempty"`
	ActivationCode string   `json:"activationCode,omitempty"`
}

type CreateUserRequest struct {
	Email    string
	Password string
}

type UserQueryResult struct {
	ID               int       `db:"id"`
	CreatedAt        time.Time `db:"created_at"`
	Active           bool      `db:"active"`
	Email            string    `db:"email"`
	Password         string    `db:"password"`
	AuthToken        string    `db:"auth_token"`
	AccountID        *int      `db:"account_id"`
	AccountOwner     *int      `db:"account_owner"`
	AccountJoinToken *string   `db:"join_token"`
	ActivationCode   string    `db:"activation_code"`
}

type AuthenticationResponse struct {
	User  *User  `json:"user"`
	Token string `json:"token"`
}
