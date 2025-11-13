package show

import (
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
	"slices"

	"github.com/adampresley/adamgokit/auth2"
	"github.com/adampresley/adamgokit/httphelpers"
	"github.com/adampresley/adamgokit/paging"
	"github.com/adampresley/adamgokit/rendering"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/base"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/configuration"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/viewmodels"
	"github.com/adampresley/streaming-tracker/pkg/datetime"
	"github.com/adampresley/streaming-tracker/pkg/identity"
	"github.com/adampresley/streaming-tracker/pkg/models"
	"github.com/adampresley/streaming-tracker/pkg/platforms"
	"github.com/adampresley/streaming-tracker/pkg/querymodels"
	"github.com/adampresley/streaming-tracker/pkg/requesttypes"
	"github.com/adampresley/streaming-tracker/pkg/shows"
	"github.com/adampresley/streaming-tracker/pkg/watchers"
	orderedmap "github.com/wk8/go-ordered-map/v2"
)

type ShowHandlers interface {
	AddSeasonAction(w http.ResponseWriter, r *http.Request)
	AddShowPage(w http.ResponseWriter, r *http.Request)
	AddShowAction(w http.ResponseWriter, r *http.Request)
	BackToWantToWatchAction(w http.ResponseWriter, r *http.Request)
	CancelShowAction(w http.ResponseWriter, r *http.Request)
	DeleteShowAction(w http.ResponseWriter, r *http.Request)
	EditShowPage(w http.ResponseWriter, r *http.Request)
	EditShowAction(w http.ResponseWriter, r *http.Request)
	FindShowImageAction(w http.ResponseWriter, r *http.Request)
	FinishSeasonAction(w http.ResponseWriter, r *http.Request)
	ManageShowsPage(w http.ResponseWriter, r *http.Request)
	OnlineSearchAction(w http.ResponseWriter, r *http.Request)
	StartWatchingAction(w http.ResponseWriter, r *http.Request)
}

type ShowControllerConfig struct {
	Auth            auth2.Authenticator[*identity.UserSession]
	Config          *configuration.Config
	PlatformService platforms.PlatformServicer
	Renderer        rendering.TemplateRenderer
	ShowService     shows.ShowServicer
	WatcherService  watchers.WatcherServicer
}

type ShowController struct {
	base.BaseHandler

	auth            auth2.Authenticator[*identity.UserSession]
	config          *configuration.Config
	platformService platforms.PlatformServicer
	renderer        rendering.TemplateRenderer
	showService     shows.ShowServicer
	watcherService  watchers.WatcherServicer
}

func NewShowController(config ShowControllerConfig) ShowController {
	return ShowController{
		auth:            config.Auth,
		config:          config.Config,
		platformService: config.PlatformService,
		renderer:        config.Renderer,
		showService:     config.ShowService,
		watcherService:  config.WatcherService,
	}
}

/*
GET /shows/add
*/
func (c ShowController) AddShowPage(w http.ResponseWriter, r *http.Request) {
	var (
		err      error
		watchers []*models.Watcher
	)

	pageName := "pages/shows/add-show"
	session := c.GetSession(r)

	viewData := viewmodels.AddShow{
		BaseViewModel: viewmodels.BaseViewModel{
			Message: template.HTML(httphelpers.GetFromRequest[string](r, "message")),
			IsHtmx:  httphelpers.IsHtmx(r),
			JavascriptIncludes: []rendering.JavascriptInclude{
				{Src: "/static/js/pages/add-show.js", Type: "module"},
			},
		},
		ShowName:     "",
		TotalSeasons: 0,
		PlatformID:   0,
		WatcherIDs:   []int{},
		Platforms:    []*models.Platform{},
		Watchers:     []viewmodels.SelectableWatcher{},
	}

	if viewData.Platforms, err = c.platformService.GetPlatforms(); err != nil {
		slog.Error("error fetching platforms", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	if watchers, err = c.watcherService.GetWatchers(session.AccountID); err != nil {
		slog.Error("error fetching watchers", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	for _, watcher := range watchers {
		newWatcher := viewmodels.SelectableWatcher{
			Watcher:    watcher,
			IsSelected: false,
		}

		if len(watchers) < 2 {
			newWatcher.IsSelected = true
		}

		viewData.Watchers = append(viewData.Watchers, newWatcher)
	}

	c.renderer.Render(pageName, viewData, w)
}

/*
POST /shows/add
*/
func (c ShowController) AddShowAction(w http.ResponseWriter, r *http.Request) {
	var (
		err      error
		watchers []*models.Watcher
	)

	pageName := "pages/shows/add-show"
	session := c.GetSession(r)

	viewData := viewmodels.AddShow{
		BaseViewModel: viewmodels.BaseViewModel{
			Message: template.HTML(httphelpers.GetFromRequest[string](r, "message")),
			IsHtmx:  httphelpers.IsHtmx(r),
		},
		ShowName:     httphelpers.GetFromRequest[string](r, "showName"),
		TotalSeasons: httphelpers.GetFromRequest[int](r, "totalSeasons"),
		PlatformID:   httphelpers.GetFromRequest[int](r, "platform"),
		WatcherIDs:   httphelpers.GetFromRequest[[]int](r, "watchers"),
		PosterImage:  httphelpers.GetFromRequest[string](r, "posterImage"),
		Platforms:    []*models.Platform{},
		Watchers:     []viewmodels.SelectableWatcher{},
	}

	/*
	 * Get page data again in case or error
	 */
	if viewData.Platforms, err = c.platformService.GetPlatforms(); err != nil {
		slog.Error("error fetching platforms", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	if watchers, err = c.watcherService.GetWatchers(session.AccountID); err != nil {
		slog.Error("error fetching watchers", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	for _, watcher := range watchers {
		newWatcher := viewmodels.SelectableWatcher{
			Watcher:    watcher,
			IsSelected: false,
		}

		if len(watchers) < 2 {
			newWatcher.IsSelected = true
		}

		viewData.Watchers = append(viewData.Watchers, newWatcher)
	}

	/*
	 * Add the show
	 */
	createShowRequest := requesttypes.AddShowRequest{
		Name:         viewData.ShowName,
		TotalSeasons: viewData.TotalSeasons,
		PlatformID:   viewData.PlatformID,
		WatcherIDs:   viewData.WatcherIDs,
		PosterImage:  viewData.PosterImage,
	}

	if _, err = c.showService.AddShow(session.AccountID, createShowRequest); err != nil {
		slog.Error("error creating new show", "error", err)
		viewData.Message = "There was an unexpected error trying to add your show. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	slog.Info("new show added successfully", "showName", viewData.ShowName, "accountID", session.AccountID)
	http.Redirect(w, r, "/?message=New show added successfully! <a href=\"/shows/add\">Add another show</a>", http.StatusSeeOther)
}

/*
POST /shows/add-season?id={id}
*/
func (c ShowController) AddSeasonAction(w http.ResponseWriter, r *http.Request) {
	var (
		err error
	)

	session := c.GetSession(r)
	showID := httphelpers.GetFromRequest[int](r, "id")

	if err = c.showService.AddSeason(session.AccountID, showID); err != nil {
		if err == shows.ErrShowNotFound {
			slog.Error("attempt to add season to non-existent show", "showID", showID, "accountID", session.AccountID)
			http.Error(w, "Show not found", http.StatusNotFound)
			return
		}

		slog.Error("error adding season to show", "error", err, "showID", showID, "accountID", session.AccountID)
		http.Error(w, "There was an unexpected error trying to add a season to the show. Please try again later.", http.StatusInternalServerError)
		return
	}

	// Get the current search filters from the request to maintain them and assemble view data
	viewData, err := c.searchShowsAndAssembleViewData(
		session.AccountID,
		httphelpers.GetFromRequest[int](r, "page"),
		httphelpers.GetFromRequest[string](r, "showName"),
		httphelpers.GetFromRequest[int](r, "platform"),
		viewmodels.BaseViewModel{IsHtmx: true},
		r,
	)

	if err != nil {
		slog.Error("error searching shows after adding season", "error", err)
		http.Error(w, "There was an unexpected error loading the updated shows. Please try again later.", http.StatusInternalServerError)
		return
	}

	slog.Info("show season added successfully", "showID", showID, "accountID", session.AccountID)
	c.renderer.Render("pages/shows/manage-shows", viewData, w)
}

/*
POST /shows/cancel?id={id}
*/
func (c ShowController) CancelShowAction(w http.ResponseWriter, r *http.Request) {
	var (
		err error
	)

	session := c.GetSession(r)
	showID := httphelpers.GetFromRequest[int](r, "id")

	if err = c.showService.CancelShow(session.AccountID, showID); err != nil {
		if err == shows.ErrShowNotFound {
			slog.Error("attempt to cancel non-existent show", "showID", showID, "accountID", session.AccountID)
			http.Error(w, "Show not found", http.StatusNotFound)
			return
		}

		slog.Error("error cancelling show", "error", err, "showID", showID, "accountID", session.AccountID)
		http.Error(w, "There was an unexpected error trying to cancel the show. Please try again later.", http.StatusInternalServerError)
		return
	}

	// Get the current search filters from the request to maintain them and assemble view data
	viewData, err := c.searchShowsAndAssembleViewData(
		session.AccountID,
		httphelpers.GetFromRequest[int](r, "page"),
		httphelpers.GetFromRequest[string](r, "showName"),
		httphelpers.GetFromRequest[int](r, "platform"),
		viewmodels.BaseViewModel{IsHtmx: true},
		r,
	)

	if err != nil {
		slog.Error("error searching shows after cancelling show", "error", err)
		http.Error(w, "There was an unexpected error loading the updated shows. Please try again later.", http.StatusInternalServerError)
		return
	}

	c.renderer.Render("pages/shows/manage-shows", viewData, w)
}

/*
GET /shows/edit/{id}
*/
func (c ShowController) EditShowPage(w http.ResponseWriter, r *http.Request) {
	var (
		err      error
		watchers []*models.Watcher
		showData *models.ShowForEdit
	)

	pageName := "pages/shows/edit-show"
	session := c.GetSession(r)

	viewData := viewmodels.EditShow{
		BaseViewModel: viewmodels.BaseViewModel{
			Message: template.HTML(httphelpers.GetFromRequest[string](r, "message")),
			IsHtmx:  httphelpers.IsHtmx(r),
			JavascriptIncludes: []rendering.JavascriptInclude{
				{Src: "/static/js/pages/edit-show.js", Type: "module"},
			},
		},
		ShowID:         httphelpers.GetFromRequest[int](r, "id"),
		ShowName:       "",
		TotalSeasons:   0,
		PlatformID:     0,
		WatcherIDs:     []int{},
		Platforms:      []*models.Platform{},
		Watchers:       []viewmodels.SelectableWatcher{},
		ShowIsFinished: false,
		Referer:        httphelpers.GetFromRequest[string](r, "referer"),
	}

	if viewData.Platforms, err = c.platformService.GetPlatforms(); err != nil {
		slog.Error("error fetching platforms", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	if watchers, err = c.watcherService.GetWatchers(session.AccountID); err != nil {
		slog.Error("error fetching watchers", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	if showData, err = c.showService.GetShowByID(session.AccountID, viewData.ShowID); err != nil {
		slog.Error("error fetching show data", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	viewData.ShowName = showData.Name
	viewData.TotalSeasons = showData.NumSeasons
	viewData.PlatformID = showData.PlatformID
	viewData.WatcherIDs = showData.WatcherIds
	viewData.PosterImage = showData.PosterImage

	for _, watcher := range watchers {
		isSelected := slices.Contains(showData.WatcherIds, watcher.ID.ID)

		newWatcher := viewmodels.SelectableWatcher{
			Watcher:    watcher,
			IsSelected: isSelected,
		}

		viewData.Watchers = append(viewData.Watchers, newWatcher)
	}

	if showData.FinishedAt != nil {
		viewData.ShowIsFinished = true
	}

	if showData.Cancelled {
		viewData.ShowIsCancelled = true
		// Redirect to manage shows page with error message
		http.Redirect(w, r, "/shows/manage?message=Cannot edit cancelled shows", http.StatusSeeOther)
		return
	}

	c.renderer.Render(pageName, viewData, w)
}

/*
POST /shows/edit/{id}
*/
func (c ShowController) EditShowAction(w http.ResponseWriter, r *http.Request) {
	var (
		err              error
		watchers         []*models.Watcher
		existingShowData *models.ShowForEdit
	)

	pageName := "pages/shows/edit-show"
	session := c.GetSession(r)
	showID := httphelpers.GetFromRequest[int](r, "id")

	viewData := viewmodels.EditShow{
		BaseViewModel: viewmodels.BaseViewModel{
			Message: template.HTML(httphelpers.GetFromRequest[string](r, "message")),
			IsHtmx:  httphelpers.IsHtmx(r),
		},
		ShowID:         showID,
		ShowName:       httphelpers.GetFromRequest[string](r, "showName"),
		TotalSeasons:   httphelpers.GetFromRequest[int](r, "totalSeasons"),
		PlatformID:     httphelpers.GetFromRequest[int](r, "platform"),
		WatcherIDs:     httphelpers.GetFromRequest[[]int](r, "watchers"),
		PosterImage:    httphelpers.GetFromRequest[string](r, "posterImage"),
		Platforms:      []*models.Platform{},
		Watchers:       []viewmodels.SelectableWatcher{},
		ShowIsFinished: false,
		Referer:        httphelpers.GetFromRequest[string](r, "referer"),
	}

	/*
	 * Get page data again in case of error
	 */
	if viewData.Platforms, err = c.platformService.GetPlatforms(); err != nil {
		slog.Error("error fetching platforms", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	if watchers, err = c.watcherService.GetWatchers(session.AccountID); err != nil {
		slog.Error("error fetching watchers", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	if existingShowData, err = c.showService.GetShowByID(session.AccountID, viewData.ShowID); err != nil {
		slog.Error("error fetching show data", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	// Check if show is cancelled
	if existingShowData.Cancelled {
		http.Redirect(w, r, "/shows/manage?message=Cannot edit cancelled shows", http.StatusSeeOther)
		return
	}

	for _, watcher := range watchers {
		isSelected := slices.Contains(viewData.WatcherIDs, watcher.ID.ID)

		newWatcher := viewmodels.SelectableWatcher{
			Watcher:    watcher,
			IsSelected: isSelected,
		}

		viewData.Watchers = append(viewData.Watchers, newWatcher)
	}

	/*
	 * Update the show
	 */
	if existingShowData.FinishedAt != nil {
		// If the show is finished, we can't update the number of seasons here
		// we have somewhere else to do it
		viewData.ShowIsFinished = true
		viewData.TotalSeasons = existingShowData.NumSeasons
	}

	editShowRequest := requesttypes.EditShowRequest{
		ID:           viewData.ShowID,
		Name:         viewData.ShowName,
		TotalSeasons: viewData.TotalSeasons,
		PlatformID:   viewData.PlatformID,
		WatcherIDs:   viewData.WatcherIDs,
		PosterImage:  viewData.PosterImage,
	}

	if err = c.showService.UpdateShow(session.AccountID, editShowRequest); err != nil {
		slog.Error("error updating show", "error", err)
		viewData.Message = "There was an unexpected error trying to update your show. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	http.Redirect(w, r, "/shows/manage?message=Show updated successfully!&"+viewData.Referer, http.StatusSeeOther)
}

/*
GET /shows/manage
*/
func (c ShowController) ManageShowsPage(w http.ResponseWriter, r *http.Request) {
	var (
		err error
	)

	pageName := "pages/shows/manage-shows"
	session := c.GetSession(r)

	baseViewModel := viewmodels.BaseViewModel{
		Message: template.HTML(httphelpers.GetFromRequest[string](r, "message")),
		IsHtmx:  httphelpers.IsHtmx(r),
		JavascriptIncludes: []rendering.JavascriptInclude{
			{Src: "/static/js/pages/manage-shows.js", Type: "module"},
		},
	}

	// Use helper to get shows data
	viewData, err := c.searchShowsAndAssembleViewData(
		session.AccountID,
		httphelpers.GetFromRequest[int](r, "page"),
		httphelpers.GetFromRequest[string](r, "showName"),
		httphelpers.GetFromRequest[int](r, "platform"),
		baseViewModel,
		r,
	)

	if err != nil {
		slog.Error("error searching shows", "error", err)
		viewData.Message = "There was an unexpected error trying to load show data. Please try again later."
		c.renderer.Render("pages/error", viewData, w)
		return
	}

	// Set platforms for non-HTMX requests
	if !httphelpers.IsHtmx(r) {
		if viewData.Platforms, err = c.platformService.GetPlatforms(); err != nil {
			slog.Error("error fetching platforms", "error", err)
			viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
			viewData.IsError = true

			c.renderer.Render(pageName, viewData, w)
			return
		}
	}

	c.renderer.Render(pageName, viewData, w)
}

/*
DELETE /shows/delete?id={id}
*/
func (c ShowController) DeleteShowAction(w http.ResponseWriter, r *http.Request) {
	var (
		err error
	)

	session := c.GetSession(r)
	showID := httphelpers.GetFromRequest[int](r, "id")

	if err = c.showService.DeleteShow(session.AccountID, showID); err != nil {
		if err == shows.ErrShowHasWatchedSeasons {
			slog.Error("attempt to delete show with watched seasons", "showID", showID, "accountID", session.AccountID)
			http.Error(w, "Cannot delete show that has watched seasons", http.StatusBadRequest)
			return
		}

		if err == shows.ErrShowNotFound {
			slog.Error("attempt to delete non-existent show", "showID", showID, "accountID", session.AccountID)
			http.Error(w, "Show not found", http.StatusNotFound)
			return
		}

		slog.Error("error deleting show", "error", err, "showID", showID, "accountID", session.AccountID)
		http.Error(w, "There was an unexpected error trying to delete the show. Please try again later.", http.StatusInternalServerError)
		return
	}

	// Return 200 OK for successful deletion - HTMX will handle removing the row
	w.WriteHeader(http.StatusOK)
}

/*
POST /shows/start-watching?id={id}
*/
func (c ShowController) StartWatchingAction(w http.ResponseWriter, r *http.Request) {
	var (
		err       error
		showsData *orderedmap.OrderedMap[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]]
	)

	session := c.GetSession(r)
	showID := httphelpers.GetFromRequest[int](r, "id")

	if err = c.showService.StartWatching(session.AccountID, showID); err != nil {
		if err == shows.ErrShowNotFound {
			slog.Error("attempt to start watching non-existent show", "showID", showID, "accountID", session.AccountID)
			http.Error(w, "Show not found", http.StatusNotFound)
			return
		}

		slog.Error("error starting to watch show", "error", err, "showID", showID, "accountID", session.AccountID)
		http.Error(w, "There was an unexpected error trying to start watching the show. Please try again later.", http.StatusInternalServerError)
		return
	}

	// Get updated shows data and return the shows section for HTMX
	if showsData, err = c.showService.GetActiveShowsGroupedByWatchersAndStatus(session.AccountID); err != nil {
		slog.Error("error fetching shows after starting watching", "error", err)
		http.Error(w, "There was an unexpected error loading the updated shows. Please try again later.", http.StatusInternalServerError)
		return
	}

	viewData := viewmodels.Home{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx: true,
		},
		Shows: viewmodels.NewDashboardShowsFromDbModel(showsData),
	}

	c.renderer.Render("components/dashboard-shows", viewData, w)
}

/*
POST /shows/back-to-want-to-watch?id={id}
*/
func (c ShowController) BackToWantToWatchAction(w http.ResponseWriter, r *http.Request) {
	var (
		err       error
		showsData *orderedmap.OrderedMap[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]]
	)

	session := c.GetSession(r)
	showID := httphelpers.GetFromRequest[int](r, "id")

	if err = c.showService.BackToWantToWatch(session.AccountID, showID); err != nil {
		if err == shows.ErrShowNotFound {
			slog.Error("attempt to move non-existent show back to want to watch", "showID", showID, "accountID", session.AccountID)
			http.Error(w, "Show not found", http.StatusNotFound)
			return
		}

		slog.Error("error moving show back to want to watch", "error", err, "showID", showID, "accountID", session.AccountID)
		http.Error(w, "There was an unexpected error trying to move the show back to want to watch. Please try again later.", http.StatusInternalServerError)
		return
	}

	// Get updated shows data and return the shows section for HTMX
	if showsData, err = c.showService.GetActiveShowsGroupedByWatchersAndStatus(session.AccountID); err != nil {
		slog.Error("error fetching shows after moving back to want to watch", "error", err)
		http.Error(w, "There was an unexpected error loading the updated shows. Please try again later.", http.StatusInternalServerError)
		return
	}

	viewData := viewmodels.Home{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx: true,
		},
		Shows: viewmodels.NewDashboardShowsFromDbModel(showsData),
	}

	c.renderer.Render("components/dashboard-shows", viewData, w)
}

/*
POST /shows/finish-season?id={id}
*/
func (c ShowController) FinishSeasonAction(w http.ResponseWriter, r *http.Request) {
	var (
		err       error
		showsData *orderedmap.OrderedMap[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]]
	)

	session := c.GetSession(r)
	showID := httphelpers.GetFromRequest[int](r, "id")

	if err = c.showService.FinishSeason(session.AccountID, showID); err != nil {
		if err == shows.ErrShowNotFound {
			slog.Error("attempt to finish season for non-existent show", "showID", showID, "accountID", session.AccountID)
			http.Error(w, "Show not found", http.StatusNotFound)
			return
		}

		slog.Error("error finishing season for show", "error", err, "showID", showID, "accountID", session.AccountID)
		http.Error(w, "There was an unexpected error trying to finish the season. Please try again later.", http.StatusInternalServerError)
		return
	}

	// Get updated shows data and return the shows section for HTMX
	if showsData, err = c.showService.GetActiveShowsGroupedByWatchersAndStatus(session.AccountID); err != nil {
		slog.Error("error fetching shows after finishing season", "error", err)
		http.Error(w, "There was an unexpected error loading the updated shows. Please try again later.", http.StatusInternalServerError)
		return
	}

	viewData := viewmodels.Home{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx: true,
		},
		Shows: viewmodels.NewDashboardShowsFromDbModel(showsData),
	}

	c.renderer.Render("components/dashboard-shows", viewData, w)
}

/*
GET /shows/search?term=searchterm
*/
func (c ShowController) OnlineSearchAction(w http.ResponseWriter, r *http.Request) {
	var (
		err     error
		results []models.OnlineShowSearchResult
	)

	searchTerm := r.URL.Query().Get("term")
	if searchTerm == "" {
		http.Error(w, "Search term is required", http.StatusBadRequest)
		return
	}

	if results, err = c.showService.OnlineSearch(searchTerm, "US"); err != nil {
		slog.Error("error performing online search", "error", err, "searchTerm", searchTerm)
		http.Error(w, "Error performing search", http.StatusInternalServerError)
		return
	}

	slog.Info("show search performed", "searchTerm", searchTerm, "resultsCount", len(results))
	httphelpers.WriteJson(w, http.StatusOK, results)
}

/*
GET /shows/find-image?showName={showName}
*/
func (c ShowController) FindShowImageAction(w http.ResponseWriter, r *http.Request) {
	var (
		err      error
		imageURL string
		showName string
	)

	showName = r.URL.Query().Get("showName")
	if showName == "" {
		http.Error(w, "Show name is required", http.StatusBadRequest)
		return
	}

	if imageURL, err = c.showService.FindShowImageByName(showName); err != nil {
		slog.Error("error finding show image", "error", err, "showName", showName)
		http.Error(w, "Error finding image", http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"imageURL": imageURL,
	}

	slog.Info("found show image", "showName", showName, "imageURL", imageURL)
	httphelpers.WriteJson(w, http.StatusOK, response)
}

/*
Helper method to search shows and assemble ManageShows view data
*/
func (c ShowController) searchShowsAndAssembleViewData(accountID, page int, showName string, platform int, baseViewModel viewmodels.BaseViewModel, r *http.Request) (viewmodels.ManageShows, error) {
	var (
		err          error
		totalRecords int
		showResults  []querymodels.Shows
	)

	viewData := viewmodels.ManageShows{
		BaseViewModel: baseViewModel,
		Page:          page,
		ShowName:      showName,
		Platform:      platform,
		Shows:         []viewmodels.Show{},
		Referer:       httphelpers.QueryParamsToString(r),
	}

	// Search for shows with current filters
	showResults, totalRecords, err = c.showService.SearchShows(
		accountID,
		shows.WithPage(viewData.Page),
		shows.WithShowName(viewData.ShowName),
		shows.WithPlatform(viewData.Platform),
	)

	if err != nil {
		return viewData, fmt.Errorf("error searching shows: %w", err)
	}

	viewData.Paging = paging.Calculate(viewData.Page, int64(totalRecords), c.config.PageSize)

	for _, s := range showResults {
		ns := viewmodels.Show{
			ShowID:        s.ShowID,
			ShowName:      s.ShowName,
			NumSeasons:    s.NumSeasons,
			PlatformName:  s.PlatformName,
			PlatformIcon:  s.PlatformIcon,
			Cancelled:     s.Cancelled,
			DateCancelled: "",
			WatchStatus:   s.WatchStatus,
			CurrentSeason: s.CurrentSeason,
			FinishedAt:    "",
			WatcherName:   s.WatcherName,
			TotalCount:    s.TotalCount,
			PosterImage:   s.PosterImage,
		}

		if s.DateCancelled.Valid {
			ns.DateCancelled = datetime.DisplayDate(s.DateCancelled.Time)
		}

		if s.FinishedAt.Valid {
			ns.FinishedAt = datetime.DisplayDate(s.FinishedAt.Time)
		}

		viewData.Shows = append(viewData.Shows, ns)
	}

	return viewData, nil
}
