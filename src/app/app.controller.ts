import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from '../shared/decorators';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get()
    @Public()
    getHello(): string {
        return this.appService.getHello();
    }

    @Get('health')
    @Public()
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'sector-staff-v2',
            version: '2.1.0',
        };
    }
}
