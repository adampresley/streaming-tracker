# Streaming Tracker

Streaming Tracker is an application designed for my family to keep track of who is streaming what. It also allows me to keep a watchlist of upcoming shows and those recommended by friends. This application is written in Remix and uses SQLite.

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Installation

1. Clone the repository:
   git clone https://github.com/your-username/streaming-tracker.git
   cd streaming-tracker

2. Install dependencies:
   npm install

3. Set up the environment variables:
   cp .env.example .env

Edit the `.env` file and fill in the necessary values.

4. Initialize the database:
   npm run db:migrate

### Running the Application

1. Start the development server:
   npm run dev

2. Open your browser and navigate to `http://localhost:3000`

### Building for Production

1. Build the application:
   npm run build

2. Start the production server:
   npm start

## Using Docker Compose

If you prefer to run the application using Docker, follow these steps:

1. Make sure you have Docker and Docker Compose installed on your system.
2. A sample `compose.yml` file is provided in the project. Review and modify it if necessary to suit your needs.
3. Build and run the Docker container:
   docker compose up --build

4. Access the application at `http://localhost:3000`

To stop the Docker container, use:
docker compose down
