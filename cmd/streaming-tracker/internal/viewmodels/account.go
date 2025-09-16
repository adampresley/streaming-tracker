package viewmodels

type AccountSignUp struct {
	BaseViewModel

	Email       string
	Password    string
	AccountCode string
}

type AccountVerify struct {
	BaseViewModel

	ActivationCode string
	JoinToken      string
}

type AccountSignUpSuccess struct {
	BaseViewModel

	Email          string
	HasAccountCode bool
}
