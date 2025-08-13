// jest.setup.js

// Set a longer timeout for all tests
jest.setTimeout(30000); // 30 seconds

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
// IMPORTANT: Use fixed keys for predictable encryption in tests
process.env.SECRET_ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'; // 64 hex characters (32 bytes)
process.env.SECRET_ENCRYPTION_IV = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';     // 32 hex characters (16 bytes)
process.env.JWT_SECRET = 'your-super-secret-jwt-key-for-testing-only-do-not-use-in-prod';
process.env.JWT_EXPIRATION = '15m';
process.env.LOG_LEVEL = 'error'; // Keep test output clean
