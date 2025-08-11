import { QueryBuilder } from './query-builder.util';
import { DataScope } from '../interfaces/data-scope.interface';

describe('QueryBuilder', () => {
    describe('buildOrganizationScope', () => {
        it('should build organization scope with organizationId', () => {
            const scope: DataScope = {
                organizationId: 'org-123',
            };

            const result = QueryBuilder.buildOrganizationScope(scope);

            expect(result).toEqual({
                organizationId: 'org-123',
            });
        });
    });

    describe('buildBranchScope', () => {
        it('should build branch scope with organizationId only when no branchIds', () => {
            const scope: DataScope = {
                organizationId: 'org-123',
            };

            const result = QueryBuilder.buildBranchScope(scope);

            expect(result).toEqual({
                organizationId: 'org-123',
            });
        });

        it('should build branch scope with organizationId and branchIds', () => {
            const scope: DataScope = {
                organizationId: 'org-123',
                branchIds: ['branch-1', 'branch-2'],
            };

            const result = QueryBuilder.buildBranchScope(scope);

            expect(result).toEqual({
                organizationId: 'org-123',
                branchId: {
                    in: ['branch-1', 'branch-2'],
                },
            });
        });

        it('should build organization scope when branchIds is empty array', () => {
            const scope: DataScope = {
                organizationId: 'org-123',
                branchIds: [],
            };

            const result = QueryBuilder.buildBranchScope(scope);

            expect(result).toEqual({
                organizationId: 'org-123',
            });
        });
    });

    describe('buildPagination', () => {
        it('should build pagination parameters', () => {
            const result = QueryBuilder.buildPagination(2, 10);

            expect(result).toEqual({
                skip: 10,
                take: 10,
            });
        });

        it('should return empty object when page is not provided', () => {
            const result = QueryBuilder.buildPagination(undefined, 10);

            expect(result).toEqual({});
        });

        it('should return empty object when limit is not provided', () => {
            const result = QueryBuilder.buildPagination(2, undefined);

            expect(result).toEqual({});
        });

        it('should calculate correct skip for first page', () => {
            const result = QueryBuilder.buildPagination(1, 10);

            expect(result).toEqual({
                skip: 0,
                take: 10,
            });
        });
    });

    describe('buildOrderBy', () => {
        it('should build order by with sortBy and sortOrder', () => {
            const result = QueryBuilder.buildOrderBy('name', 'asc');

            expect(result).toEqual({
                name: 'asc',
            });
        });

        it('should default to asc when sortOrder is not provided', () => {
            const result = QueryBuilder.buildOrderBy('name');

            expect(result).toEqual({
                name: 'asc',
            });
        });

        it('should default to createdAt desc when sortBy is not provided', () => {
            const result = QueryBuilder.buildOrderBy();

            expect(result).toEqual({
                createdAt: 'desc',
            });
        });

        it('should handle desc sort order', () => {
            const result = QueryBuilder.buildOrderBy('updatedAt', 'desc');

            expect(result).toEqual({
                updatedAt: 'desc',
            });
        });
    });
});
