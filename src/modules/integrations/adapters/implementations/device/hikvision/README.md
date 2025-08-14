# Hikvision ISAPI Integration

Bu papkada Hikvision qurilmalari uchun to'liq ISAPI integratsiyasi mavjud. ISAPI dokumentatsiyasiga asoslanib yaratilgan yangi managerlar va funksiyalar.

## 📁 Struktura

```
hikvision/
├── types/                    # ISAPI tiplar va interfeyslari
│   ├── isapi.types.ts       # Barcha ISAPI tiplari
│   └── index.ts
├── managers/                 # Funksional managerlar
│   ├── person.manager.ts     # Shaxs boshqaruvi (ISAPI)
│   ├── face-library.manager.ts # Yuz kutubxonasi boshqaruvi
│   ├── fingerprint.manager.ts  # Barmoq izi boshqaruvi
│   ├── event-host.manager.ts   # Event host konfiguratsiyasi
│   ├── schedule.manager.ts     # Jadval boshqaruvi
│   ├── system.manager.ts       # Tizim boshqaruvi
│   └── ... (eski managerlar)
├── utils/
│   └── hikvision-http.client.ts # HTTP mijoz
├── hikvision-v2.adapter.ts     # Yangi adapter (ISAPI bilan)
└── hikvision.adapter.ts        # Eski adapter
```

## 🚀 Yangi Imkoniyatlar

### 1. Person Management (Shaxs Boshqaruvi)
```typescript
// Shaxslarni qidirish
const persons = await adapter.person.searchPersons(device, {
  UserInfoSearchCond: {
    searchID: 'search_123',
    maxResults: 100,
    EmployeeNoList: [{ employeeNo: '001' }]
  }
});

// Shaxs qo'shish
await adapter.person.addPerson(device, {
  UserInfo: {
    employeeNo: '001',
    name: 'John Doe',
    userType: 'normal',
    Valid: {
      enable: true,
      beginTime: '2024-01-01T00:00:00',
      endTime: '2025-12-31T23:59:59'
    }
  }
});
```

### 2. Face Library Management (Yuz Kutubxonasi)
```typescript
// Yuz kutubxonasi yaratish
await adapter.faceLibrary.createFaceLibrary(device, {
  faceLibType: 'staticFD',
  name: 'Employee Faces',
  FDID: 'lib_001'
});

// Yuz rasmi qo'shish
await adapter.faceLibrary.addFacePicture(device, {
  faceLibType: 'staticFD',
  FDID: 'lib_001',
  name: 'John Doe',
  employeeNo: '001'
}, imageBuffer);
```

### 3. Fingerprint Management (Barmoq Izi)
```typescript
// Barmoq izi qo'shish
await adapter.fingerprint.addFingerprint(device, {
  employeeNo: '001',
  fingerPrintID: 'fp_001',
  fingerType: 'rightThumb',
  fingerData: 'base64_encoded_data'
});

// Barmoq izi ma'lumotlarini olish
const fingerprints = await adapter.fingerprint.searchFingerprints(device);
```

### 4. Event Host Configuration (Event Konfiguratsiyasi)
```typescript
// Event host sozlash
await adapter.eventHost.setListeningHost(device, 'host_001', {
  id: 'host_001',
  url: '/api/events',
  protocolType: 'HTTP',
  parameterFormatType: 'JSON',
  host: '192.168.1.100',
  portNo: 8080,
  httpAuthenticationMethod: 'none'
});
```

### 5. Schedule Management (Jadval Boshqaruvi)
```typescript
// Haftalik jadval yaratish
await adapter.schedule.setWeekPlan(device, 1, {
  enable: true,
  WeekPlanCfg: [
    {
      id: 1,
      week: 'Monday',
      enable: true,
      TimeSegment: {
        beginTime: '08:00:00',
        endTime: '18:00:00'
      }
    }
  ]
});
```

### 6. System Management (Tizim Boshqaruvi)
```typescript
// Tizim foydalanuvchisi yaratish
await adapter.system.setUser(device, 1, {
  id: 1,
  enabled: true,
  userName: 'admin',
  password: 'password123',
  userLevel: 'Administrator'
});

// Karta o'quvchi sozlash
await adapter.system.setCardReaderConfig(device, 1, {
  enable: true,
  defaultVerifyMode: 'cardOrFaceOrFp',
  faceMatchThreshold1: 80
});
```

## 🔧 HikvisionV2Adapter Yangi Metodlari

### Yuqori Darajadagi Metodlar
```typescript
// Shaxslarni qidirish
const result = await adapter.searchPersons(deviceId, {
  maxResults: 50,
  employeeNoList: ['001', '002']
});

// Yuz kutubxonasi yaratish
await adapter.createFaceLibrary(deviceId, {
  faceLibType: 'staticFD',
  name: 'Employees',
  FDID: 'emp_lib'
});

// Yuz rasmi qo'shish
await adapter.addFacePictureWithImage(deviceId, {
  faceLibType: 'staticFD',
  FDID: 'emp_lib',
  name: 'John Doe',
  employeeNo: '001'
}, imageBuffer);

// Event host sozlash
await adapter.configureEventHost(deviceId, 'host_001', {
  url: '/api/events',
  host: '192.168.1.100',
  port: 8080,
  eventTypes: ['AccessControllerEvent', 'faceRecognition']
});

// Haftalik jadval yaratish
await adapter.createWeekSchedule(deviceId, 1, {
  timeSegments: [
    {
      week: 'Monday',
      beginTime: '08:00:00',
      endTime: '18:00:00'
    }
  ]
});
```

### Qurilma Imkoniyatlarini Tekshirish
```typescript
const capabilities = await adapter.getDeviceCapabilities(deviceId);
console.log('Face Library Support:', capabilities.faceLibrarySupport);
console.log('Fingerprint Support:', capabilities.fingerprintSupport);
```

### To'liq Qurilma Holati
```typescript
const status = await adapter.getComprehensiveDeviceStatus(deviceId);
console.log('Persons Count:', status.counts.persons);
console.log('Face Libraries:', status.counts.faceLibraries);
console.log('Fingerprints:', status.counts.fingerprints);
```

## 📋 ISAPI Endpoint Coverage

### ✅ Qo'llab-quvvatlanadigan Endpointlar

#### Person Management
- `POST /ISAPI/AccessControl/UserInfo/Search` - Shaxslarni qidirish
- `GET /ISAPI/AccessControl/UserInfo/Count` - Shaxslar sonini olish
- `POST /ISAPI/AccessControl/UserInfo/Record` - Shaxs qo'shish
- `PUT /ISAPI/AccessControl/UserInfo/Modify` - Shaxs ma'lumotlarini o'zgartirish
- `PUT /ISAPI/AccessControl/UserInfoDetail/Delete` - Shaxslarni o'chirish

#### Face Library Management
- `POST /ISAPI/Intelligent/FDLib` - Yuz kutubxonasi yaratish
- `GET /ISAPI/Intelligent/FDLib/Count` - Yuz kutubxonasi ma'lumotlari
- `POST /ISAPI/Intelligent/FDLib/FDSearch` - Yuz rasmlarini qidirish
- `POST /ISAPI/Intelligent/FDLib/FaceDataRecord` - Yuz rasmi qo'shish
- `PUT /ISAPI/Intelligent/FDLib/FDSetUp` - Yuz rasmi qo'llash
- `PUT /ISAPI/Intelligent/FDLib/FDModify` - Yuz rasmi o'zgartirish
- `POST /ISAPI/AccessControl/CaptureFaceData` - Yuz ma'lumotlarini olish

#### Fingerprint Management
- `GET /ISAPI/AccessControl/FingerPrint/Count` - Barmoq izi sonini olish
- `POST /ISAPI/AccessControl/FingerPrintUpload` - Barmoq izi qidirish
- `POST /ISAPI/AccessControl/FingerPrint/SetUp` - Barmoq izi qo'llash
- `POST /ISAPI/AccessControl/FingerPrintDownload` - Barmoq izi qo'shish
- `POST /ISAPI/AccessControl/FingerPrintModify` - Barmoq izi o'zgartirish
- `PUT /ISAPI/AccessControl/FingerPrint/Delete` - Barmoq izi o'chirish

#### Event Host Management
- `GET /ISAPI/Event/notification/httpHosts/capabilities` - Host imkoniyatlari
- `PUT /ISAPI/Event/notification/httpHosts/{hostID}` - Host sozlash
- `GET /ISAPI/Event/notification/httpHosts/{hostID}` - Host ma'lumotlari
- `GET /ISAPI/Event/notification/httpHosts` - Barcha hostlar
- `DELETE /ISAPI/Event/notification/httpHosts` - Barcha hostlarni o'chirish
- `POST /ISAPI/Event/notification/httpHosts/{hostID}/test` - Host testlash

#### Schedule Management
- `GET /ISAPI/AccessControl/Attendance/weekPlan/capabilities` - Jadval imkoniyatlari
- `PUT /ISAPI/AccessControl/Attendance/weekPlan/{planNo}` - Haftalik jadval
- `GET /ISAPI/AccessControl/Attendance/planTemplate` - Jadval shablonlari
- `PUT /ISAPI/AccessControl/Configuration/attendanceMode` - Davomat rejimi

#### System Management
- `GET /ISAPI/Security/userCheck` - Foydalanuvchi tekshiruvi
- `GET /ISAPI/Security/users` - Tizim foydalanuvchilari
- `PUT /ISAPI/Security/users/{indexID}` - Foydalanuvchi sozlash
- `GET /ISAPI/AccessControl/CardReaderCfg/{cardReaderID}` - Karta o'quvchi
- `PUT /ISAPI/AccessControl/WiegandCfg/wiegandNo/{wiegandID}` - Wiegand sozlash
- `GET /ISAPI/AccessControl/FaceCompareCond` - Yuz solishtirish sozlamalari

## 🛠️ Foydalanish

### 1. Dependency Injection
```typescript
import { HikvisionV2Adapter } from '@/modules/integrations/adapters';

@Injectable()
export class MyService {
  constructor(
    private readonly hikvisionAdapter: HikvisionV2Adapter
  ) {}
}
```

### 2. To'g'ridan-to'g'ri Manager Foydalanish
```typescript
// Shaxs boshqaruvi
await this.hikvisionAdapter.person.searchPersons(device, searchRequest);

// Yuz kutubxonasi
await this.hikvisionAdapter.faceLibrary.createFaceLibrary(device, libraryData);

// Barmoq izi
await this.hikvisionAdapter.fingerprint.addFingerprint(device, fingerprintData);

// Event host
await this.hikvisionAdapter.eventHost.setListeningHost(device, hostId, hostConfig);

// Jadval
await this.hikvisionAdapter.schedule.setWeekPlan(device, planNo, weekPlan);

// Tizim
await this.hikvisionAdapter.system.setUser(device, userId, userInfo);
```

## 🔍 Xatoliklarni Bartaraf Etish

### 1. XML/JSON Konvertatsiya Xatolari
```typescript
try {
  const result = await adapter.system.getAllUsers(deviceId);
} catch (error) {
  console.error('XML parsing error:', error.message);
}
```

### 2. HTTP Xatolari
```typescript
try {
  await adapter.person.addPerson(device, personData);
} catch (error) {
  if (error.response?.status === 401) {
    console.error('Authentication failed');
  }
}
```

### 3. Qurilma Ulanish Xatolari
```typescript
const isConnected = await adapter.testConnection(deviceId);
if (!isConnected) {
  console.error('Device is not reachable');
}
```

## 📚 Qo'shimcha Ma'lumotlar

- ISAPI dokumentatsiyasi: `docs/ISAPI/` papkasida
- Tiplar va interfeyslari: `types/isapi.types.ts`
- HTTP mijoz: `utils/hikvision-http.client.ts`
- XML/JSON konvertatsiya: `@/shared/services/xml-json.service.ts`

## 🔄 Yangilanishlar

- **v2.1.0**: To'liq ISAPI integratsiyasi qo'shildi
- Yangi managerlar: Person, FaceLibrary, Fingerprint, EventHost, Schedule, System
- HikvisionV2Adapter yangi metodlar bilan kengaytirildi
- XML/JSON konvertatsiya qo'llab-quvvatlandi
- Multipart form-data qo'llab-quvvatlandi (yuz rasmlari uchun)