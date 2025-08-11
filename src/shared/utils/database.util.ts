import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export class DatabaseUtil {
    /**
     * Handle Prisma errors and convert them to appropriate HTTP exceptions
     */
    static handlePrismaError(error: any): never {
        if (error instanceof PrismaClientKnownRequestError) {
            switch (error.code) {
                case 'P2002':
                    // Unique constraint violation
                    const field = error.meta?.target as string[];
                    throw new ConflictException(
                        `A record with this ${field?.join(', ') || 'value'} already exists`
                    );

                case 'P2025':
                    // Record not found
                    throw new NotFoundException('Record not found');

                case 'P2003':
                    // Foreign key constraint violation
                    throw new BadRequestException('Invalid reference to related record');

                case 'P2014':
                    // Required relation violation
                    throw new BadRequestException('Required relation is missing');

                default:
                    throw new BadRequestException('Database operation failed');
            }
        }

        throw error;
    }

    /**
     * Check if error is a unique constraint violation
     */
    static isUniqueConstraintError(error: any): boolean {
        return error instanceof PrismaClientKnownRequestError && error.code === 'P2002';
    }

    /**
     * Check if error is a record not found error
     */
    static isRecordNotFoundError(error: any): boolean {
        return error instanceof PrismaClientKnownRequestError && error.code === 'P2025';
    }

    /**
     * Extract field names from unique constraint error
     */
    static getUniqueConstraintFields(error: any): string[] {
        if (this.isUniqueConstraintError(error)) {
            return (error.meta?.target as string[]) || [];
        }
        return [];
    }
}
