import { GuestVisit } from '@prisma/client';

export interface GuestVisitWithCredentials extends GuestVisit {
    accessCredentials?: string;
}
