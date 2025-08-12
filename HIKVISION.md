# **1. Kirish**

## **1.1. Hujjat Maqsadi**

Ushbu hujjat "Sector Staff v2.1" loyihasi doirasida Hikvision qurilmalari bilan aloqa qilish uchun mo'ljallangan `HikvisionApiAdapter` komponentining texnik talablari, arxitekturasi va implementatsiya detallarini belgilaydi. Adapter tizimning asosiy biznes logikasini qurilma bilan ishlashning murakkabliklaridan to'liq ajratish (decoupling) vazifasini bajaradi.

### **1.2. Umumiy Yondashuv**

Adapter "Adapter" dizayn patterni asosida quriladi. Uning vazifasi Hikvision ISAPI protokoli orqali yuboriladigan murakkab HTTP so'rovlarini tizimning qolgan qismi uchun tushunarli bo'lgan oddiy va toza metodlar (`addUser`, `deleteUser`, `getFaceData` va h.k.) ortiga yashirishdan iborat. Bu yondashuv quyidagi afzalliklarni beradi:

  **Moslashuvchanlik:** Kelajakda boshqa qurilma (masalan, ZKTeco) qo'shilsa, faqat yangi adapter yaratiladi, asosiy kod o'zgarmaydi.
  **Test qilish osonligi:** Asosiy logikani haqiqiy qurilmasiz, soxta (mock) adapter yordamida test qilish mumkin.
  **Markazlashtirish:** Qurilma bilan ishlashning barcha logikasi bitta joyda jamlanadi.

## **2. Asosiy Komponentlar va Bog'liqliklar**

`HikvisionApiAdapter` quyidagi asosiy komponentlar va NestJS modullari bilan ishlaydi:

  **`HttpService` (`@nestjs/axios`):** Qurilmaga HTTP/HTTPS so'rovlarini yuborish uchun asosiy vosita.
  **`PrismaService`:** Qurilma ma'lumotlarini (IP, login, shifrlangan parol) ma'lumotlar bazasidan o'qish uchun.
  **`EncryptionService`:** Ma'lumotlar bazasida saqlangan parollarni shifrlash va shifrdan ochish uchun (7.3.3-bo'limda belgilangan).
  **`ConfigService` (`@nestjs/config`):** Global shifrlash kalitlarini (`.env` faylidan) olish uchun.
  **`Cache` (masalan, `@nestjs/cache-manager`):** Qurilmadan olingan vaqtinchalik sessiya kalitlarini keshlash uchun.

## **3. Konfiguratsiya va Xavfsizlik Kalitlari**

### **3.1. Ma'lumotlar Bazasi (`Device` Modeli)**

Adapter ishlashi uchun zarur bo'lgan barcha qurilmaga oid ma'lumotlar `Device` jadvalida saqlanadi. Jadvalda quyidagi maydonlar bo'lishi shart:

  `ipAddress: string`
  `username: string`
  `encryptedSecret: string` (AES-256 bilan shifrlangan parol)

### **3.2. Shifrlash Kalitlari (`.env`)**

`EncryptionService` ishlatadigan global maxfiy kalitlar `.env` faylida saqlanadi:

  `SECRET_ENCRYPTION_KEY`
  `SECRET_ENCRYPTION_IV`

## **4. Interfeyslar va Ma'lumotlar Obyektlari (DTO)**

Tizimda toza kod va qat'iy tipizatsiyani ta'minlash uchun maxsus interfeys va DTO'lar belgilanadi.

### **4.1. `IHikvisionAdapter` Interfeysi**

```typescript
export interface IHikvisionAdapter {
  addUser(deviceId: string, userData: CreateDeviceUserDto): Promise<boolean>;
  updateUser(deviceId: string, employeeNo: string, userData: UpdateDeviceUserDto): Promise<boolean>;
  deleteUser(deviceId: string, employeeNo: string): Promise<boolean>;
  findUserByEmployeeNo(deviceId: string, employeeNo: string): Promise<DeviceUserInfo | null>;
  getFaceData(deviceId: string, employeeNo: string): Promise<Buffer | null>;
}
```

Hikvision qurilmalari o'zlarining ISAPI protokoli uchun odatda **Digest Access Authentication** (Digest kirish autentifikatsiyasi)dan foydalanadi. Bu Basic autentifikatsiyasiga qaraganda ancha xavfsizroq, chunki parol tarmoq orqali ochiq matnda yuborilmaydi.

-----

### \#\# Texnik Izoh

Siz uchun eng yaxshi yangilik shuki, NestJS'dagi `HttpService` (ichida `axios` ishlatadi) buni **avtomatik tarzda** amalga oshiradi.

Siz adapterda yozgan kod:

```typescript
this.httpService.post(url, payload, {
  auth: {
    username: device.username,
    password: password,
  },
})
```

Bu kod `axios`'ga "mana shu so'rov uchun shu login va parolni ishlat" degan buyruqni beradi. `axios` esa quyidagicha ishlaydi:

1. Dastlab so'rovni yuborib ko'radi.
2. Agar server `401 Unauthorized` javobini `WWW-Authenticate: Digest ...` sarlavhasi bilan qaytarsa, `axios` bu Digest so'rovi ekanligini tushunadi va kerakli "challenge-response" jarayonini o'zi avtomatik bajaradi.
3. Agar server `WWW-Authenticate: Basic ...` sarlavhasi bilan javob bersa, u holda Basic autentifikatsiyani ishlatadi.

Sizning kodingiz to'g'ri. Siz autentifikatsiya turini (`Digest` yoki `Basic`) aniq belgilashingiz shart emas. `auth` obyektiga to'g'ri `username` va `password`'ni taqdim etsangiz bo'ldi, qolganini `HttpService`/`axios` o'zi hal qiladi.

### **4.2. Ma'lumotlar Obyektlari (DTOs)**

```typescript
// Kiruvchi ma'lumotlar uchun
export class CreateDeviceUserDto {
  employeeNo: string;
  name: string;
  userType: 'normal' | 'visitor';
}

export class UpdateDeviceUserDto {
  name?: string;
  userType?: 'normal' | 'visitor';
}

// Chiqivchi ma'lumotlar uchun
export interface DeviceUserInfo {
  employeeNo: string;
  name: string;
  userType: string;
}
```

## **5. Adapterning Detalli Implementatsiyasi**

### **5.1. Boshlang'ich Sozlash (`Constructor`)**

Barcha kerakli bog'liqliklar (`dependencies`) `constructor` orqali `inject` qilinadi.

```typescript
@Injectable()
export class HikvisionApiAdapter implements IHikvisionAdapter {
  private readonly logger = new Logger(HikvisionApiAdapter.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  // ... metodlar
}
```

### **5.2. Xavfsiz Sessiyani Boshqarish (Private Helper Method)**

Ko'plab nozik API so'rovlari (`FDLib` kabi) vaqtinchalik xavfsizlik kalitlarini talab qiladi. Ushbu jarayonni optimallashtirish va markazlashtirish uchun maxsus yordamchi metod yoziladi.

```typescript
@Injectable()
export class HikvisionApiAdapter implements IHikvisionAdapter {
  // ... constructor

  private async getSecureSession(device: Device): Promise<{ security: string; identityKey: string }> {
    const cacheKey = `hik_session_${device.id}`;
    
    // 1. Keshni tekshirish
    const cachedSession = await this.cacheManager.get(cacheKey);
    if (cachedSession) {
      return cachedSession;
    }

    // 2. Agar keshda bo'lmasa, qurilmadan yangi sessiya kalitini olish
    const password = this.encryptionService.decrypt(device.encryptedSecret);
    const endpoint = `http://${device.ipAddress}/ISAPI/System/Security/identityKey`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(endpoint, { auth: { username: device.username, password } })
      );
      
      const sessionKeys = response.data; // Faraz qilaylik, javobda kerakli kalitlar bor
      
      // 3. Kalitlarni keshga saqlash (masalan, 10 daqiqaga)
      await this.cacheManager.set(cacheKey, sessionKeys, { ttl: 600 });
      
      return sessionKeys;
    } catch (error) {
      this.logger.error(`Failed to get secure session for device ${device.id}`, error);
      throw new InternalServerErrorException('Could not establish secure session with device.');
    }
  }

  // ... boshqa metodlar
}
```

### **5.3. Metodlar Implementatsiyasi (Namuna)**

#### `getFaceData` metodi

Ushbu metod yuqoridagi `getSecureSession` yordamchi metodidan foydalanadi.

```typescript
public async getFaceData(deviceId: string, employeeNo: string): Promise<Buffer | null> {
  // 1. Qurilma ma'lumotlarini bazadan olish
  const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || !device.ipAddress) {
    throw new NotFoundException('Device not found or IP address is not configured.');
  }

  // 2. Xavfsiz sessiya kalitlarini olish
  const session = await this.getSecureSession(device);

  // 3. Olingan kalitlar bilan asosiy so'rovni yuborish
  const endpoint = `http://${device.ipAddress}/ISAPI/Intelligent/FDLib?format=json&employeeNo=${employeeNo}`;
  const queryParams = {
    security: session.security,
    // iv: ... (agar kerak bo'lsa)
    identityKey: session.identityKey,
  };
  
  try {
    const response = await firstValueFrom(
      this.httpService.get(endpoint, { params: queryParams, responseType: 'arraybuffer' })
    );
    return Buffer.from(response.data);
  } catch (error) {
    if (error.response?.status === 404) return null;
    this.logger.error(`Failed to get face data for employee ${employeeNo}`, error);
    throw new InternalServerErrorException('Error getting face data.');
  }
}
```

## **6. Xatoliklarni Boshqarish (Error Handling)**

Adapter qurilma bilan muloqotda yuzaga kelishi mumkin bo'lgan barcha xatoliklarni ushlab, ularni NestJS'ning standart `Exception`'lariga aylantirishi kerak.

  **`NotFoundException (404)`:** Agar `deviceId` bo'yicha qurilma bazada topilmasa.
  **`UnauthorizedException (401)`:** Agar qurilma yuborilgan login/parolni rad etsa.
  **`BadRequestException (400)`:** Agar yuborilgan ma'lumotlar (DTO) noto'g'ri bo'lsa yoki qurilma mantiqiy xatolik qaytarsa (masalan, "bunday xodim mavjud emas").
  **`InternalServerErrorException (500)`:** Tarmoq xatoliklari, qurilmaning javob bermasligi (timeout) yoki boshqa kutilmagan xatoliklar yuzaga kelganda.

## **7. Testlash Strategiyasi**

### **7.1. Unit Testlash**

Adapter logikasini izolyatsiyada tekshirish uchun barcha tashqi bog'liqliklar (`HttpService`, `PrismaService`, `EncryptionService`, `Cache`) `jest.fn()` yordamida soxtalashtiriladi (mock).

**Test senariylari:**

  `addUser` metodi chaqirilganda `HttpService.post` to'g'ri `endpoint` va `payload` bilan chaqirilayotganini tekshirish.
  Qurilmadan xatolik kodi qaytganda, adapter to'g'ri `Exception` tashlayotganini tekshirish.
  `getSecureSession` keshdan ma'lumotni o'qiy olayotganini va keshga yoza olayotganini tekshirish.

### **7.2. Integratsion Testlash**

`HttpService`'ni mock qilish uchun `nock` yoki `msw` kabi kutubxonalardan foydalanib, haqiqiy HTTP so'rovlarini ushlab qolib, ularga oldindan belgilangan javoblarni qaytarish mumkin. Bu adapterning HTTP qatlami bilan to'g'ri ishlashini haqiqiy qurilmasiz tekshirish imkonini beradi.
