import { ExecutionContext } from '@nestjs/common';
import { User } from './user.decorator';
import { UserContext } from '../interfaces/data-scope.interface';

describe('User Decorator', () => {
    const mockUser: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-456',
        branchIds: ['branch-1'],
        roles: ['ORG_ADMIN'],
        permissions: ['employee:create'],
    };

    const createMockContext = (user: UserContext): ExecutionContext => {
        return {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({
                    user,
                }),
            }),
        } as unknown as ExecutionContext;
    };

    it('should return full user context when no data parameter', () => {
        const mockContext = createMockContext(mockUser);
        const factory = User() as any;

        const result = factory(undefined, mockContext);

        expect(result).toEqual(mockUser);
    });

    it('should return specific user property when data parameter provided', () => {
        const mockContext = createMockContext(mockUser);
        const factory = User() as any;

        const result = factory('sub', mockContext);

        expect(result).toBe('user-123');
    });

    it('should return email when email property requested', () => {
        const mockContext = createMockContext(mockUser);
        const factory = User() as any;

        const result = factory('email', mockContext);

        expect(result).toBe('test@example.com');
    });

    it('should return organizationId when organizationId property requested', () => {
        const mockContext = createMockContext(mockUser);
        const factory = User() as any;

        const result = factory('organizationId', mockContext);

        expect(result).toBe('org-456');
    });

    it('should return roles when roles property requested', () => {
        const mockContext = createMockContext(mockUser);
        const factory = User() as any;

        const result = factory('roles', mockContext);

        expect(result).toEqual(['ORG_ADMIN']);
    });

    it('should return undefined when user is not present', () => {
        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({
                    user: undefined,
                }),
            }),
        } as unknown as ExecutionContext;

        const factory = User() as any;

        const result = factory(undefined, mockContext);

        expect(result).toBeUndefined();
    });

    it('should return undefined when accessing property of undefined user', () => {
        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({
                    user: undefined,
                }),
            }),
        } as unknown as ExecutionContext;

        const factory = User() as any;

        const result = factory('sub', mockContext);

        expect(result).toBeUndefined();
    });
});
