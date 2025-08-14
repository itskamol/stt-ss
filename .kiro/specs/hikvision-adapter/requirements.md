# Requirements Document

## Introduction

The Hikvision API Adapter is a critical component of the Sector Staff v2.1 system that provides seamless integration with Hikvision access control devices through their ISAPI protocol. This adapter implements the IDeviceAdapter interface and serves as a bridge between the system's business logic and Hikvision hardware, handling user management, face data operations, and secure authentication with the devices.

The adapter follows the Adapter design pattern to completely decouple the system's core business logic from the complexities of device communication. It provides clean, simple methods (addUser, deleteUser, getFaceData, etc.) that hide the underlying HTTP requests and ISAPI protocol details. This approach ensures flexibility for future device integrations, easier testing through mock implementations, and centralized device communication logic.

## Requirements

### Requirement 1: Device User Management

**User Story:** As a system administrator, I want to manage users on Hikvision devices through simple API calls, so that employee access can be synchronized automatically without manual device configuration.

#### Acceptance Criteria

1. WHEN adding a user THEN the adapter SHALL send HTTP POST request to `/ISAPI/AccessControl/UserInfo/Record?format=json` with proper authentication
2. WHEN updating a user THEN the adapter SHALL send HTTP PUT request with employeeNo as identifier and updated user data
3. WHEN deleting a user THEN the adapter SHALL send HTTP DELETE request to remove user from device by employeeNo
4. WHEN finding a user THEN the adapter SHALL send HTTP GET request and return DeviceUserInfo object or null if not found
5. IF device returns error status THEN the adapter SHALL throw appropriate NestJS exceptions (NotFoundException, BadRequestException, etc.)

### Requirement 2: Face Data Operations

**User Story:** As an employee management system, I want to retrieve and manage face recognition data from Hikvision devices, so that biometric authentication can be properly configured and maintained.

#### Acceptance Criteria

1. WHEN retrieving face data THEN the adapter SHALL use secure session authentication with identity keys
2. WHEN calling getFaceData THEN the adapter SHALL send GET request to `/ISAPI/Intelligent/FDLib?format=json&employeeNo={employeeNo}`
3. WHEN face data exists THEN the adapter SHALL return Buffer containing the face image data
4. WHEN face data doesn't exist THEN the adapter SHALL return null instead of throwing error
5. WHEN secure session is required THEN the adapter SHALL automatically obtain and cache session keys

### Requirement 3: Secure Authentication and Session Management

**User Story:** As a security-conscious system, I want all device communications to use proper authentication and session management, so that device access remains secure and credentials are protected.

#### Acceptance Criteria

1. WHEN authenticating with device THEN the adapter SHALL support both Basic and Digest authentication automatically through HttpService
2. WHEN secure operations are needed THEN the adapter SHALL obtain session keys from `/ISAPI/System/Security/identityKey` endpoint
3. WHEN session keys are obtained THEN the adapter SHALL cache them for 10 minutes to avoid repeated authentication requests
4. WHEN device credentials are needed THEN the adapter SHALL decrypt stored passwords using EncryptionService
5. IF authentication fails THEN the adapter SHALL throw UnauthorizedException with appropriate error message

### Requirement 4: Configuration and Device Management

**User Story:** As a system operator, I want device connection details to be securely stored and easily configurable, so that multiple Hikvision devices can be managed without hardcoding credentials.

#### Acceptance Criteria

1. WHEN connecting to device THEN the adapter SHALL read device details from Device table (host, username, encryptedSecret)
2. WHEN device is not found THEN the adapter SHALL throw NotFoundException with clear error message
3. WHEN device IP is not configured THEN the adapter SHALL throw NotFoundException indicating missing IP configuration
4. WHEN storing credentials THEN the system SHALL encrypt passwords using AES-256 with keys from environment variables
5. WHEN multiple devices exist THEN the adapter SHALL handle each device independently by deviceId

### Requirement 5: Error Handling and Resilience

**User Story:** As a system administrator, I want comprehensive error handling for device communication failures, so that the system remains stable and provides clear feedback when device issues occur.

#### Acceptance Criteria

1. WHEN device is unreachable THEN the adapter SHALL throw InternalServerErrorException with timeout details
2. WHEN device returns 401 Unauthorized THEN the adapter SHALL throw UnauthorizedException indicating credential issues
3. WHEN device returns 404 Not Found THEN the adapter SHALL throw NotFoundException for missing resources
4. WHEN device returns validation errors THEN the adapter SHALL throw BadRequestException with device error details
5. WHEN network errors occur THEN the adapter SHALL log detailed error information and throw InternalServerErrorException

### Requirement 6: Data Transfer Objects and Type Safety

**User Story:** As a developer, I want strongly typed interfaces and DTOs for all device operations, so that the code is maintainable and prevents runtime errors from incorrect data structures.

#### Acceptance Criteria

1. WHEN creating users THEN the adapter SHALL accept CreateDeviceUserDto with employeeNo, name, and userType fields
2. WHEN updating users THEN the adapter SHALL accept UpdateDeviceUserDto with optional name and userType fields
3. WHEN returning user data THEN the adapter SHALL return DeviceUserInfo interface with consistent structure
4. WHEN implementing adapter THEN it SHALL conform to IHikvisionAdapter interface contract
5. WHEN validating data THEN the adapter SHALL ensure userType is either 'normal' or 'visitor'

### Requirement 7: Caching and Performance Optimization

**User Story:** As a performance-conscious system, I want efficient caching of session data and minimal redundant device requests, so that the system responds quickly and doesn't overload devices with unnecessary calls.

#### Acceptance Criteria

1. WHEN obtaining session keys THEN the adapter SHALL cache them using device-specific cache keys
2. WHEN cache contains valid session THEN the adapter SHALL reuse cached session without new device requests
3. WHEN cache expires THEN the adapter SHALL automatically obtain new session keys and update cache
4. WHEN caching sessions THEN the adapter SHALL use TTL of 600 seconds (10 minutes)
5. WHEN multiple concurrent requests need sessions THEN the adapter SHALL prevent duplicate session requests

### Requirement 8: Logging and Observability

**User Story:** As a system operator, I want comprehensive logging of all device interactions, so that I can troubleshoot issues and monitor device communication health.

#### Acceptance Criteria

1. WHEN device operations fail THEN the adapter SHALL log error details with device ID and operation context
2. WHEN authentication issues occur THEN the adapter SHALL log authentication failures without exposing credentials
3. WHEN session management occurs THEN the adapter SHALL log session creation and cache operations
4. WHEN HTTP requests are made THEN the adapter SHALL use correlation IDs for request tracing
5. WHEN logging errors THEN the adapter SHALL include sufficient context for debugging without sensitive data

### Requirement 9: Testing and Mockability

**User Story:** As a developer, I want the adapter to be easily testable with mock implementations, so that business logic can be tested without requiring physical devices.

#### Acceptance Criteria

1. WHEN unit testing THEN all dependencies SHALL be mockable through dependency injection
2. WHEN testing HTTP operations THEN HttpService SHALL be mockable with predefined responses
3. WHEN testing encryption THEN EncryptionService SHALL be mockable for consistent test data
4. WHEN testing caching THEN Cache manager SHALL be mockable to verify caching behavior
5. WHEN integration testing THEN HTTP requests SHALL be interceptable using tools like nock or msw

### Requirement 10: Interface Compliance and Modularity

**User Story:** As a system architect, I want the Hikvision adapter to implement standard device interfaces, so that it can be easily replaced or extended with other device types in the future.

#### Acceptance Criteria

1. WHEN implementing adapter THEN it SHALL fully implement IHikvisionAdapter interface
2. WHEN registering adapter THEN it SHALL be injectable as a NestJS service with proper decorators
3. WHEN used by other services THEN it SHALL provide consistent method signatures across all operations
4. WHEN extending functionality THEN new methods SHALL follow established patterns and error handling
5. WHEN integrating with system THEN it SHALL work seamlessly with existing device management workflows