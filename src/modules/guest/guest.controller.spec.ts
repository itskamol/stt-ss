import { Test, TestingModule } from '@nestjs/testing';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';
import { ApproveGuestVisitDto, CreateGuestVisitDto, UpdateGuestVisitDto } from '../../shared/dto';
import { DataScope, UserContext } from '../../shared/interfaces';

describe('GuestController', () => {
    let controller: GuestController;
    let guestService: jest.Mocked<GuestService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: ['guest:create', 'guest:read:all'],
    };

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockGuestVisit = {
        id: 'visit-123',
        organizationId: 'org-123',
        branchId: 'branch-123',
        guestName: 'John Visitor',
        guestContact: 'john@example.com',
        responsibleEmployeeId: 'emp-123',
        scheduledEntryTime: new Date('2024-01-15T09:00:00Z'),
        scheduledExitTime: new Date('2024-01-15T17:00:00Z'),
        status: 'PENDING_APPROVAL' as any,
        accessCredentialType: 'QR_CODE' as any,
        accessCredentialHash: null,
        createdByUserId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockGuestService = {
            createGuestVisit: jest.fn(),
            getGuestVisits: jest.fn(),
            getGuestVisitById: jest.fn(),
            updateGuestVisit: jest.fn(),
            approveGuestVisit: jest.fn(),
            rejectGuestVisit: jest.fn(),
            activateGuestVisit: jest.fn(),
            completeGuestVisit: jest.fn(),
            getGuestVisitsByStatus: jest.fn(),
            searchGuestVisits: jest.fn(),
            getGuestVisitStats: jest.fn(),
            expireOverdueVisits: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [GuestController],
            providers: [
                {
                    provide: GuestService,
                    useValue: mockGuestService,
                },
            ],
        }).compile();

        controller = module.get<GuestController>(GuestController);
        guestService = module.get(GuestService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createGuestVisit', () => {
        it('should create a guest visit successfully', async () => {
            const createDto: CreateGuestVisitDto = {
                guestName: 'John Visitor',
                guestContact: 'john@example.com',
                responsibleEmployeeId: 'emp-123',
                branchId: 'branch-123',
                scheduledEntryTime: '2024-01-15T09:00:00Z',
                scheduledExitTime: '2024-01-15T17:00:00Z',
            };

            guestService.createGuestVisit.mockResolvedValue(mockGuestVisit);

            const result = await controller.createGuestVisit(
                createDto,
                mockUserContext,
                mockDataScope
            );

            expect(guestService.createGuestVisit).toHaveBeenCalledWith(
                createDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result).toEqual({
                id: mockGuestVisit.id,
                organizationId: mockGuestVisit.organizationId,
                branchId: mockGuestVisit.branchId,
                guestName: mockGuestVisit.guestName,
                guestContact: mockGuestVisit.guestContact,
                responsibleEmployeeId: mockGuestVisit.responsibleEmployeeId,
                scheduledEntryTime: mockGuestVisit.scheduledEntryTime,
                scheduledExitTime: mockGuestVisit.scheduledExitTime,
                status: mockGuestVisit.status,
                accessCredentialType: mockGuestVisit.accessCredentialType,
                createdByUserId: mockGuestVisit.createdByUserId,
                createdAt: mockGuestVisit.createdAt,
                updatedAt: mockGuestVisit.updatedAt,
            });
        });
    });

    describe('getGuestVisits', () => {
        it('should return paginated guest visits', async () => {
            const guestVisits = [mockGuestVisit];
            guestService.getGuestVisits.mockResolvedValue(guestVisits);

            const result = await controller.getGuestVisits(
                mockDataScope,
                { status: 'PENDING_APPROVAL' },
                { page: 1, limit: 10 }
            );

            expect(guestService.getGuestVisits).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'PENDING_APPROVAL',
                }),
                mockDataScope
            );
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
        });
    });

    describe('getGuestVisitById', () => {
        it('should return a guest visit by ID', async () => {
            guestService.getGuestVisitById.mockResolvedValue(mockGuestVisit);

            const result = await controller.getGuestVisitById('visit-123', mockDataScope);

            expect(guestService.getGuestVisitById).toHaveBeenCalledWith('visit-123', mockDataScope);
            expect(result.id).toBe(mockGuestVisit.id);
        });

        it('should throw error when guest visit not found', async () => {
            guestService.getGuestVisitById.mockResolvedValue(null);

            await expect(
                controller.getGuestVisitById('nonexistent', mockDataScope)
            ).rejects.toThrow('Guest visit not found');
        });
    });

    describe('updateGuestVisit', () => {
        it('should update a guest visit successfully', async () => {
            const updateDto: UpdateGuestVisitDto = {
                guestName: 'Jane Visitor',
                guestContact: 'jane@example.com',
            };

            const updatedVisit = {
                ...mockGuestVisit,
                guestName: 'Jane Visitor',
                guestContact: 'jane@example.com',
            };
            guestService.updateGuestVisit.mockResolvedValue(updatedVisit);

            const result = await controller.updateGuestVisit(
                'visit-123',
                updateDto,
                mockUserContext,
                mockDataScope
            );

            expect(guestService.updateGuestVisit).toHaveBeenCalledWith(
                'visit-123',
                updateDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.guestName).toBe('Jane Visitor');
            expect(result.guestContact).toBe('jane@example.com');
        });
    });

    describe('approveGuestVisit', () => {
        it('should approve a guest visit successfully', async () => {
            const approveDto: ApproveGuestVisitDto = {
                accessCredentialType: 'QR_CODE',
                notes: 'Approved for meeting',
            };

            const approvedVisit = {
                ...mockGuestVisit,
                status: 'APPROVED' as any,
                accessCredentials: 'base64-encoded-qr-data',
            };
            guestService.approveGuestVisit.mockResolvedValue(approvedVisit as any);

            const result = await controller.approveGuestVisit(
                'visit-123',
                approveDto,
                mockUserContext,
                mockDataScope
            );

            expect(guestService.approveGuestVisit).toHaveBeenCalledWith(
                'visit-123',
                approveDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.status).toBe('APPROVED');
            expect(result.accessCredentials).toBe('base64-encoded-qr-data');
        });
    });

    describe('rejectGuestVisit', () => {
        it('should reject a guest visit successfully', async () => {
            const rejectDto = {
                reason: 'Security concerns',
                notes: 'Additional verification required',
            };

            const rejectedVisit = { ...mockGuestVisit, status: 'REJECTED' as any };
            guestService.rejectGuestVisit.mockResolvedValue(rejectedVisit);

            const result = await controller.rejectGuestVisit(
                'visit-123',
                rejectDto,
                mockUserContext,
                mockDataScope
            );

            expect(guestService.rejectGuestVisit).toHaveBeenCalledWith(
                'visit-123',
                rejectDto.reason,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.status).toBe('REJECTED');
        });
    });

    describe('activateGuestVisit', () => {
        it('should activate a guest visit successfully', async () => {
            const activeVisit = { ...mockGuestVisit, status: 'ACTIVE' as any };
            guestService.activateGuestVisit.mockResolvedValue(activeVisit);

            const result = await controller.activateGuestVisit(
                'visit-123',
                mockUserContext,
                mockDataScope
            );

            expect(guestService.activateGuestVisit).toHaveBeenCalledWith(
                'visit-123',
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.status).toBe('ACTIVE');
        });
    });

    describe('completeGuestVisit', () => {
        it('should complete a guest visit successfully', async () => {
            const completedVisit = { ...mockGuestVisit, status: 'COMPLETED' as any };
            guestService.completeGuestVisit.mockResolvedValue(completedVisit);

            const result = await controller.completeGuestVisit(
                'visit-123',
                mockUserContext,
                mockDataScope
            );

            expect(guestService.completeGuestVisit).toHaveBeenCalledWith(
                'visit-123',
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.status).toBe('COMPLETED');
        });
    });

    describe('getGuestVisitsByStatus', () => {
        it('should return guest visits by status', async () => {
            const pendingVisits = [mockGuestVisit];
            guestService.getGuestVisitsByStatus.mockResolvedValue(pendingVisits);

            const result = await controller.getGuestVisitsByStatus(
                'PENDING_APPROVAL',
                mockDataScope
            );

            expect(guestService.getGuestVisitsByStatus).toHaveBeenCalledWith(
                'PENDING_APPROVAL',
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('PENDING_APPROVAL');
        });
    });

    describe('searchGuestVisits', () => {
        it('should return empty array for short search terms', async () => {
            const result = await controller.searchGuestVisits('a', mockDataScope);

            expect(result).toEqual([]);
            expect(guestService.searchGuestVisits).not.toHaveBeenCalled();
        });

        it('should search guest visits with valid search term', async () => {
            const visits = [mockGuestVisit];
            guestService.searchGuestVisits.mockResolvedValue(visits);

            const result = await controller.searchGuestVisits('john', mockDataScope);

            expect(guestService.searchGuestVisits).toHaveBeenCalledWith('john', mockDataScope);
            expect(result).toHaveLength(1);
        });
    });

    describe('getGuestVisitStats', () => {
        it('should return guest visit statistics', async () => {
            const stats = {
                totalVisits: 10,
                visitsByStatus: [
                    { status: 'PENDING_APPROVAL' as any, count: 3 },
                    { status: 'APPROVED' as any, count: 4 },
                    { status: 'COMPLETED' as any, count: 3 },
                ],
                visitsByBranch: [{ branchId: 'branch-123', branchName: 'Main Branch', count: 10 }],
            };

            guestService.getGuestVisitStats.mockResolvedValue(stats);

            const result = await controller.getGuestVisitStats(mockDataScope, {});

            expect(guestService.getGuestVisitStats).toHaveBeenCalledWith({}, mockDataScope);
            expect(result.totalVisits).toBe(10);
            expect(result.visitsByStatus).toHaveLength(3);
            expect(result.visitsByBranch).toHaveLength(1);
        });
    });

    describe('expireOverdueVisits', () => {
        it('should expire overdue visits', async () => {
            guestService.expireOverdueVisits.mockResolvedValue(5);

            const result = await controller.expireOverdueVisits(mockDataScope);

            expect(guestService.expireOverdueVisits).toHaveBeenCalledWith(mockDataScope);
            expect(result.expiredCount).toBe(5);
        });
    });
});
