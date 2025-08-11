import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getHello(): string {
        return 'Sector Staff v2.1 API is running!';
    }
}
