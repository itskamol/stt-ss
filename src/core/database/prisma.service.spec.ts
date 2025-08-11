import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { ConfigService } from '../config/config.service';

describe('PrismaService', () => {
    let service: PrismaService;
    let configService: ConfigService;

    beforeEach(async () => {
        const mockConfigService = {
            databaseUrl: 'postgresql://test:test@localhost:5432/test',
            isDevelopment: true,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PrismaService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<PrismaService>(PrismaService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should extend PrismaClient', () => {
        expect(service).toBeInstanceOf(PrismaService);
    });
});
