package services

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DbServiceBaseConfig struct {
	QueryTimeout time.Duration
	DB           *pgxpool.Pool
	PageSize     int
}

type DbServiceBase struct {
	QueryTimeout time.Duration
	DB           *pgxpool.Pool
	PageSize     int
}

func (s DbServiceBase) GetContext() (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithTimeout(context.Background(), s.QueryTimeout)
	return ctx, cancel
}

func (s DbServiceBase) IsDuplicateRecordError(err error) bool {
	return strings.Contains(err.Error(), "duplicate key value violates unique constraint")
}

func (s DbServiceBase) Paging(page int) int {
	offset := (page - 1) * s.PageSize
	return offset
}
