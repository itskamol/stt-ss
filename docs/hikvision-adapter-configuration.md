# Hikvision Adapter Configuration

This document describes the configuration options for the Hikvision Device Adapter.

## Required Environment Variables

These environment variables are required for the adapter to function properly:

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_ENCRYPTION_KEY` | 32-byte encryption key (64 hex characters) | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` |
| `SECRET_ENCRYPTION_IV` | 16-byte initialization vector (32 hex characters) | `0123456789abcdef0123456789abcdef` |

## Optional Environment Variables

### Adapter Settings

| Variable | Description | Default | Valid Values |
|----------|-------------|---------|--------------|
| `DEVICE_ADAPTER_TYPE` | Type of device adapter to use | `auto` | `hikvision`, `stub`, `auto` |
| `USE_STUB_ADAPTER` | Force use of stub adapter | `false` | `true`, `false` |
| `ENABLE_HEALTH_CHECKS` | Enable adapter health monitoring | `true` | `true`, `false` |
| `ENABLE_METRICS` | Enable performance metrics collection | `true` | `true`, `false` |
| `LOG_LEVEL` | Logging level | `info` | `debug`, `info`, `warn`, `error` |

### HTTP Settings

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `HIKVISION_HTTP_TIMEOUT` | HTTP request timeout (ms) | `10000` | 5000-30000 |
| `HIKVISION_MAX_RETRIES` | Maximum retry attempts | `3` | 1-10 |
| `HIKVISION_RETRY_DELAY` | Delay between retries (ms) | `1000` | 100-10000 |
| `HIKVISION_ENABLE_KEEP_ALIVE` | Enable HTTP keep-alive | `true` | `true`, `false` |
| `HIKVISION_MAX_SOCKETS` | Maximum concurrent sockets | `100` | 10-1000 |

### Cache Settings

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `HIKVISION_SESSION_TTL` | Session cache TTL (seconds) | `600` | 60-3600 |
| `HIKVISION_MAX_SESSIONS` | Maximum cached sessions | `1000` | 10-10000 |
| `HIKVISION_DEVICE_INFO_TTL` | Device info cache TTL (seconds) | `3600` | 60-86400 |
| `HIKVISION_ENABLE_COMPRESSION` | Enable cache compression | `false` | `true`, `false` |

### Discovery Settings

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `HIKVISION_DISCOVERY_TIMEOUT` | Device discovery timeout (ms) | `10000` | 1000-30000 |
| `HIKVISION_MAX_CONCURRENT_SCANS` | Max concurrent network scans | `20` | 1-100 |
| `HIKVISION_DEFAULT_NETWORK_RANGE` | Default network range for discovery | `192.168.1.0/24` | CIDR notation |
| `HIKVISION_DEFAULT_PORTS` | Default ports to scan (comma-separated) | `80,8000,8080` | Port numbers |
| `HIKVISION_ENABLE_UPNP_DISCOVERY` | Enable UPnP device discovery | `true` | `true`, `false` |
| `HIKVISION_ENABLE_BROADCAST_DISCOVERY` | Enable broadcast discovery | `true` | `true`, `false` |

### Event Settings

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `HIKVISION_USE_WEBSOCKET` | Use WebSocket for events | `true` | `true`, `false` |
| `HIKVISION_POLLING_INTERVAL` | Event polling interval (ms) | `5000` | 1000-60000 |
| `HIKVISION_MAX_RECONNECT_ATTEMPTS` | Max reconnection attempts | `5` | 1-10 |
| `HIKVISION_RECONNECT_DELAY` | Reconnection delay (ms) | `2000` | 1000-30000 |
| `HIKVISION_DEFAULT_EVENT_TYPES` | Default event types (comma-separated) | `access_granted,access_denied,door_opened,door_closed` | Event type names |

### Maintenance Settings

| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `HIKVISION_ENABLE_AUTOMATIC_BACKUP` | Enable automatic config backup | `true` | `true`, `false` |
| `HIKVISION_LOG_RETENTION_DAYS` | Log retention period (days) | `30` | 1-365 |
| `HIKVISION_HEALTH_CHECK_INTERVAL_HOURS` | Health check interval (hours) | `6` | 1-24 |
| `HIKVISION_ENABLE_FIRMWARE_UPDATE_NOTIFICATIONS` | Enable firmware update notifications | `true` | `true`, `false` |
| `HIKVISION_MAINTENANCE_WINDOW` | Maintenance window (HH:mm-HH:mm) | `02:00-04:00` | Time range |

## Configuration Examples

### Development Environment

```bash
# Required
SECRET_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
SECRET_ENCRYPTION_IV=0123456789abcdef0123456789abcdef

# Development settings
DEVICE_ADAPTER_TYPE=stub
USE_STUB_ADAPTER=true
LOG_LEVEL=debug
ENABLE_METRICS=false

# Reduced timeouts for faster development
HIKVISION_HTTP_TIMEOUT=5000
HIKVISION_SESSION_TTL=300
HIKVISION_DISCOVERY_TIMEOUT=5000
HIKVISION_MAX_CONCURRENT_SCANS=5
```

### Production Environment

```bash
# Required
SECRET_ENCRYPTION_KEY=your-production-encryption-key-here
SECRET_ENCRYPTION_IV=your-production-iv-here

# Production settings
DEVICE_ADAPTER_TYPE=hikvision
USE_STUB_ADAPTER=false
LOG_LEVEL=info
ENABLE_HEALTH_CHECKS=true
ENABLE_METRICS=true

# Optimized for production
HIKVISION_HTTP_TIMEOUT=10000
HIKVISION_MAX_RETRIES=3
HIKVISION_SESSION_TTL=600
HIKVISION_MAX_SESSIONS=1000
HIKVISION_DISCOVERY_TIMEOUT=10000
HIKVISION_MAX_CONCURRENT_SCANS=20

# Event settings
HIKVISION_USE_WEBSOCKET=true
HIKVISION_POLLING_INTERVAL=5000
HIKVISION_MAX_RECONNECT_ATTEMPTS=5

# Maintenance
HIKVISION_ENABLE_AUTOMATIC_BACKUP=true
HIKVISION_LOG_RETENTION_DAYS=30
HIKVISION_HEALTH_CHECK_INTERVAL_HOURS=6
```

### High-Performance Environment

```bash
# Required
SECRET_ENCRYPTION_KEY=your-encryption-key
SECRET_ENCRYPTION_IV=your-iv

# High-performance settings
DEVICE_ADAPTER_TYPE=hikvision
HIKVISION_HTTP_TIMEOUT=15000
HIKVISION_MAX_RETRIES=5
HIKVISION_ENABLE_KEEP_ALIVE=true
HIKVISION_MAX_SOCKETS=200

# Aggressive caching
HIKVISION_SESSION_TTL=1800
HIKVISION_MAX_SESSIONS=5000
HIKVISION_DEVICE_INFO_TTL=7200
HIKVISION_ENABLE_COMPRESSION=true

# Fast discovery
HIKVISION_DISCOVERY_TIMEOUT=15000
HIKVISION_MAX_CONCURRENT_SCANS=50

# Real-time events
HIKVISION_USE_WEBSOCKET=true
HIKVISION_POLLING_INTERVAL=2000
HIKVISION_MAX_RECONNECT_ATTEMPTS=10
HIKVISION_RECONNECT_DELAY=1000
```

## Configuration Validation

The adapter includes built-in configuration validation that checks:

- Required environment variables are present
- Values are within acceptable ranges
- Configuration is suitable for the target environment
- Encryption keys are properly formatted

### Validation Errors

Common validation errors and solutions:

| Error | Solution |
|-------|----------|
| Missing required environment variables | Set `SECRET_ENCRYPTION_KEY` and `SECRET_ENCRYPTION_IV` |
| Encryption key too short | Use 64 hex characters (32 bytes) |
| Invalid timeout value | Use values between 5000-30000ms |
| Invalid network range | Use CIDR notation (e.g., `192.168.1.0/24`) |
| Invalid maintenance window | Use HH:mm-HH:mm format |

### Configuration Health Check

The adapter performs health checks on configuration:

- **Encryption**: Validates key lengths and formats
- **HTTP**: Checks timeout and retry settings
- **Cache**: Validates TTL and size limits
- **Discovery**: Checks network range and concurrency
- **Events**: Validates intervals and retry settings
- **Maintenance**: Checks retention and window settings

## Security Considerations

### Encryption Keys

- Generate unique keys for each environment
- Use cryptographically secure random generation
- Store keys securely (environment variables, secrets management)
- Rotate keys periodically
- Never commit keys to version control

### Network Security

- Use HTTPS for device communication in production
- Implement network segmentation for device networks
- Use VPNs for remote device access
- Monitor network traffic for anomalies

### Access Control

- Use strong device passwords
- Implement role-based access control
- Regularly audit device access logs
- Disable unused device features

## Performance Tuning

### High-Throughput Scenarios

- Increase `HIKVISION_MAX_SOCKETS` for more concurrent connections
- Reduce `HIKVISION_POLLING_INTERVAL` for faster event processing
- Increase `HIKVISION_MAX_SESSIONS` for better caching
- Enable `HIKVISION_ENABLE_COMPRESSION` to reduce memory usage

### Low-Latency Requirements

- Use WebSocket events (`HIKVISION_USE_WEBSOCKET=true`)
- Reduce `HIKVISION_HTTP_TIMEOUT` for faster failure detection
- Increase `HIKVISION_MAX_CONCURRENT_SCANS` for faster discovery
- Use shorter `HIKVISION_SESSION_TTL` for fresher sessions

### Resource-Constrained Environments

- Use stub adapter for testing (`USE_STUB_ADAPTER=true`)
- Reduce `HIKVISION_MAX_SESSIONS` to save memory
- Increase `HIKVISION_POLLING_INTERVAL` to reduce CPU usage
- Disable metrics (`ENABLE_METRICS=false`) to save resources

## Troubleshooting

### Common Issues

1. **Connection Timeouts**
   - Increase `HIKVISION_HTTP_TIMEOUT`
   - Check network connectivity
   - Verify device IP addresses

2. **Authentication Failures**
   - Verify encryption keys are correct
   - Check device credentials
   - Ensure proper key format (hex)

3. **High Memory Usage**
   - Reduce `HIKVISION_MAX_SESSIONS`
   - Enable compression
   - Reduce cache TTL values

4. **Slow Discovery**
   - Increase `HIKVISION_MAX_CONCURRENT_SCANS`
   - Reduce network range
   - Optimize port list

### Debug Mode

Enable debug logging for troubleshooting:

```bash
LOG_LEVEL=debug
```

This provides detailed information about:
- HTTP requests and responses
- Session management
- Cache operations
- Device discovery
- Event processing
- Error details

## Migration Guide

### From Stub to Hikvision Adapter

1. Set up encryption keys
2. Configure device credentials
3. Update adapter type: `DEVICE_ADAPTER_TYPE=hikvision`
4. Test connectivity with a single device
5. Gradually add more devices
6. Monitor performance and adjust settings

### Configuration Updates

When updating configuration:

1. Validate new settings first
2. Update in staging environment
3. Monitor health checks
4. Apply to production during maintenance window
5. Verify all devices are functioning
6. Roll back if issues occur