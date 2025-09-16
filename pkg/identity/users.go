package identity

import (
	"errors"
	"fmt"
	"time"

	"github.com/adampresley/adamgokit/random"
	"github.com/adampresley/streaming-tracker/pkg/models"
	"github.com/adampresley/streaming-tracker/pkg/services"
	"github.com/georgysavva/scany/v2/pgxscan"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserNotFound           = errors.New("user not found")
	ErrUserAlreadyExists      = errors.New("user already exists")
	ErrActivationCodeNotFound = errors.New("activation code not found")
)

type UserServicer interface {
	/*
	   Attempts to activate a user account using an activation code.
	   Calling this will mark the user as active and removes the activation code.
	*/
	ActivateUser(activationCode string) error

	/*
	   Associates a user with an account.
	*/
	AddUserToAccount(userID, accountID int) error

	/*
	   CreateUser creates a new user account. The user is not automatically
	   associated with an account, and it is initially inactive.
	*/
	CreateUser(user models.CreateUserRequest) (*models.User, error)

	/*
	   GetUserByActivationCode retrieves a user account by their activation code.
	*/
	GetUserByActivationCode(activationCode string) (*models.User, error)

	/*
	   GetUserByEmail retrieves an active user account by their email address.
	*/
	GetUserByEmail(email string, options ...UserQueryOption) (*models.User, error)

	/*
	   GetUserByIdAndAuthToken retrieves an active user account by their user ID and auth token.
	*/
	GetUserByIdAndAuthToken(id int, authToken string, options ...UserQueryOption) (*models.User, error)
}

type UserServiceConfig struct {
	services.DbServiceBaseConfig
}

type UserService struct {
	services.DbServiceBase
}

func NewUserService(config UserServiceConfig) UserService {
	return UserService{
		DbServiceBase: services.DbServiceBase{
			QueryTimeout: config.QueryTimeout,
			DB:           config.DB,
		},
	}
}

/*
Attempts to activate a user account using an activation code.
Calling this will mark the user as active and removes the activation code.
*/
func (s UserService) ActivateUser(activationCode string) error {
	var (
		err    error
		result pgconn.CommandTag
	)

	query := `UPDATE users SET active=true, activation_code=NULL WHERE activation_code=$1`
	args := []any{activationCode}

	ctx, cancel := s.GetContext()
	defer cancel()

	result, err = s.DB.Exec(ctx, query, args...)

	if result.RowsAffected() == 0 {
		return ErrActivationCodeNotFound
	}

	return err
}

/*
Associates a user with an account.
*/
func (s UserService) AddUserToAccount(userID, accountID int) error {
	var (
		err error
	)

	query := `
UPDATE users SET
	account_id=$1
WHERE id=$2
	`

	args := []any{accountID, userID}

	ctx, cancel := s.GetContext()
	defer cancel()

	if _, err = s.DB.Exec(ctx, query, args...); err != nil {
		return fmt.Errorf("error updating user account: %w", err)
	}

	return nil
}

/*
CreateUser creates a new user account. The user is not automatically
associated with an account, and it is initially inactive.
*/
func (s UserService) CreateUser(user models.CreateUserRequest) (*models.User, error) {
	var (
		err           error
		passwordBytes []byte
		newUserID     int64
	)

	query := `
INSERT INTO users (
	created_at
	, active
	, email
	, password
	, auth_token
	, activation_code
) VALUES (
	$1
	, $2
	, $3
	, $4
	, $5
	, $6
)
RETURNING id
	`

	createdAt := time.Now().UTC()
	authToken := random.String(20)
	activationCode := random.String(6)

	if passwordBytes, err = bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost); err != nil {
		return nil, fmt.Errorf("error hashing password: %w", err)
	}

	hashedPassword := string(passwordBytes)

	args := []any{
		createdAt,
		false,
		user.Email,
		hashedPassword,
		authToken,
		activationCode,
	}

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = s.DB.QueryRow(ctx, query, args...).Scan(&newUserID); err != nil {
		if s.IsDuplicateRecordError(err) {
			return nil, ErrUserAlreadyExists
		}

		return nil, fmt.Errorf("error creating user: %w", err)
	}

	newUser := &models.User{
		ID:             models.ID{ID: int(newUserID)},
		Created:        models.Created{CreatedAt: createdAt},
		Active:         false,
		Email:          user.Email,
		Password:       "",
		AuthToken:      authToken,
		ActivationCode: activationCode,
		Account:        nil,
	}

	return newUser, nil
}

/*
GetUserByEmail retrieves an active user account by their email address.
*/
func (s UserService) GetUserByEmail(email string, options ...UserQueryOption) (*models.User, error) {
	var (
		err     error
		results []models.UserQueryResult
	)

	query := `
SELECT 
	u.id
	, u.created_at
	, u.active
	, u.email
	, u.password
	, u.auth_token
	, a.id as account_id
	, a.owner as account_owner
	, a.join_token
FROM users u
	LEFT JOIN accounts a ON u.id = a.owner
WHERE 1=1
	AND u.email = $1 
`

	opts := &UserQueryOptions{}

	for _, option := range options {
		option(opts)
	}

	/*
	 * Apply options to the query
	 */
	if opts.OnlyActive {
		query += " AND u.active = true "
	}

	/*
	 * Run the query
	 */
	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &results, query, email); err != nil {
		if pgxscan.NotFound(err) {
			return nil, ErrUserNotFound
		}

		return nil, fmt.Errorf("error querying user by email: %w", err)
	}

	if len(results) == 0 {
		return nil, ErrUserNotFound
	}

	result := results[0]

	user := &models.User{
		ID:        models.ID{ID: result.ID},
		Created:   models.Created{CreatedAt: result.CreatedAt},
		Active:    result.Active,
		Email:     result.Email,
		Password:  result.Password,
		AuthToken: result.AuthToken,
		Account:   nil,
	}

	if result.AccountID != nil && result.AccountOwner != nil {
		user.Account = &models.Account{
			ID:    models.ID{ID: *result.AccountID},
			Owner: *result.AccountOwner,
		}

		if result.AccountJoinToken != nil {
			user.Account.JoinToken = *result.AccountJoinToken
		}
	}

	return user, nil
}

/*
GetUserByIdAndAuthToken retrieves an active user account by their user ID and auth token.
*/
func (s UserService) GetUserByIdAndAuthToken(id int, authToken string, options ...UserQueryOption) (*models.User, error) {
	var (
		err     error
		results []models.UserQueryResult
	)

	query := `
SELECT 
	u.id,
	u.created_at,
	u.active,
	u.email,
	u.password,
	u.auth_token,
	a.id as account_id,
	a.owner as account_owner
FROM users u
LEFT JOIN accounts a ON u.id = a.owner
WHERE 1=1
	AND u.id=$1
	AND u.auth_token=$2
`

	opts := &UserQueryOptions{}

	for _, option := range options {
		option(opts)
	}

	/*
	 * Apply options to the query
	 */
	if opts.OnlyActive {
		query += " AND u.active = true "
	}

	args := []any{id, authToken}

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &results, query, args...); err != nil {
		if pgxscan.NotFound(err) {
			return nil, ErrUserNotFound
		}

		return nil, fmt.Errorf("error querying user by id and auth token: %w", err)
	}

	if len(results) == 0 {
		return nil, ErrUserNotFound
	}

	result := results[0]

	user := &models.User{
		ID:        models.ID{ID: result.ID},
		Created:   models.Created{CreatedAt: result.CreatedAt},
		Active:    result.Active,
		Email:     result.Email,
		Password:  result.Password,
		AuthToken: result.AuthToken,
		Account:   nil,
	}

	if result.AccountID != nil && result.AccountOwner != nil {
		user.Account = &models.Account{
			ID:    models.ID{ID: *result.AccountID},
			Owner: *result.AccountOwner,
		}
	}

	return user, nil
}

/*
GetUserByActivationCode retrieves a user account by their activation code.
*/
func (s UserService) GetUserByActivationCode(activationCode string) (*models.User, error) {
	var (
		err     error
		results []models.UserQueryResult
	)

	query := `
SELECT 
	u.id
	, u.created_at
	, u.active
	, u.email
	, u.password
	, u.auth_token
	, u.activation_code
	, a.id as account_id
	, a.owner as account_owner
	, a.join_token
FROM users u
	LEFT JOIN accounts a ON u.account_id = a.id
WHERE u.activation_code = $1
	`

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &results, query, activationCode); err != nil {
		if pgxscan.NotFound(err) {
			return nil, ErrUserNotFound
		}

		return nil, fmt.Errorf("error querying user by activation code: %w", err)
	}

	if len(results) == 0 {
		return nil, ErrUserNotFound
	}

	result := results[0]

	user := &models.User{
		ID:             models.ID{ID: result.ID},
		Created:        models.Created{CreatedAt: result.CreatedAt},
		Active:         result.Active,
		Email:          result.Email,
		Password:       result.Password,
		AuthToken:      result.AuthToken,
		ActivationCode: result.ActivationCode,
		Account:        nil,
	}

	if result.AccountID != nil && result.AccountOwner != nil {
		user.Account = &models.Account{
			ID:    models.ID{ID: *result.AccountID},
			Owner: *result.AccountOwner,
		}

		if result.AccountJoinToken != nil {
			user.Account.JoinToken = *result.AccountJoinToken
		}
	}

	return user, nil
}
