package base

import (
	"net/http"

	"github.com/adampresley/streaming-tracker/pkg/identity"
)

type BaseHandler struct {
}

func (h BaseHandler) GetSession(r *http.Request) *identity.UserSession {
	session, _ := r.Context().Value("session").(*identity.UserSession)
	return session
}
