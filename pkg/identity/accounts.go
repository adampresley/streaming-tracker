package identity

import (
	"context"
	"fmt"

	"github.com/adampresley/adamgokit/random"
	"github.com/adampresley/streaming-tracker/pkg/models"
	"github.com/adampresley/streaming-tracker/pkg/services"
	"github.com/georgysavva/scany/v2/pgxscan"
	"github.com/jackc/pgx/v5"
)

type AccountServicer interface {
	/*
	   CreateAccount creates a new account owned by the given user ID.
	*/
	CreateAccount(account models.CreateAccountRequest, options ...CreateAccountOption) (*models.Account, error)

	/*
	   GetAccountByJoinToken retrieves an account by its join token.
	*/
	GetAccountByJoinToken(joinToken string) (*models.Account, error)
}

type AccountServiceConfig struct {
	services.DbServiceBase
}

type AccountService struct {
	services.DbServiceBase
}

func NewAccountService(config AccountServiceConfig) AccountService {
	return AccountService{
		DbServiceBase: services.DbServiceBase{
			QueryTimeout: config.QueryTimeout,
			DB:           config.DB,
		},
	}
}

/*
CreateAccount creates a new account owned by the given user ID.
*/
func (s AccountService) CreateAccount(account models.CreateAccountRequest, options ...CreateAccountOption) (*models.Account, error) {
	var (
		err       error
		accountID int64
		tx        pgx.Tx
		query     string
	)

	opts := &CreateAccountOptions{}

	for _, option := range options {
		option(opts)
	}

	defer func() {
		if err != nil && tx != nil {
			_ = tx.Rollback(context.Background())
		}
	}()

	ctx, cancel := s.GetContext()
	defer cancel()

	if tx, err = s.DB.Begin(ctx); err != nil {
		return nil, fmt.Errorf("error starting transaction: %w", err)
	}

	/*
	 * First, create the account
	 */
	query = `
INSERT INTO accounts (
	owner
	, join_token
) VALUES (
	$1
	, $2
)
RETURNING id
`

	joinToken := random.String(6)

	args := []any{
		account.UserID,
		joinToken,
	}

	if err = tx.QueryRow(ctx, query, args...).Scan(&accountID); err != nil {
		return nil, fmt.Errorf("error executing create query: %w", err)
	}

	newAccount := &models.Account{
		ID:        models.ID{ID: int(accountID)},
		Owner:     account.UserID,
		JoinToken: joinToken,
	}

	/*
	 * Now associate the account to the user if requested
	 */
	if opts.AssociateToUser > 0 {
		query = `UPDATE users SET account_id = $1 WHERE id = $2`
		args = []any{newAccount.ID.ID, opts.AssociateToUser}

		if _, err = tx.Exec(ctx, query, args...); err != nil {
			return nil, fmt.Errorf("error associating account to user: %w", err)
		}
	}

	return newAccount, tx.Commit(ctx)
}

/*
GetAccountByJoinToken retrieves an account by its join token.
*/
func (s AccountService) GetAccountByJoinToken(joinToken string) (*models.Account, error) {
	var (
		err     error
		results []models.Account
	)

	query := `
SELECT 
	id,
	owner,
	join_token
FROM accounts
WHERE join_token = $1
	`

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &results, query, joinToken); err != nil {
		if pgxscan.NotFound(err) {
			return nil, fmt.Errorf("account not found with join token: %s", joinToken)
		}
		return nil, fmt.Errorf("error querying account by join token: %w", err)
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("account not found with join token: %s", joinToken)
	}

	return &results[0], nil
}
