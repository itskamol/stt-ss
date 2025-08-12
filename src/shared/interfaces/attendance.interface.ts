import { Attendance, Employee, Device } from '@prisma/client';

export interface AttendanceWithRelations extends Attendance {
    employee?: Employee;
    device?: Device;
}
