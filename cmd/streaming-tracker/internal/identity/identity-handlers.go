package identity

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/adampresley/adamgokit/auth2"
	"github.com/adampresley/adamgokit/email"
	"github.com/adampresley/adamgokit/httphelpers"
	"github.com/adampresley/adamgokit/rendering"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/configuration"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/viewmodels"
	"github.com/adampresley/streaming-tracker/pkg/identity"
	"github.com/adampresley/streaming-tracker/pkg/models"
	"github.com/adampresley/streaming-tracker/pkg/watchers"
	"golang.org/x/crypto/bcrypt"
)

type IdentityHandlers interface {
	AccountSignUpPage(w http.ResponseWriter, r *http.Request)
	AccountSignUpAction(w http.ResponseWriter, r *http.Request)
	AccountSignUpSuccessPage(w http.ResponseWriter, r *http.Request)
	AccountVerifyPage(w http.ResponseWriter, r *http.Request)
	AccountVerifyAction(w http.ResponseWriter, r *http.Request)
	LoginPage(w http.ResponseWriter, r *http.Request)
	LoginAction(w http.ResponseWriter, r *http.Request)
}

type IdentityControllerConfig struct {
	AccountService identity.AccountServicer
	Auth           auth2.Authenticator[*identity.UserSession]
	Config         *configuration.Config
	EmailService   email.MailServicer
	Renderer       rendering.TemplateRenderer
	UserService    identity.UserServicer
	WatcherService watchers.WatcherServicer
}

type IdentityController struct {
	accountService identity.AccountServicer
	auth           auth2.Authenticator[*identity.UserSession]
	config         *configuration.Config
	emailService   email.MailServicer
	renderer       rendering.TemplateRenderer
	userService    identity.UserServicer
	watcherService watchers.WatcherServicer
}

func NewIdentityController(config IdentityControllerConfig) IdentityController {
	return IdentityController{
		accountService: config.AccountService,
		auth:           config.Auth,
		config:         config.Config,
		emailService:   config.EmailService,
		renderer:       config.Renderer,
		userService:    config.UserService,
		watcherService: config.WatcherService,
	}
}

/*
GET /account/sign-up
*/
func (c IdentityController) AccountSignUpPage(w http.ResponseWriter, r *http.Request) {
	pageName := "pages/account/sign-up"

	viewData := viewmodels.AccountSignUp{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx:  httphelpers.IsHtmx(r),
			Message: httphelpers.GetFromRequest[string](r, "message"),
		},
		Email:       "",
		Password:    "",
		AccountCode: "",
	}

	c.renderer.Render(pageName, viewData, w)
}

/*
POST /account/sign-up
*/
func (c IdentityController) AccountSignUpAction(w http.ResponseWriter, r *http.Request) {
	var (
		err  error
		user *models.User
	)

	pageName := "pages/account/sign-up"

	viewData := viewmodels.AccountSignUp{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx:  httphelpers.IsHtmx(r),
			Message: httphelpers.GetFromRequest[string](r, "message"),
		},
		Email:       httphelpers.GetFromRequest[string](r, "email"),
		Password:    strings.TrimSpace(httphelpers.GetFromRequest[string](r, "password")),
		AccountCode: httphelpers.GetFromRequest[string](r, "accountCode"),
	}

	if !email.IsValidEmailAddress(viewData.Email) {
		viewData.Message = "The email address you provided appears to be invalid."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	if len(viewData.Password) < 5 {
		viewData.Message = "The password must be at least 5 characters long."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	/*
	 * Make sure there is no existing user with the same email address.
	 */
	user, err = c.userService.GetUserByEmail(viewData.Email)

	if err != nil && !errors.Is(err, identity.ErrUserNotFound) {
		viewData.Message = "An unexpected error occurred while checking for existing users. Please try again later"
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	if err == nil && user != nil {
		viewData.Message = "An account already exists with that email address."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	/*
	 * Create the user
	 */
	createUserRequest := models.CreateUserRequest{
		Email:    viewData.Email,
		Password: viewData.Password,
	}

	user, err = c.userService.CreateUser(createUserRequest)

	if err != nil {
		viewData.Message = "An unexpected error occurred while creating the user. Please try again later"
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	/*
	 * Send an email verification code to the user's email address
	 */
	verifyLink := fmt.Sprintf("%s/account/verify?code=%s", c.config.TLD, user.ActivationCode)

	if len(viewData.AccountCode) > 0 {
		verifyLink += fmt.Sprintf("&accountCode=%s", viewData.AccountCode)
	}

	mailBody := fmt.Sprintf(`
		<p>Thanks for signing up with Streaming Tracker!</p>
		<p>To verify your account, please click the following link:
		<a href="%s">Verify Account</a>. Then enter the following
		code when prompted: %s</p>
	`,
		verifyLink,
		user.ActivationCode,
	)

	err = c.emailService.Send(email.Mail{
		Body:       mailBody,
		BodyIsHtml: true,
		From:       email.EmailAddress{Email: c.config.EmailFrom},
		Subject:    "Welcome to Streaming Tracker! Activate Your Account",
		To: []email.EmailAddress{
			{
				Email: fmt.Sprintf("%s <%s>", user.Email, user.Email),
			},
		},
	})

	if err != nil {
		slog.Error("Failed to send email verification code", "error", err)
	}

	/*
	 * Redirect to success page
	 */
	redirectURL := fmt.Sprintf("/account/sign-up-success?email=%s", user.Email)
	if len(viewData.AccountCode) > 0 {
		redirectURL += "&hasAccountCode=true"
	}

	http.Redirect(w, r, redirectURL, http.StatusSeeOther)
}

/*
GET /account/sign-up-success
*/
func (c IdentityController) AccountSignUpSuccessPage(w http.ResponseWriter, r *http.Request) {
	pageName := "pages/account/sign-up-success"

	viewData := viewmodels.AccountSignUpSuccess{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx:  httphelpers.IsHtmx(r),
			Message: httphelpers.GetFromRequest[string](r, "message"),
		},
		Email:          httphelpers.GetFromRequest[string](r, "email"),
		HasAccountCode: len(httphelpers.GetFromRequest[string](r, "hasAccountCode")) > 0,
	}

	c.renderer.Render(pageName, viewData, w)
}

/*
GET /login
*/
func (c IdentityController) LoginPage(w http.ResponseWriter, r *http.Request) {
	pageName := "pages/login"

	viewData := viewmodels.Login{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx:  httphelpers.IsHtmx(r),
			Message: httphelpers.GetFromRequest[string](r, "message"),
			JavascriptIncludes: []rendering.JavascriptInclude{
				{Src: "/static/js/pages/login.js", Type: "module"},
			},
		},

		Email:    httphelpers.GetFromRequest[string](r, "email"),
		Password: "",
	}

	c.renderer.Render(pageName, viewData, w)
}

/*
POST /login
*/
func (c IdentityController) LoginAction(w http.ResponseWriter, r *http.Request) {
	var (
		err  error
		user *models.User
	)

	pageName := "pages/login"

	viewData := viewmodels.Login{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx:  httphelpers.IsHtmx(r),
			Message: httphelpers.GetFromRequest[string](r, "message"),
			JavascriptIncludes: []rendering.JavascriptInclude{
				{Src: "/static/js/pages/login.js", Type: "module"},
			},
		},

		Email:    httphelpers.GetFromRequest[string](r, "email"),
		Password: httphelpers.GetFromRequest[string](r, "password"),
	}

	/*
	 * Get the user by email.
	 */
	user, err = c.userService.GetUserByEmail(viewData.Email, identity.WithOnlyActiveUsers(true))

	if err != nil {
		/*
		 * User not found
		 */
		if errors.Is(err, identity.ErrUserNotFound) {
			viewData.Message = "Invalid email address or password"
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}

		/*
		 * An unexpected error
		 */
		slog.Error("an error occurred while retrieving the user", "error", err)
		viewData.Message = "We are sorry, but an unexpected error occurred. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	/*
	 * Validate the password.
	 */
	if err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(viewData.Password)); err != nil {
		viewData.Message = "Invalid email address or password"
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	/*
	 * All is good. Create the session and redirect to the home page
	 */
	sessionValue := &identity.UserSession{
		UserID:    user.ID.ID,
		Email:     user.Email,
		AccountID: user.Account.ID.ID,
	}

	if err = c.auth.SaveSession(w, r, sessionValue); err != nil {
		slog.Error("an error occurred while saving the session", "error", err, "userID", user.ID.ID)
		viewData.Message = "We are sorry, but an unexpected error occurred. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	http.Redirect(w, r, "/", http.StatusSeeOther)
}

/*
GET /account/verify
*/
func (c IdentityController) AccountVerifyPage(w http.ResponseWriter, r *http.Request) {
	pageName := "pages/account/verify"

	viewData := viewmodels.AccountVerify{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx:  httphelpers.IsHtmx(r),
			Message: httphelpers.GetFromRequest[string](r, "message"),
		},
		ActivationCode: httphelpers.GetFromRequest[string](r, "code"),
		JoinToken:      httphelpers.GetFromRequest[string](r, "accountCode"),
	}

	c.renderer.Render(pageName, viewData, w)
}

/*
POST /account/verify
*/
func (c IdentityController) AccountVerifyAction(w http.ResponseWriter, r *http.Request) {
	var (
		err     error
		user    *models.User
		account *models.Account
	)

	pageName := "pages/account/verify"

	viewData := viewmodels.AccountVerify{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx:  httphelpers.IsHtmx(r),
			Message: httphelpers.GetFromRequest[string](r, "message"),
		},
		ActivationCode: strings.TrimSpace(httphelpers.GetFromRequest[string](r, "code")),
		JoinToken:      strings.TrimSpace(httphelpers.GetFromRequest[string](r, "accountCode")),
	}

	if len(viewData.ActivationCode) == 0 {
		viewData.Message = "Activation code is required."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	/*
	 * Get the user by activation code
	 */
	user, err = c.userService.GetUserByActivationCode(viewData.ActivationCode)

	if err != nil {
		if errors.Is(err, identity.ErrUserNotFound) {
			viewData.Message = "Invalid activation code."
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}

		slog.Error("error retrieving user by activation code", "error", err)
		viewData.Message = "We are sorry, but an unexpected error occurred. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	/*
	 * Check if we need to join an existing account
	 */
	if len(viewData.JoinToken) > 0 {
		account, err = c.accountService.GetAccountByJoinToken(viewData.JoinToken)

		if err != nil {
			slog.Error("error retrieving account by join token", "error", err, "joinToken", viewData.JoinToken)
			viewData.Message = "Invalid account code. Please check the code and try again."
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}

		user.Account = &models.Account{
			ID: models.ID{
				ID: account.ID.ID,
			},
		}

		/*
		 * Activate the user and associate with the existing account
		 */
		if err = c.userService.ActivateUser(viewData.ActivationCode); err != nil {
			slog.Error("error activating user", "error", err)
			viewData.Message = "We are sorry, but an unexpected error occurred while activating your account. Please try again later."
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}

		if err = c.userService.AddUserToAccount(user.ID.ID, account.ID.ID); err != nil {
			slog.Error("error adding user to account", "error", err, "userID", user.ID.ID, "accountID", account.ID.ID)
			viewData.Message = "We are sorry, but an unexpected error occurred while joining the account. Please try again later."
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}

		/*
		 * Create a watcher record for this user
		 */
		if _, err = c.watcherService.CreateWatcher(user); err != nil {
			slog.Error("error creating watcher record", "error", err, "userID", user.ID.ID)
			viewData.Message = "We are sorry, but an unexpected error occurred while setting up your account. Please try again later."
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}
	} else {
		/*
		 * Create a new account for this user
		 */
		createAccountRequest := models.CreateAccountRequest{
			UserID: user.ID.ID,
		}

		account, err = c.accountService.CreateAccount(createAccountRequest, identity.AssociateToUser(user.ID.ID))

		if err != nil {
			slog.Error("error creating account", "error", err, "userID", user.ID.ID)
			viewData.Message = "We are sorry, but an unexpected error occurred while creating your account. Please try again later."
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}

		user.Account = &models.Account{
			ID: models.ID{
				ID: account.ID.ID,
			},
		}

		/*
		 * Activate the user
		 */
		if err = c.userService.ActivateUser(viewData.ActivationCode); err != nil {
			slog.Error("error activating user", "error", err)
			viewData.Message = "We are sorry, but an unexpected error occurred while activating your account. Please try again later."
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}

		/*
		 * Create a watcher record for this user
		 */
		if _, err = c.watcherService.CreateWatcher(user); err != nil {
			slog.Error("error creating watcher record", "error", err, "userID", user.ID.ID)
			viewData.Message = "We are sorry, but an unexpected error occurred while setting up your account. Please try again later."
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}
	}

	/*
	 * Success! Redirect to login page with a success message
	 */
	http.Redirect(w, r, "/login?message=Account verified successfully! You can now log in.", http.StatusSeeOther)
}
