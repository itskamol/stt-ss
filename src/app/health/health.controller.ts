import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../../shared/decorators';

@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get()
    @Public()
    async getHealth() {
        return this.healthService.getHealthStatus();
    }

    @Get('detailed')
    @Public()
    async getDetailedHealth() {
        return this.healthService.getDetailedHealthStatus();
    }
}
