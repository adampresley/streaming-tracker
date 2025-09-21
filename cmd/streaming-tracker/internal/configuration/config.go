package configuration

import (
	"time"

	"github.com/adampresley/configinator"
)

type Config struct {
	DataMigrationDir   string        `flag:"migrationdir" env:"DATA_MIGRATION_DIR" default:"../../sql-migrations" description:"Directory containing SQL migration scripts"`
	DSN                string        `flag:"dsn" env:"DSN" default:"host=localhost dbname=streamingtracker user=streamingtracker password=password port=5432 sslmode=disable" description:"Database connection"`
	EmailApiKey        string        `flag:"emailapikey" env:"EMAIL_API_KEY" default:"" description:"The API key for sending emails"`
	EmailDomain        string        `flag:"emaildomain" env:"EMAIL_DOMAIN" default:"" description:"The domain for sending emails"`
	EmailFrom          string        `flag:"emailfrom" env:"EMAIL_FROM" default:"noreply@example.com" description:"The email address to use for sending emails"`
	EmailHost          string        `flag:"emailhost" env:"EMAIL_HOST" default:"localhost" description:"The SMTP host for sending emails"`
	EmailPort          int           `flag:"emailport" env:"EMAIL_PORT" default:"2500" description:"The SMTP port for sending emails"`
	Host               string        `flag:"host" env:"HOST" default:"localhost:8080" description:"The address and port to bind the HTTP server to"`
	LogLevel           string        `flag:"loglevel" env:"LOG_LEVEL" default:"debug" description:"The log level to use. Valid values are 'debug', 'info', 'warn', and 'error'"`
	PageSize           int           `flag:"pagesize" env:"PAGE_SIZE" default:"20" description:"The number of items to display per page"`
	QueryTimeout       time.Duration `flag:"querytimeout" env:"QUERY_TIMEOUT" default:"10s" description:"The maximum time to wait for a query to complete"`
	TLD                string        `flag:"tld" env:"TLD" default:"http://localhost:8080" description:"The top-level domain for email addresses"`
	TvmazeBaseURL      string        `flag:"tvmazebaseurl" env:"TVMAZE_BASE_URL" default:"https://api.tvmaze.com" description:"The base URL for the tvmaze api"`
	UtellyApiKey       string        `flag:"utellyapikey" env:"UTELLY_API_KEY" default:"" description:"The API key for Utelly"`
	UtellyBaseURL      string        `flag:"utellybaseurl" env:"UTELLY_BASE_URL" default:"https://utelly-tv-shows-and-movies-availability-v1.p.rapidapi.com" description:"The base URL for Utelly"`
	UtellyRapidApiHost string        `flag:"utellyrapidapihost" env:"UTELLY_RAPIDAPI_HOST" default:"utelly-tv-shows-and-movies-availability-v1.p.rapidapi.com" description:""`
}

func LoadConfig() Config {
	config := Config{}
	configinator.Behold(&config)
	return config
}
