# Environment Setup - Simple Guide

## Quick Start

1. **Setup environment:**
   ```bash
   ./scripts/setup.sh
   ```

2. **Start development:**
   ```bash
   ./scripts/docker-env.sh dev up
   ```

3. **Open application:**
   ```
   http://localhost:3001/api/v1
   ```

## Environment Files

```
config/environments/
├── .env.example     # Template (copy this)
├── local.env        # Your local settings
├── dev.env          # Development
├── staging.env      # Staging
└── prod.env         # Production
```

## Common Commands

```bash
# Development
./scripts/docker-env.sh dev up        # Start
./scripts/docker-env.sh dev down      # Stop
./scripts/docker-env.sh dev logs      # View logs
./scripts/docker-env.sh dev restart   # Restart

# Production
./scripts/docker-env.sh prod up       # Start production
./scripts/docker-env.sh prod down     # Stop production
```

## Environment Variables

### Required
- `DATABASE_URL` - Database connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT secret key
- `REFRESH_TOKEN_SECRET` - Refresh token secret

### Optional
- `APP_PORT` - Application port (default: 3001 for dev)
- `POSTGRES_PORT` - PostgreSQL port (default: 5433)
- `REDIS_PORT` - Redis port (default: 6380)

## Creating New Environment

1. Copy template:
   ```bash
   cp config/environments/.env.example config/environments/myenv.env
   ```

2. Edit values:
   ```bash
   nano config/environments/myenv.env
   ```

3. Use it:
   ```bash
   ./scripts/docker-env.sh myenv up
   ```

## Troubleshooting

### Redis Connection Error
If you see `connect ECONNREFUSED 127.0.0.1:6379`:
- Make sure `REDIS_URL=redis://redis:6379` (not localhost)

### Database Connection Error
If you see database connection errors:
- Make sure `DATABASE_URL` uses `postgres:5432` (not localhost)

### Port Already in Use
```bash
# Check what's using the port
lsof -i :3001

# Kill the process
kill -9 <PID>
```

## Production Deployment

1. Create production environment:
   ```bash
   cp config/environments/.env.example config/environments/prod.env
   ```

2. Edit production values:
   ```bash
   nano config/environments/prod.env
   ```

3. Deploy:
   ```bash
   ./scripts/docker-env.sh prod up
   ```

That's it! Simple and practical. 🚀