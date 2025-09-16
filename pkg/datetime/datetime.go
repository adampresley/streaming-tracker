package datetime

import "time"

func DisplayDateTime(d time.Time) string {
	return d.Format("Jan _2 2006 03:04:05 PM")
}

func DisplayDate(d time.Time) string {
	return d.Format("Jan _2 2006")
}
