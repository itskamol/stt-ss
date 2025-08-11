import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataScopeGuard, RequestWithScope } from './data-scope.guard';
import { LoggerService } from '../../core/logger/logger.service';
import { UserContext } from '../interfaces/data-scope.interface';

describe('DataScopeGuard', () => {
    let guard: DataScopeGuard;
    let reflector: Reflector;
    let logger: LoggerService;

    const mockReflector = {
        getAllAndOverride: jest.fn(),
    };

    const mockLogger = {
        logSecurityEvent: jest.fn(),
        debug: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DataScopeGuard,
                {
                    provide: Reflector,
                    useValue: mockReflector,
                },
                {
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        guard = module.get<DataScopeGuard>(DataScopeGuard);
        reflector = module.get<Reflector>(Reflector);
        logger = module.get<LoggerService>(LoggerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('canActivate', () => {
        const mockUser: UserContext = {
            sub: 'user-123',
            email: 'test@example.com',
            organizationId: 'org-456',
            branchIds: ['branch-1', 'branch-2'],
            roles: ['ORG_ADMIN'],
            permissions: ['employee:create'],
        };

        const createMockContext = (user?: UserContext): ExecutionContext => {
            const mockRequest: Partial<RequestWithScope> = {
                user,
                url: '/test',
                method: 'GET',
                correlationId: 'test-correlation-id',
            };

            return {
                getHandler: jest.fn(),
                getClass: jest.fn(),
                switchToHttp: jest.fn().mockReturnValue({
                    getRequest: jest.fn().mockReturnValue(mockRequest),
                }),
            } as unknown as ExecutionContext;
        };

        it('should allow access when no user (unauthenticated)', () => {
            const mockContext = createMockContext();

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should allow access to public routes', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride.mockReturnValue(true);

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should allow SUPER_ADMIN access to no-scoping routes', () => {
            const superAdminUser: UserContext = {
                ...mockUser,
                roles: ['SUPER_ADMIN'],
                organizationId: undefined,
            };
            const mockContext = createMockContext(superAdminUser);

            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(true); // noScoping

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should deny non-SUPER_ADMIN access to no-scoping routes', () => {
            const mockContext = createMockContext(mockUser);

            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(true); // noScoping

            expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'DATA_SCOPE_VIOLATION_NO_SCOPING',
                expect.objectContaining({
                    userId: 'user-123',
                    roles: ['ORG_ADMIN'],
                }),
                'user-123',
                'org-456',
                'test-correlation-id'
            );
        });

        it('should deny access when user has no organization context', () => {
            const userWithoutOrg: UserContext = {
                ...mockUser,
                organizationId: undefined,
            };
            const mockContext = createMockContext(userWithoutOrg);

            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(false); // noScoping

            expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'DATA_SCOPE_VIOLATION_NO_ORGANIZATION',
                expect.objectContaining({
                    userId: 'user-123',
                }),
                'user-123',
                undefined,
                'test-correlation-id'
            );
        });

        it('should apply data scope for valid user with organization', () => {
            const mockContext = createMockContext(mockUser);
            const mockRequest = mockContext.switchToHttp().getRequest();

            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(false); // noScoping

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
            expect(mockRequest.scope).toEqual({
                organizationId: 'org-456',
                branchIds: ['branch-1', 'branch-2'],
            });
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Data scope applied',
                expect.objectContaining({
                    userId: 'user-123',
                    organizationId: 'org-456',
                    branchIds: ['branch-1', 'branch-2'],
                    module: 'data-scope-guard',
                })
            );
        });

        it('should handle user without branch IDs', () => {
            const userWithoutBranches: UserContext = {
                ...mockUser,
                branchIds: undefined,
            };
            const mockContext = createMockContext(userWithoutBranches);
            const mockRequest = mockContext.switchToHttp().getRequest();

            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(false); // noScoping

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
            expect(mockRequest.scope).toEqual({
                organizationId: 'org-456',
                branchIds: undefined,
            });
        });
    });
});
