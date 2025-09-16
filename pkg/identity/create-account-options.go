package identity

type CreateAccountOption func(cao *CreateAccountOptions)

type CreateAccountOptions struct {
	AssociateToUser int
}

func AssociateToUser(userID int) CreateAccountOption {
	return func(cao *CreateAccountOptions) {
		cao.AssociateToUser = userID
	}
}
