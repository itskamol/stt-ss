import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HikvisionAuthService } from './services/hikvision-auth.service';
import { DeviceAuthGuard } from './guards/device-auth.guard';

@Module({
  imports: [ConfigModule],
  providers: [HikvisionAuthService, DeviceAuthGuard],
  exports: [HikvisionAuthService, DeviceAuthGuard],
})
export class HikvisionAuthModule {}