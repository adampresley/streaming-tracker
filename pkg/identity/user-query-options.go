package identity

type UserQueryOption func(uqo *UserQueryOptions)

type UserQueryOptions struct {
	OnlyActive bool
}

func WithOnlyActiveUsers(onlyActive bool) UserQueryOption {
	return func(uqo *UserQueryOptions) {
		uqo.OnlyActive = onlyActive
	}
}
