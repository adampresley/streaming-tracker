package viewmodels

import (
	"html/template"

	"github.com/adampresley/adamgokit/rendering"
)

type BaseViewModel struct {
	Message            template.HTML
	IsError            bool
	IsWarning          bool
	IsHtmx             bool
	JavascriptIncludes []rendering.JavascriptInclude
}
