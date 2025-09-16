package models

import "time"

type ID struct {
	ID int `json:"id"`
}

type Created struct {
	CreatedAt time.Time `json:"createdAt"`
}

type Updated struct {
	UpdatedAt time.Time `json:"updatedAt"`
}
