import { Attendance, Device, Employee } from '@prisma/client';

export interface AttendanceWithRelations extends Attendance {
    employee?: Employee;
    device?: Device;
}
