package models

type Platform struct {
	ID
	Created
	Updated
	Name string `json:"name"`
	Icon string `json:"icon"`
}
