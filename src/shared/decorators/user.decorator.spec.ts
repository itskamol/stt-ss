import { ExecutionContext } from '@nestjs/common';
import { getUserFromContext } from './user.decorator';
import { UserContext } from '../interfaces/data-scope.interface';
import { Role } from '@prisma/client';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';

describe('User Decorator Logic (getUserFromContext)', () => {
    const mockUser: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-456',
        branchIds: ['branch-1'],
        roles: [Role.ORG_ADMIN],
        permissions: [PERMISSIONS.EMPLOYEE.CREATE],
    };

    const createMockContext = (user: UserContext | undefined): ExecutionContext => {
        return {
            switchToHttp: () => ({
                getRequest: () => ({
                    user,
                }),
            }),
        } as unknown as ExecutionContext;
    };

    it('should return full user context when no data parameter', () => {
        const mockContext = createMockContext(mockUser);
        const result = getUserFromContext(undefined, mockContext);
        expect(result).toEqual(mockUser);
    });

    it('should return specific user property when data parameter provided', () => {
        const mockContext = createMockContext(mockUser);
        const result = getUserFromContext('sub', mockContext);
        expect(result).toBe('user-123');
    });

    it('should return email when email property requested', () => {
        const mockContext = createMockContext(mockUser);
        const result = getUserFromContext('email', mockContext);
        expect(result).toBe('test@example.com');
    });

    it('should return organizationId when organizationId property requested', () => {
        const mockContext = createMockContext(mockUser);
        const result = getUserFromContext('organizationId', mockContext);
        expect(result).toBe('org-456');
    });

    it('should return roles when roles property requested', () => {
        const mockContext = createMockContext(mockUser);
        const result = getUserFromContext('roles', mockContext);
        expect(result).toEqual([Role.ORG_ADMIN]);
    });

    it('should return undefined when user is not present', () => {
        const mockContext = createMockContext(undefined);
        const result = getUserFromContext(undefined, mockContext);
        expect(result).toBeUndefined();
    });

    it('should return undefined when accessing property of undefined user', () => {
        const mockContext = createMockContext(undefined);
        const result = getUserFromContext('sub', mockContext);
        expect(result).toBeUndefined();
    });
});
