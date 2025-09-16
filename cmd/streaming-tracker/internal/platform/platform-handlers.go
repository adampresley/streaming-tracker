package platform

import (
	"github.com/adampresley/adamgokit/auth2"
	"github.com/adampresley/adamgokit/rendering"
	"github.com/adampresley/streaming-tracker/cmd/streaming-tracker/internal/configuration"
	"github.com/adampresley/streaming-tracker/pkg/identity"
)

type PlatformHandlers interface {
}

type PlatformControllerConfig struct {
	Auth     auth2.Authenticator[*identity.UserSession]
	Config   *configuration.Config
	Renderer rendering.TemplateRenderer
}

type PlatformController struct {
	auth     auth2.Authenticator[*identity.UserSession]
	config   *configuration.Config
	renderer rendering.TemplateRenderer
}

func NewPlatformController(config PlatformControllerConfig) PlatformController {
	return PlatformController{
		auth:     config.Auth,
		config:   config.Config,
		renderer: config.Renderer,
	}
}
