package main

import (
	"context"
	"embed"
	"encoding/gob"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/adampresley/adamgokit/auth2"
	"github.com/adampresley/adamgokit/email"
	"github.com/adampresley/adamgokit/httphelpers"
	"github.com/adampresley/adamgokit/mux"
	"github.com/adampresley/adamgokit/rendering"
	"github.com/adampresley/adamgokit/rest/clientoptions"
	"github.com/adampresley/adamgokit/sessions"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/configuration"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/home"
	identityhandlers "github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/identity"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/platform"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/show"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/watcher"
	"github.com/adampresley/streaming-tracker/pkg/identity"
	"github.com/adampresley/streaming-tracker/pkg/platforms"
	"github.com/adampresley/streaming-tracker/pkg/services"
	"github.com/adampresley/streaming-tracker/pkg/shows"
	"github.com/adampresley/streaming-tracker/pkg/watchers"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	Version     string = "development"
	appName     string = "streaming-tracker"
	sessionName string = "streaming-tracker"
	sessionKey  string = "streaming-tracker-session"

	//go:embed app
	appFS embed.FS

	/* Services */
	db              *pgxpool.Pool
	emailService    email.MailServicer
	renderer        rendering.TemplateRenderer
	accountService  identity.AccountServicer
	userService     identity.UserServicer
	watcherService  watchers.WatcherServicer
	platformService platforms.PlatformServicer
	showService     shows.ShowServicer

	/* Controllers */
	homeController     home.HomeHandlers
	identityController identityhandlers.IdentityHandlers
	platformController platform.PlatformHandlers
	showController     show.ShowHandlers
	watcherController  watcher.WatcherHandlers
)

func main() {
	var (
		err error
	)

	config := configuration.LoadConfig()
	setupLogger(&config, Version)

	slog.Info("configuration loaded",
		slog.String("app", appName),
		slog.String("version", Version),
		slog.String("loglevel", config.LogLevel),
		slog.String("host", config.Host),
	)

	slog.Debug("setting up...")

	/*
	 * Setup database
	 */
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*30)
	defer cancel()

	if db, err = pgxpool.New(ctx, config.DSN); err != nil {
		panic(err)
	}

	migrateDatabase(&config)

	/*
	 * Setup services
	 */
	sessionStore := sessions.NewCookieStore(
		sessionKey,
		sessions.WithMaxAge(time.Hour*24),
	)

	emailService = getMailService(&config)

	gob.Register(&identity.UserSession{})

	auth := auth2.New(
		auth2.UserNameAndPassword[*identity.UserSession](
			sessionStore,
			sessionName,
			sessionKey,
			auth2.WithContextKey("session"),
			auth2.WithExcludedPaths([]string{
				"/error",
				"/login",
				"/account/sign-up",
				"/account/sign-up-success",
				"/account/verify",
			}),
			auth2.WithRedirectURL("/login"),
			auth2.WithErrorFunc(func(w http.ResponseWriter, r *http.Request, err error) {
				http.Redirect(w, r, "/error?message="+err.Error(), http.StatusSeeOther)
			}),
		),
	)

	renderer, err = rendering.NewGoTemplateRenderer(rendering.GoTemplateRendererConfig{
		PagesDir:          "pages",
		TemplateDir:       "app",
		TemplateExtension: ".html",
		TemplateFS:        appFS,
	})

	if err != nil {
		panic(err)
	}

	userService = identity.NewUserService(identity.UserServiceConfig{
		DbServiceBaseConfig: services.DbServiceBaseConfig{
			QueryTimeout: config.QueryTimeout,
			DB:           db,
			PageSize:     config.PageSize,
		},
	})

	accountService = identity.NewAccountService(identity.AccountServiceConfig{
		DbServiceBase: services.DbServiceBase{
			QueryTimeout: config.QueryTimeout,
			DB:           db,
		},
	})

	watcherService = watchers.NewWatcherService(watchers.WatcherServiceConfig{
		DbServiceBaseConfig: services.DbServiceBaseConfig{
			QueryTimeout: config.QueryTimeout,
			DB:           db,
			PageSize:     config.PageSize,
		},
	})

	platformService = platforms.NewPlatformService(platforms.PlatformServiceConfig{
		DbServiceBaseConfig: services.DbServiceBaseConfig{
			QueryTimeout: config.QueryTimeout,
			DB:           db,
			PageSize:     config.PageSize,
		},
	})

	showService = shows.NewShowService(shows.ShowServiceConfig{
		DbServiceBaseConfig: services.DbServiceBaseConfig{
			QueryTimeout: config.QueryTimeout,
			DB:           db,
			PageSize:     config.PageSize,
		},
		RestClientOptions: &clientoptions.ClientOptions{
			BaseURL:    config.TvmazeBaseURL,
			Debug:      Version == "development",
			HttpClient: http.DefaultClient,
		},
	})

	/*
	 * Setup controllers
	 */
	homeController = home.NewHomeController(home.HomeControllerConfig{
		Auth:        auth,
		Config:      &config,
		Renderer:    renderer,
		ShowService: showService,
	})

	identityController = identityhandlers.NewIdentityController(identityhandlers.IdentityControllerConfig{
		AccountService: accountService,
		Auth:           auth,
		Config:         &config,
		Renderer:       renderer,
		UserService:    userService,
		EmailService:   emailService,
		WatcherService: watcherService,
	})

	platformController = platform.NewPlatformController(platform.PlatformControllerConfig{
		Auth:     auth,
		Config:   &config,
		Renderer: renderer,
	})

	showController = show.NewShowController(show.ShowControllerConfig{
		Auth:            auth,
		Config:          &config,
		PlatformService: platformService,
		Renderer:        renderer,
		ShowService:     showService,
		WatcherService:  watcherService,
	})

	watcherController = watcher.NewWatcherController(watcher.WatcherControllerConfig{
		Auth:           auth,
		Config:         &config,
		Renderer:       renderer,
		WatcherService: watcherService,
	})

	/*
	 * Setup router and http server
	 */
	slog.Debug("setting up routes...")

	routes := []mux.Route{
		{Path: "GET /heartbeat", HandlerFunc: heartbeat},
		{Path: "GET /", HandlerFunc: homeController.HomePage},
		{Path: "GET /error", HandlerFunc: homeController.ErrorPage},
		{Path: "GET /login", HandlerFunc: identityController.LoginPage},
		{Path: "POST /login", HandlerFunc: identityController.LoginAction},
		{Path: "GET /logout", HandlerFunc: identityController.LogoutAction},
		{Path: "GET /account/sign-up", HandlerFunc: identityController.AccountSignUpPage},
		{Path: "POST /account/sign-up", HandlerFunc: identityController.AccountSignUpAction},
		{Path: "GET /account/sign-up-success", HandlerFunc: identityController.AccountSignUpSuccessPage},
		{Path: "GET /account/verify", HandlerFunc: identityController.AccountVerifyPage},
		{Path: "POST /account/verify", HandlerFunc: identityController.AccountVerifyAction},
		{Path: "GET /account/manage-watchers", HandlerFunc: watcherController.ManageWatchersPage},
		{Path: "POST /account/watchers/add", HandlerFunc: watcherController.AddWatcherAction},
		{Path: "POST /account/watchers/update-name", HandlerFunc: watcherController.UpdateWatcherNameAction},
		{Path: "GET /shows/add", HandlerFunc: showController.AddShowPage},
		{Path: "POST /shows/add", HandlerFunc: showController.AddShowAction},
		{Path: "DELETE /shows/delete", HandlerFunc: showController.DeleteShowAction},
		{Path: "GET /shows/edit/{id}", HandlerFunc: showController.EditShowPage},
		{Path: "POST /shows/edit/{id}", HandlerFunc: showController.EditShowAction},
		{Path: "GET /shows/manage", HandlerFunc: showController.ManageShowsPage},
		{Path: "GET /shows/search", HandlerFunc: showController.OnlineSearchAction},
		{Path: "POST /shows/start-watching", HandlerFunc: showController.StartWatchingAction},
		{Path: "POST /shows/finish-season", HandlerFunc: showController.FinishSeasonAction},
		{Path: "POST /shows/add-season", HandlerFunc: showController.AddSeasonAction},
		{Path: "POST /shows/cancel", HandlerFunc: showController.CancelShowAction},
		{Path: "POST /shows/back-to-want-to-watch", HandlerFunc: showController.BackToWantToWatchAction},
	}

	routerConfig := mux.RouterConfig{
		Address:              config.Host,
		Debug:                Version == "development",
		ServeStaticContent:   true,
		StaticContentRootDir: "app",
		StaticContentPrefix:  "/static/",
		StaticFS:             appFS,
		Middlewares:          []mux.MiddlewareFunc{auth.Middleware},
	}

	m := mux.SetupRouter(routerConfig, routes)
	httpServer, quit := mux.SetupServer(routerConfig, m)

	/*
	 * Wait for graceful shutdown
	 */
	slog.Info("server started")

	<-quit
	mux.Shutdown(httpServer)
	slog.Info("server stopped")
}

func heartbeat(w http.ResponseWriter, r *http.Request) {
	httphelpers.TextOK(w, "OK")
}

func migrateDatabase(config *configuration.Config) {
	var (
		err  error
		dirs []os.DirEntry
		b    []byte
	)

	if dirs, err = os.ReadDir(config.DataMigrationDir); err != nil {
		panic(err)
	}

	for _, d := range dirs {
		if d.IsDir() {
			continue
		}

		if strings.HasPrefix(d.Name(), "commit") {
			if b, err = os.ReadFile(filepath.Join(config.DataMigrationDir, d.Name())); err != nil {
				panic(err)
			}

			if err = runSqlScript(b); err != nil {
				if !isIgnorableError(err) {
					panic(err)
				}
			}
		}
	}
}

func runSqlScript(script []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*30)
	defer cancel()

	_, err := db.Exec(ctx, string(script))
	return err
}

func isIgnorableError(err error) bool {
	if strings.Contains(err.Error(), "duplicate column") {
		return true
	}

	if strings.Contains(err.Error(), "duplicate key value") {
		return true
	}

	return false
}

func getMailService(config *configuration.Config) email.MailServicer {
	mailTimeout := time.Second * 20

	if config.EmailApiKey != "" && config.EmailDomain != "" {
		return email.NewMailgunService(&email.Config{
			ApiKey:  config.EmailApiKey,
			Domain:  config.EmailDomain,
			Timeout: mailTimeout,
		})
	}

	return email.NewSmtpMailService(&email.Config{
		Host:    config.EmailHost,
		Port:    config.EmailPort,
		Timeout: mailTimeout,
	})
}
