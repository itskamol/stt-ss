# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
# Start development server
pnpm run start:dev

# Build application
pnpm run build

# Run linting
pnpm run lint

# Format code
pnpm run format

# Run tests
pnpm run test

# Run tests with coverage
pnpm run test:cov

# Run tests in watch mode
pnpm run test:watch
```

### Database Operations
```bash
# Generate Prisma client
pnpm run db:generate

# Run migrations
pnpm run db:migrate

# Push schema changes (development only)
pnpm run db:push

# Open Prisma Studio
pnpm run db:studio

# Seed database with test data
pnpm run db:seed
```

### Environment-Specific Commands
```bash
# Start production server
pnpm run start:prod

# Start staging server
pnpm run start:staging

# Start in Docker environment
pnpm run start:docker
```

## Architecture Overview

### Core Architecture
This is a NestJS-based multi-organization attendance tracking system with the following key characteristics:

- **Multi-tenant Architecture**: Complete data isolation between organizations using organization-scoped queries
- **Hierarchical Structure**: Organization → Branch → Department → Employee
- **Role-Based Access Control**: SUPER_ADMIN, ORG_ADMIN, BRANCH_MANAGER, EMPLOYEE
- **Event-Driven Processing**: Device events processed asynchronously via BullMQ queues
- **Comprehensive Auditing**: All actions logged with organization context

### Key Security Features
- **Data Scoping**: `DataScopeGuard` enforces organization-level data isolation
- **JWT Authentication**: Token-based auth with refresh tokens
- **Role Authorization**: Hierarchical role-based permissions
- **Audit Logging**: Complete audit trail with `AuditLogInterceptor`

### Project Structure
```
src/
├── app/                     # Main application module
├── core/                    # Core infrastructure
│   ├── config/              # Configuration management
│   ├── database/            # Prisma service
│   ├── logger/              # Structured logging
│   ├── cache/               # Redis caching
│   └── queue/               # BullMQ job processing
├── shared/                  # Shared utilities
│   ├── decorators/          # Custom decorators (@Public, @Roles, @Scope)
│   ├── dto/                 # Data transfer objects
│   ├── guards/              # Security guards
│   ├── interceptors/        # Request interceptors
│   ├── interfaces/          # Type definitions
│   └── utils/               # Helper functions
└── modules/                 # Business modules
    ├── auth/                # Authentication
    ├── organization/        # Organization management
    ├── user/                # User management
    ├── branch/              # Branch management
    ├── department/          # Department management
    ├── employee/            # Employee management
    ├── device/              # Device integration
    ├── attendance/          # Attendance tracking
    ├── guest/               # Guest management
    ├── events/              # Event processing
    └── reporting/           # Report generation
```

### Database Schema
The database uses a hierarchical organization model:
- **Organization**: Top-level tenant with complete data isolation
- **Branch**: Physical locations within organizations
- **Department**: Organizational units within branches
- **Employee**: Users within departments
- **Device**: Physical devices (cameras, card readers, etc.)
- **GuestVisit**: Visitor management with approval workflows
- **Attendance**: Time tracking records from device events
- **AuditLog**: Comprehensive audit trail

### Import Conventions
- Use absolute imports with `@/` prefix
- Core modules: `@/core/*`
- Shared utilities: `@/shared/*`
- Business modules: `@/modules/*`

### Testing Patterns
- Jest for unit and integration tests
- Testcontainers for database testing
- All test files follow `*.spec.ts` naming convention
- Use test environment with `NODE_ENV=test`

### Development Guidelines
- Always use the `DataScopeGuard` for organization data isolation
- Implement proper error handling with `GlobalExceptionFilter`
- Use structured logging with `LoggerService`
- Follow the established module structure for new features
- Implement proper audit logging for all data modifications
- Use DTOs for all API input validation
- Follow the role-based access control patterns

### Environment Configuration
- Environment-specific configs in `config/environments/`
- Use `ConfigService` for all environment variable access
- Required variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
- JWT secrets must be at least 32 characters long
- Use pnpm for package management (`pnpm install` instead of `npm install`)

### Code Style
- ESLint configuration in `eslint.config.mjs`
- TypeScript with strict mode disabled for legacy compatibility
- Use prettier for code formatting
- Follow NestJS conventions for module structure
- Use dependency injection pattern throughout

### Database Operations
- Always use Prisma for database operations
- Migrations are required for schema changes
- Use the repository pattern for data access
- Implement proper transaction management
- Always include organization context in queries