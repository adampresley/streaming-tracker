package platforms

import (
	"fmt"

	"github.com/adampresley/streaming-tracker/pkg/models"
	"github.com/adampresley/streaming-tracker/pkg/services"
	"github.com/georgysavva/scany/v2/pgxscan"
)

type PlatformServicer interface {
	/*
		GetPlatforms retrieves all platforms.
	*/
	GetPlatforms() ([]*models.Platform, error)
}

type PlatformServiceConfig struct {
	services.DbServiceBaseConfig
}

type PlatformService struct {
	services.DbServiceBase
}

func NewPlatformService(config PlatformServiceConfig) PlatformService {
	return PlatformService{
		DbServiceBase: services.DbServiceBase{
			QueryTimeout: config.QueryTimeout,
			DB:           config.DB,
		},
	}
}

func (s PlatformService) GetPlatforms() ([]*models.Platform, error) {
	var (
		err    error
		result []*models.Platform
	)

	query := `
SELECT
	p.id
	, p.created_at
	, p.updated_at
	, p.name
	, p.icon
FROM platforms AS p
WHERE 1=1
ORDER BY p.name ASC
	`

	ctx, cancel := s.GetContext()
	defer cancel()

	if err = pgxscan.Select(ctx, s.DB, &result, query); err != nil {
		return result, fmt.Errorf("error querying for platforms: %w", err)
	}

	return result, nil
}
