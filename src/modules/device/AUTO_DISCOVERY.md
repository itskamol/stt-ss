# Device Auto-Discovery Feature

Bu feature device yaratish jarayonini soddalashtiradi. Foydalanuvchi faqat asosiy ulanish ma'lumotlarini (IP, port, username, password) bersa, tizim avtomatik ravishda qolgan ma'lumotlarni device'dan oladi.

## 🚀 Yangi Endpointlar

### 1. Auto-Discovery bilan Device Yaratish

**POST** `/api/devices/auto-discover`

Minimal ma'lumotlar bilan device yaratadi va qolgan ma'lumotlarni avtomatik oladi.

#### Request Body:
```json
{
  "name": "Main Entrance Device",
  "ipAddress": "192.168.1.100",
  "port": 80,
  "username": "admin",
  "password": "password123",
  "branchId": "branch-uuid",
  "organizationId": "org-uuid",
  "departmentId": "dept-uuid", // optional
  "protocol": "HTTP", // optional, default: HTTP
  "description": "Access control device" // optional
}
```

#### Response:
```json
{
  "id": "device-uuid",
  "name": "Main Entrance Device",
  "type": "ACCESS_CONTROL",
  "deviceIdentifier": "HK_192168001100_1234567890",
  "ipAddress": "192.168.1.100",
  "port": 80,
  "protocol": "HTTP",
  "macAddress": "00:11:22:33:44:55", // auto-discovered
  "manufacturer": "Hikvision", // auto-discovered
  "model": "DS-K1T341AMF", // auto-discovered
  "firmware": "V1.2.3 build 20240101", // auto-discovered
  "description": "Access control device",
  "status": "ONLINE",
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 2. Device Ma'lumotlarini Test Qilish

**POST** `/api/devices/discover-info`

Device yaratmasdan, faqat ulanish va ma'lumotlarni test qiladi.

#### Request Body:
```json
{
  "ipAddress": "192.168.1.100",
  "port": 80,
  "username": "admin",
  "password": "password123",
  "protocol": "HTTP" // optional
}
```

#### Response:
```json
{
  "connected": true,
  "manufacturer": "Hikvision",
  "model": "DS-K1T341AMF",
  "firmware": "V1.2.3 build 20240101",
  "macAddress": "00:11:22:33:44:55",
  "deviceIdentifier": "HK_192168001100_1234567890",
  "capabilities": ["ACCESS_CONTROL", "FACE_RECOGNITION", "CARD_READER"],
  "status": "ONLINE",
  "discoveredAt": "2024-01-15T10:30:00Z"
}
```

## 🔧 Qanday Ishlaydi

### 1. Auto-Discovery Jarayoni

```typescript
// 1. Ulanish ma'lumotlari bilan device'ga ulanish
const tempDeviceConfig = {
  host: ipAddress,
  port: port,
  username: username,
  password: password,
  protocol: protocol || 'HTTP'
};

// 2. Device adapter orqali ma'lumot olish
const deviceInfo = await deviceAdapterStrategy.getDeviceInfo(
  tempId, 
  tempDeviceConfig
);

// 3. Ma'lumotlarni tahlil qilish va ajratish
const discoveredInfo = {
  manufacturer: extractManufacturer(deviceInfo), // Hikvision, ZKTeco, etc.
  model: deviceInfo.name || 'Unknown Model',
  firmware: deviceInfo.firmwareVersion || 'Unknown',
  macAddress: extractMacAddress(deviceInfo),
  deviceIdentifier: generateUniqueId(deviceInfo),
  capabilities: deviceInfo.capabilities || []
};
```

### 2. Manufacturer Aniqlash

```typescript
private extractManufacturer(deviceInfo: any): string {
  const name = (deviceInfo.name || '').toLowerCase();
  
  if (name.includes('hikvision')) return 'Hikvision';
  if (name.includes('zkteco')) return 'ZKTeco';
  if (name.includes('dahua')) return 'Dahua';
  if (name.includes('suprema')) return 'Suprema';
  if (name.includes('anviz')) return 'Anviz';
  
  return 'Unknown';
}
```

### 3. MAC Address Ajratish

```typescript
private extractMacAddress(deviceInfo: any): string | null {
  // Turli maydonlardan MAC address qidirish
  if (deviceInfo.macAddress) return deviceInfo.macAddress;
  if (deviceInfo.networkInfo?.macAddress) return deviceInfo.networkInfo.macAddress;
  if (deviceInfo.hardware?.macAddress) return deviceInfo.hardware.macAddress;
  
  return null;
}
```

## 📋 Qo'llab-quvvatlanadigan Device Turlari

### Hikvision Devices
- **Manufacturer**: Hikvision
- **Models**: DS-K1T341AMF, DS-K1T804MF, va boshqalar
- **Protocol**: HTTP/HTTPS
- **Port**: 80/443
- **API**: ISAPI

### ZKTeco Devices
- **Manufacturer**: ZKTeco
- **Models**: SpeedFace-V5L, InBio, va boshqalar
- **Protocol**: HTTP
- **Port**: 80
- **API**: ZK Protocol

### Dahua Devices
- **Manufacturer**: Dahua
- **Models**: ASI1201A, DHI-ASI1201A, va boshqalar
- **Protocol**: HTTP/HTTPS
- **Port**: 80/443
- **API**: Dahua API

## 🛠️ Frontend Integration

### React/Vue.js Example

```javascript
// 1. Device ma'lumotlarini test qilish
const testDevice = async (connectionDetails) => {
  try {
    const response = await fetch('/api/devices/discover-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(connectionDetails)
    });
    
    const result = await response.json();
    
    if (result.connected) {
      console.log('Device found:', result.manufacturer, result.model);
      return result;
    } else {
      console.log('Device not reachable');
      return null;
    }
  } catch (error) {
    console.error('Discovery failed:', error);
    return null;
  }
};

// 2. Auto-discovery bilan device yaratish
const createDeviceWithAutoDiscovery = async (basicInfo) => {
  try {
    const response = await fetch('/api/devices/auto-discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(basicInfo)
    });
    
    const device = await response.json();
    console.log('Device created:', device);
    return device;
  } catch (error) {
    console.error('Device creation failed:', error);
    throw error;
  }
};

// 3. Foydalanish misoli
const handleCreateDevice = async () => {
  const connectionDetails = {
    ipAddress: '192.168.1.100',
    port: 80,
    username: 'admin',
    password: 'password123'
  };
  
  // Avval test qilish
  const discoveredInfo = await testDevice(connectionDetails);
  
  if (discoveredInfo && discoveredInfo.connected) {
    // Device yaratish
    const deviceData = {
      name: 'Main Entrance',
      branchId: 'branch-id',
      organizationId: 'org-id',
      ...connectionDetails
    };
    
    const newDevice = await createDeviceWithAutoDiscovery(deviceData);
    console.log('New device created:', newDevice);
  }
};
```

## 🔍 Error Handling

### 1. Ulanish Xatolari

```json
{
  "connected": false,
  "manufacturer": "Unknown",
  "model": "Unknown Model",
  "firmware": "Unknown",
  "macAddress": null,
  "deviceIdentifier": "192.168.1.100_1234567890",
  "capabilities": [],
  "status": "UNKNOWN",
  "discoveredAt": "2024-01-15T10:30:00Z"
}
```

### 2. Authentication Xatolari

```json
{
  "statusCode": 401,
  "message": "Authentication failed",
  "error": "Unauthorized"
}
```

### 3. Network Xatolari

```json
{
  "statusCode": 400,
  "message": "Device not reachable",
  "error": "Bad Request"
}
```

## 📊 Logging va Monitoring

### Auto-Discovery Loglari

```typescript
// Muvaffaqiyatli discovery
this.logger.debug('Device auto-discovery completed', {
  ipAddress: '192.168.1.100',
  manufacturer: 'Hikvision',
  model: 'DS-K1T341AMF',
  discoveryTime: '2.3s'
});

// Discovery xatosi
this.logger.warn('Device auto-discovery failed, using defaults', {
  ipAddress: '192.168.1.100',
  error: 'Connection timeout',
  fallbackUsed: true
});

// Device yaratish
this.logger.logUserAction(userId, 'DEVICE_CREATED', {
  deviceId: 'device-uuid',
  deviceName: 'Main Entrance',
  autoDiscovered: true,
  manufacturer: 'Hikvision',
  model: 'DS-K1T341AMF'
});
```

## 🎯 Foydalanish Holatlari

### 1. Oddiy Device Qo'shish
```bash
# Faqat asosiy ma'lumotlar bilan
curl -X POST /api/devices/auto-discover \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Door",
    "ipAddress": "192.168.1.100",
    "port": 80,
    "username": "admin",
    "password": "password123",
    "branchId": "branch-id",
    "organizationId": "org-id"
  }'
```

### 2. Device Test Qilish
```bash
# Ulanishni test qilish
curl -X POST /api/devices/discover-info \
  -H "Content-Type: application/json" \
  -d '{
    "ipAddress": "192.168.1.100",
    "port": 80,
    "username": "admin",
    "password": "password123"
  }'
```

### 3. Batch Device Qo'shish
```javascript
const devices = [
  { name: 'Main Entrance', ipAddress: '192.168.1.100' },
  { name: 'Back Door', ipAddress: '192.168.1.101' },
  { name: 'Office Door', ipAddress: '192.168.1.102' }
];

for (const deviceInfo of devices) {
  const deviceData = {
    ...deviceInfo,
    port: 80,
    username: 'admin',
    password: 'password123',
    branchId: 'branch-id',
    organizationId: 'org-id'
  };
  
  await createDeviceWithAutoDiscovery(deviceData);
}
```

## ✅ Afzalliklari

1. **Soddalik**: Foydalanuvchi faqat 4-5 ta maydon to'ldiradi
2. **Avtomatlashtirish**: Qolgan ma'lumotlar avtomatik olinadi
3. **Xatoliklarni Kamaytirish**: Manual kiritish xatolari kamayadi
4. **Tezlik**: Device qo'shish jarayoni tezlashadi
5. **Moslashuvchanlik**: Turli device turlari qo'llab-quvvatlanadi

## 🔄 Kelajakdagi Yaxshilanishlar

1. **Bulk Discovery**: Bir nechta IP rangeni scan qilish
2. **Network Scanning**: Avtomatik network scan
3. **Device Templates**: Manufacturer bo'yicha default sozlamalar
4. **Health Monitoring**: Auto-discovery natijalarini monitoring qilish
5. **Cache**: Discovery natijalarini cache qilish