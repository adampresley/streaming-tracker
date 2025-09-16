package viewmodels

import (
	"github.com/adampresley/streaming-tracker/pkg/models"
	orderedmap "github.com/wk8/go-ordered-map/v2"
)

type Home struct {
	BaseViewModel
	Shows []DashboardShow
}

type DashboardShow struct {
	Watcher  string
	Statuses []DashboardShowByStatus
}

type DashboardShowByStatus struct {
	Status string
	Shows  []models.ShowGroupedByStatusAndWatchers
}

func NewDashboardShowsFromDbModel(shows *orderedmap.OrderedMap[string, *orderedmap.OrderedMap[string, []models.ShowGroupedByStatusAndWatchers]]) []DashboardShow {
	result := []DashboardShow{}

	for pair := shows.Oldest(); pair != nil; pair = pair.Next() {
		watchers := pair.Key
		statuses := pair.Value

		newShowByWatcher := DashboardShow{
			Watcher:  watchers,
			Statuses: []DashboardShowByStatus{},
		}

		for pair2 := statuses.Oldest(); pair2 != nil; pair2 = pair2.Next() {
			status := pair2.Key
			ss := pair2.Value

			newShowByStatus := DashboardShowByStatus{
				Status: status,
				Shows:  ss,
			}

			newShowByWatcher.Statuses = append(newShowByWatcher.Statuses, newShowByStatus)
		}

		result = append(result, newShowByWatcher)
	}

	return result
}
