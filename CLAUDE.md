# Streaming Tracker Application

## Overview

Streaming Tracker is a web application built with Remix and SQLite that helps manage and track TV shows across different streaming platforms. The application allows users to organize their viewing habits, maintain watchlists, and coordinate what family members are watching.

## Core Functionality

### Show Management
- **Track viewing status**: Shows can be marked as "Want to Watch", "In Progress", or "Finished"
- **Season progression**: Track current season and automatically advance or mark complete
- **Multi-user support**: Multiple family members can watch the same show with individual progress
- **Platform organization**: Shows are categorized by streaming platform (Netflix, Hulu, etc.)

### User Features
- **Dashboard**: Main view showing currently watching and want-to-watch shows grouped by viewers
- **Show management**: Add, edit, and delete shows with search and pagination
- **Admin controls**: Manage users and streaming platforms
- **Authentication**: Simple password-based authentication system

### Database Schema
The application uses four main entities:
- **Users**: Family members who watch shows
- **Platforms**: Streaming services (Netflix, Hulu, etc.)
- **Shows**: TV series with season information
- **ShowsToUsers**: Junction table tracking each user's progress per show

## Technical Stack

- **Framework**: Remix (React-based full-stack framework)
- **Database**: SQLite with Drizzle ORM
- **Styling**: Custom CSS
- **Authentication**: Session-based auth with password protection
- **Development**: TypeScript, Vite, ESLint

## Key Routes

- `/` - Dashboard showing current viewing status
- `/shows/manage` - Show management with search and pagination
- `/shows/new` - Add new shows
- `/shows/finished` - View completed shows
- `/admin/users` - User management
- `/admin/platforms` - Platform management

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with initial data
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript checks

## Deployment

The application supports both traditional deployment and Docker containerization, with environment variables for database path, authentication, and pagination settings.

## AI Rules

1. Before you change any code, first display a plan outlining what components and code is going to change, the nature of each change, and a short summary of why you are going to change it. Wait for approval before making any code changes.
2. Do not introduce new 3rd party libraries or dependencies without first consulting me, and telling my why you have to add a new dependency

