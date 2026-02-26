# Artist Booking App - Development Guide

## Quick Start

The application has been rebuilt and is ready for development.

### Starting the Development Server

```bash
cd /home/ubuntu/artist-booking-app
pnpm dev
```

The server will start on **http://localhost:3000**

### Database Access

```bash
# Access MySQL
mysql -u root artist_booking

# View tables
SHOW TABLES;

# View users
SELECT id, name, email, role FROM users;
```

### Test Users

**Artist Account:**

- ID: `test_artist_001`
- Name: P Mason Tattoo Artist
- Email: piripimason@gmail.com
- Role: artist

**Client Account:**

- ID: `test_client_001`
- Name: Test Client
- Email: testclient@example.com
- Role: client

**Demo Client (from demo data):**

- ID: `demo-client-1760861544872`
- Name: Sarah Johnson
- Email: sarah.demo@example.com
- Role: client

### Authentication for Development

Since OAuth requires IP whitelisting, use this session token for testing:

**Artist Session Token:**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0X2FydGlzdF8wMDEiLCJpYXQiOjE3Mjk2MzI3NTN9.IpVLTqRbmxGCgGqhOr_HH2BKQQ-c6cBbqIqWZkZRtWo
```

**Client Session Token:**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0X2NsaWVudF8wMDEiLCJpYXQiOjE3Mjk2MzI3NTN9.3z_Qs4Rl8K5vN2pT6xW9jY1mC7bH3sF4gD8eA5nL2oP
```

To set the session cookie in the browser console:

```javascript
document.cookie =
  "artist_booking_session=YOUR_TOKEN_HERE; path=/; max-age=31536000";
```

## Project Structure

```
artist-booking-app/
├── client/              # React frontend
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable components
│   │   ├── _core/      # Core utilities and hooks
│   │   └── App.tsx     # Main app component
│   └── index.html
├── server/              # Express backend
│   ├── _core/          # Core server setup
│   ├── routes/         # API routes (tRPC)
│   └── utils/          # Server utilities
├── drizzle/            # Database schema and migrations
│   └── schema.ts       # Database schema definitions
├── shared/             # Shared code between client/server
│   └── const.ts        # Shared constants
└── package.json
```

## Technology Stack

### Frontend

- **React 19** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Radix UI** - Component primitives
- **TanStack Query** - Data fetching and caching
- **Wouter** - Routing
- **tRPC Client** - Type-safe API calls

### Backend

- **Express** - Web server
- **tRPC** - Type-safe API
- **Drizzle ORM** - Database ORM
- **MySQL** - Database
- **JWT** - Authentication

## Database Schema

The app uses the following main tables:

- **users** - User accounts (artists and clients)
- **artistSettings** - Artist-specific settings
- **conversations** - Chat conversations between artists and clients
- **messages** - Individual chat messages
- **appointments** - Scheduled appointments
- **consultations** - Consultation requests
- **policies** - Artist policies (deposit, cancellation, etc.)
- **quickActionButtons** - Customizable chat quick actions
- **notificationTemplates** - Email/SMS notification templates
- **pushSubscriptions** - PWA push notification subscriptions
- **socialMessageSync** - Social media message integration

## Key Features

### Implemented

- ✅ User authentication (JWT-based)
- ✅ Artist and client roles
- ✅ Chat/messaging system
- ✅ Calendar views (week/month)
- ✅ Settings management
- ✅ Demo data loading
- ✅ PWA support
- ✅ Mobile-first responsive design

### Partially Implemented

- ⚠️ OAuth integration (requires IP whitelisting)
- ⚠️ Social media integration (Instagram/Facebook)
- ⚠️ Email/SMS notifications
- ⚠️ Appointment booking flow
- ⚠️ Policy management

## Development Workflow

### Making Changes

1. **Frontend changes** - Edit files in `client/src/`
   - Vite will hot-reload changes automatically

2. **Backend changes** - Edit files in `server/`
   - tsx watch will restart the server automatically

3. **Database changes** - Edit `drizzle/schema.ts`
   - Run `pnpm db:push` to apply changes

### Adding New Features

1. **Add tRPC route** in `server/routes/`
2. **Create page component** in `client/src/pages/`
3. **Add route** in `client/src/App.tsx`
4. **Update database schema** if needed in `drizzle/schema.ts`

### Testing

The app includes a demo data loader accessible from Settings:

- Creates test client "Sarah Johnson"
- Creates sample conversation with messages
- Creates sample appointment

## Environment Variables

The `.env` file contains:

```env
DATABASE_URL=mysql://root@localhost:3306/artist_booking
JWT_SECRET=your-secret-key-here-change-in-production
NODE_ENV=development
OAUTH_BASE_URL=https://vidabiz.butterfly-effect.dev
```

## Common Tasks

### Reset Database

```bash
mysql -u root -e "DROP DATABASE artist_booking; CREATE DATABASE artist_booking;"
cd /home/ubuntu/artist-booking-app
pnpm db:push
```

### View Server Logs

The development server outputs logs to the console where `pnpm dev` is running.

### Access Database

```bash
mysql -u root artist_booking
```

### Build for Production

```bash
pnpm build
```

## Troubleshooting

### Port 3000 Already in Use

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues

```bash
# Restart MySQL
sudo service mysql restart
```

### Clear Node Modules

```bash
rm -rf node_modules
pnpm install
```

## Next Steps

Based on the project requirements, consider implementing:

1. **Appointment booking flow** - Complete the consultation/booking process
2. **Policy management** - Allow artists to customize policies
3. **Notification system** - Email/SMS confirmations
4. **Social media integration** - Instagram/Facebook message sync
5. **Quick action buttons** - Customizable chat actions
6. **Client onboarding** - Tutorial for first-time users
7. **OAuth configuration** - Set up proper authentication
8. **Calendar integration** - Sync with external calendars

## Resources

- [React Documentation](https://react.dev)
- [tRPC Documentation](https://trpc.io)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [TailwindCSS Documentation](https://tailwindcss.com)
- [Radix UI Documentation](https://www.radix-ui.com)

---

**Last Updated:** October 19, 2025  
**Status:** Ready for Development
