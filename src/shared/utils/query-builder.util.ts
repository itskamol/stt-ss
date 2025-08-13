import { DataScope } from '../interfaces/data-scope.interface';

export class QueryBuilder {
    /**
     * Builds organization-scoped where clause
     */
    static buildOrganizationScope(scope: DataScope): { organizationId: string } {
        return {
            organizationId: scope.organizationId,
        };
    }

    /**
     * Builds branch-scoped where clause for branch managers
     */
    static buildBranchScope(scope: DataScope): any {
        if (scope.branchIds && scope.branchIds.length > 0) {
            return {
                organizationId: scope.organizationId,
                id: {
                    in: scope.branchIds,
                },
            };
        }

        return {
            organizationId: scope.organizationId,
        };
    }

    /**
     * Builds branch-scoped where clause for entities that have branch relation
     */
    static buildBranchRelationScope(scope: DataScope): any {
        if (scope.branchIds && scope.branchIds.length > 0) {
            return {
                organizationId: scope.organizationId,
                id: {
                    in: scope.branchIds,
                },
            };
        }

        return {
            organizationId: scope.organizationId,
        };
    }

    /**
     * Builds pagination parameters
     */
    static buildPagination(page?: number, limit?: number) {
        if (!page || !limit) {
            return {};
        }

        return {
            skip: (page - 1) * limit,
            take: limit,
        };
    }

    /**
     * Builds ordering parameters
     */
    static buildOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc') {
        if (!sortBy) {
            return { createdAt: 'desc' };
        }

        return {
            [sortBy]: sortOrder || 'asc',
        };
    }
}
