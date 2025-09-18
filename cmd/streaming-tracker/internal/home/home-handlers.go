package home

import (
	"html/template"
	"log/slog"
	"net/http"

	"github.com/adampresley/adamgokit/auth2"
	"github.com/adampresley/adamgokit/httphelpers"
	"github.com/adampresley/adamgokit/rendering"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/base"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/configuration"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/viewmodels"
	"github.com/adampresley/streaming-tracker/pkg/identity"
	"github.com/adampresley/streaming-tracker/pkg/models"
	"github.com/adampresley/streaming-tracker/pkg/shows"
	orderedmap "github.com/wk8/go-ordered-map/v2"
)

type HomeHandlers interface {
	ErrorPage(w http.ResponseWriter, r *http.Request)
	HomePage(w http.ResponseWriter, r *http.Request)
}

type HomeControllerConfig struct {
	Auth        auth2.Authenticator[*identity.UserSession]
	Config      *configuration.Config
	Renderer    rendering.TemplateRenderer
	ShowService shows.ShowServicer
}

type HomeController struct {
	base.BaseHandler

	auth        auth2.Authenticator[*identity.UserSession]
	config      *configuration.Config
	renderer    rendering.TemplateRenderer
	showService shows.ShowServicer
}

func NewHomeController(config HomeControllerConfig) HomeController {
	return HomeController{
		auth:        config.Auth,
		config:      config.Config,
		renderer:    config.Renderer,
		showService: config.ShowService,
	}
}

func (c HomeController) ErrorPage(w http.ResponseWriter, r *http.Request) {
	pageName := "pages/error"

	viewData := viewmodels.Error{
		BaseViewModel: viewmodels.BaseViewModel{
			Message: template.HTML(httphelpers.GetFromRequest[string](r, "message")),
			IsError: true,
			IsHtmx:  httphelpers.IsHtmx(r),
		},
	}

	c.renderer.Render(pageName, viewData, w)
}

/*
GET /
*/
func (c HomeController) HomePage(w http.ResponseWriter, r *http.Request) {
	var (
		err   error
		shows *orderedmap.OrderedMap[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]]
	)

	pageName := "pages/home"
	session := c.GetSession(r)

	viewData := viewmodels.Home{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx:  httphelpers.IsHtmx(r),
			Message: template.HTML(httphelpers.GetFromRequest[string](r, "message")),
		},
		Shows: []viewmodels.DashboardShow{},
	}

	if shows, err = c.showService.GetActiveShowsGroupedByWatchersAndStatus(session.AccountID); err != nil {
		slog.Error("error fetching shows for dashboard", "error", err)
		viewData.IsError = true
		viewData.Message = "There was a problem fetching your shows. Please try again later."

		c.renderer.Render(pageName, viewData, w)
		return
	}

	viewData.Shows = viewmodels.NewDashboardShowsFromDbModel(shows)
	c.renderer.Render(pageName, viewData, w)
}
