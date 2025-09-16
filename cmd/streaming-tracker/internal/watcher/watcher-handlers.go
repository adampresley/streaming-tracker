package watcher

import (
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
	"github.com/adampresley/streaming-tracker/pkg/watchers"
)

type WatcherHandlers interface {
	AddWatcherAction(w http.ResponseWriter, r *http.Request)
	ManageWatchersPage(w http.ResponseWriter, r *http.Request)
	UpdateWatcherNameAction(w http.ResponseWriter, r *http.Request)
}

type WatcherControllerConfig struct {
	Auth           auth2.Authenticator[*identity.UserSession]
	Config         *configuration.Config
	Renderer       rendering.TemplateRenderer
	WatcherService watchers.WatcherServicer
}

type WatcherController struct {
	base.BaseHandler

	auth           auth2.Authenticator[*identity.UserSession]
	config         *configuration.Config
	renderer       rendering.TemplateRenderer
	watcherService watchers.WatcherServicer
}

func NewWatcherController(config WatcherControllerConfig) WatcherController {
	return WatcherController{
		auth:           config.Auth,
		config:         config.Config,
		renderer:       config.Renderer,
		watcherService: config.WatcherService,
	}
}

/*
GET /account/manage-watchers
*/
func (c WatcherController) ManageWatchersPage(w http.ResponseWriter, r *http.Request) {
	var (
		err              error
		watchersWithInfo []*models.WatcherWithUserInfo
	)

	pageName := "pages/account/manage-watchers"
	session := c.GetSession(r)

	viewData := viewmodels.ManageWatchers{
		BaseViewModel: viewmodels.BaseViewModel{
			Message: httphelpers.GetFromRequest[string](r, "message"),
			IsHtmx:  httphelpers.IsHtmx(r),
		},
		Watchers: []viewmodels.WatcherDisplay{},
	}

	if watchersWithInfo, err = c.watcherService.GetWatchersWithUserInfo(session.AccountID, session.UserID); err != nil {
		slog.Error("error fetching watchers with user info", "error", err)
		viewData.Message = "There was an unexpected error trying to load this page. Please try again later."
		viewData.IsError = true

		c.renderer.Render(pageName, viewData, w)
		return
	}

	// Check if current user is account owner
	isCurrentUserOwner := false
	for _, watcher := range watchersWithInfo {
		if watcher.UserID == session.UserID && watcher.IsOwner {
			isCurrentUserOwner = true
			break
		}
	}

	for _, w := range watchersWithInfo {
		// Determine if this watcher's name can be edited
		canEditName := false
		isCurrentUser := w.UserID == w.CurrentUserID

		// Can edit if it's the current user's own watcher
		if isCurrentUser {
			canEditName = true
		}

		// Can edit if current user is account owner and target watcher has no user account
		if isCurrentUserOwner && w.UserID == 0 {
			canEditName = true
		}

		watcherDisplay := viewmodels.WatcherDisplay{
			ID:             w.ID,
			Name:           w.Name,
			UserEmail:      w.UserEmail,
			IsOwner:        w.IsOwner,
			IsCurrentUser:  isCurrentUser,
			HasUserAccount: w.UserID != 0,
			CanEditName:    canEditName,
		}

		viewData.Watchers = append(viewData.Watchers, watcherDisplay)
	}

	c.renderer.Render(pageName, viewData, w)
}

/*
POST /account/watchers/add
*/
func (c WatcherController) AddWatcherAction(w http.ResponseWriter, r *http.Request) {
	var (
		err              error
		watchersWithInfo []*models.WatcherWithUserInfo
	)

	session := c.GetSession(r)
	watcherName := httphelpers.GetFromRequest[string](r, "watcherName")

	if watcherName == "" {
		http.Error(w, "Watcher name is required", http.StatusBadRequest)
		return
	}

	if _, err = c.watcherService.CreateWatcherManual(session.AccountID, watcherName); err != nil {
		slog.Error("error creating manual watcher", "error", err)
		http.Error(w, "There was an unexpected error adding the watcher. Please try again later.", http.StatusInternalServerError)
		return
	}

	// Get updated watchers list and return the watchers section for HTMX
	if watchersWithInfo, err = c.watcherService.GetWatchersWithUserInfo(session.AccountID, session.UserID); err != nil {
		slog.Error("error fetching watchers after adding", "error", err)
		http.Error(w, "There was an unexpected error loading the updated watchers. Please try again later.", http.StatusInternalServerError)
		return
	}

	viewData := viewmodels.ManageWatchers{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx: true,
		},
		Watchers: []viewmodels.WatcherDisplay{},
	}

	// Check if current user is account owner
	isCurrentUserOwner := false
	for _, watcher := range watchersWithInfo {
		if watcher.UserID == session.UserID && watcher.IsOwner {
			isCurrentUserOwner = true
			break
		}
	}

	for _, w := range watchersWithInfo {
		// Determine if this watcher's name can be edited
		canEditName := false
		isCurrentUser := w.UserID == w.CurrentUserID

		// Can edit if it's the current user's own watcher
		if isCurrentUser {
			canEditName = true
		}

		// Can edit if current user is account owner and target watcher has no user account
		if isCurrentUserOwner && w.UserID == 0 {
			canEditName = true
		}

		watcherDisplay := viewmodels.WatcherDisplay{
			ID:             w.ID,
			Name:           w.Name,
			UserEmail:      w.UserEmail,
			IsOwner:        w.IsOwner,
			IsCurrentUser:  isCurrentUser,
			HasUserAccount: w.UserID != 0,
			CanEditName:    canEditName,
		}

		viewData.Watchers = append(viewData.Watchers, watcherDisplay)
	}

	c.renderer.Render("components/watchers-list", viewData, w)
}

/*
POST /account/watchers/update-name
*/
func (c WatcherController) UpdateWatcherNameAction(w http.ResponseWriter, r *http.Request) {
	var (
		err              error
		watchersWithInfo []*models.WatcherWithUserInfo
	)

	session := c.GetSession(r)
	watcherID := httphelpers.GetFromRequest[int](r, "watcherID")
	newName := httphelpers.GetFromRequest[string](r, "watcherName")

	if newName == "" {
		http.Error(w, "Watcher name is required", http.StatusBadRequest)
		return
	}

	if err = c.watcherService.UpdateWatcherName(watcherID, session.AccountID, session.UserID, newName); err != nil {
		slog.Error("error updating watcher name", "error", err)
		http.Error(w, "There was an unexpected error updating the watcher name. Please try again later.", http.StatusInternalServerError)
		return
	}

	// Get updated watchers list and return the watchers section for HTMX
	if watchersWithInfo, err = c.watcherService.GetWatchersWithUserInfo(session.AccountID, session.UserID); err != nil {
		slog.Error("error fetching watchers after updating", "error", err)
		http.Error(w, "There was an unexpected error loading the updated watchers. Please try again later.", http.StatusInternalServerError)
		return
	}

	viewData := viewmodels.ManageWatchers{
		BaseViewModel: viewmodels.BaseViewModel{
			IsHtmx: true,
		},
		Watchers: []viewmodels.WatcherDisplay{},
	}

	// Check if current user is account owner
	isCurrentUserOwner := false
	for _, watcher := range watchersWithInfo {
		if watcher.UserID == session.UserID && watcher.IsOwner {
			isCurrentUserOwner = true
			break
		}
	}

	for _, w := range watchersWithInfo {
		// Determine if this watcher's name can be edited
		canEditName := false
		isCurrentUser := w.UserID == w.CurrentUserID

		// Can edit if it's the current user's own watcher
		if isCurrentUser {
			canEditName = true
		}

		// Can edit if current user is account owner and target watcher has no user account
		if isCurrentUserOwner && w.UserID == 0 {
			canEditName = true
		}

		watcherDisplay := viewmodels.WatcherDisplay{
			ID:             w.ID,
			Name:           w.Name,
			UserEmail:      w.UserEmail,
			IsOwner:        w.IsOwner,
			IsCurrentUser:  isCurrentUser,
			HasUserAccount: w.UserID != 0,
			CanEditName:    canEditName,
		}

		viewData.Watchers = append(viewData.Watchers, watcherDisplay)
	}

	c.renderer.Render("components/watchers-list", viewData, w)
}
