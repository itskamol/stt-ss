import { Module } from '@nestjs/common';
import { AdapterModule } from './adapters/adapter.module';

@Module({
  imports: [AdapterModule],
  exports: [AdapterModule],
})
export class IntegrationsModule {}