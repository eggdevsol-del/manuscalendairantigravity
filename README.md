# Artist Booking App

A full-stack Progressive Web App (PWA) for artists to manage client bookings, appointments, and communications.

## Features

- 📱 **Progressive Web App** - Install on mobile devices for app-like experience
- 💬 **Real-time Messaging** - Chat with clients directly in the app
- 📅 **Calendar Management** - Week and month views for appointments
- 👥 **Client Management** - Track and manage your client base
- ⚙️ **Customizable Settings** - Configure business info, work hours, and services
- 🔔 **Notifications** - Email and SMS notifications for bookings
- 🎨 **Modern UI** - Beautiful, mobile-first design with dark/light mode

## Tech Stack

### Frontend

- React 19
- Vite
- TailwindCSS
- Radix UI
- TanStack Query
- tRPC Client

### Backend

- Node.js / Express
- tRPC
- MySQL
- Drizzle ORM
- JWT Authentication

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm
- MySQL

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Set up database
mysql -u root -e "CREATE DATABASE artist_booking;"
pnpm db:push

# Start development server
pnpm dev
```

The app will be available at http://localhost:3000

## Development

```bash
# Start dev server with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run database migrations
pnpm db:push

# Type checking
pnpm check
```

## Deployment

This app is configured for deployment on Render.com. See [DEPLOY_INSTRUCTIONS.md](./DEPLOY_INSTRUCTIONS.md) for detailed deployment steps.

### Quick Deploy to Render

1. Push code to GitHub
2. Connect repository to Render
3. Render will auto-detect `render.yaml` and deploy

## Project Structure

```
artist-booking-app/
├── client/              # React frontend
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable components
│   │   └── _core/      # Core utilities
├── server/              # Express backend
│   ├── _core/          # Server core
│   └── routes/         # API routes (tRPC)
├── drizzle/            # Database schema
├── shared/             # Shared types/constants
└── dist/               # Build output
```

## Documentation

- [Development Guide](./DEVELOPMENT.md) - Detailed development instructions
- [Deployment Guide](./DEPLOY_INSTRUCTIONS.md) - How to deploy to production
- [Deployment Guide](./DEPLOY_INSTRUCTIONS.md) - How to deploy to production
- [Deployment Technical](./DEPLOYMENT.md) - Technical deployment details

## UI Systems

- [BottomNav System](./docs/bottom-nav.md) - Architecture and interaction model for the 2D navigation system.

## Features Roadmap

- [x] User authentication
- [x] Chat messaging
- [x] Calendar views
- [x] Settings management
- [x] PWA support
- [ ] Appointment booking flow
- [ ] Policy management
- [ ] Email/SMS notifications
- [ ] Social media integration
- [ ] Payment processing

## License

MIT

## Support

For questions or issues, please open an issue on GitHub.
