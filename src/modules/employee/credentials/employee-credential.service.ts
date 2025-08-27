import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { EmployeeCredential, CredentialType } from '@prisma/client';
import { EmployeeCredentialRepository } from './employee-credential.repository';
import { EmployeeRepository } from '../employee.repository';
import { DataScope } from '@/shared/interfaces';
import {
    CreateEmployeeCredentialDto,
    UpdateEmployeeCredentialDto,
} from '@/shared/dto';
import { IStorageAdapter } from '@/modules/integrations/adapters/interfaces/storage.adapter';

@Injectable()
export class EmployeeCredentialService {
    constructor(
        private readonly credentialRepository: EmployeeCredentialRepository,
        private readonly employeeRepository: EmployeeRepository,
        @Inject('IStorageAdapter')
        private readonly storageAdapter: IStorageAdapter
    ) {}

    /**
     * Create a new credential for an employee
     */
    async createCredential(
        employeeId: string,
        createDto: CreateEmployeeCredentialDto,
        scope: DataScope,
        createdByUserId: string
    ): Promise<EmployeeCredential> {
        // Verify employee exists and is accessible
        const employee = await this.employeeRepository.findById(employeeId, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        // Check if credential value already exists for this type
        const existingCredential = await this.credentialRepository.existsByTypeAndValue(
            createDto.type,
            createDto.value
        );

        if (existingCredential) {
            throw new ConflictException(
                `A credential of type ${createDto.type} with this value already exists`
            );
        }

        return this.credentialRepository.create(employeeId, createDto, scope);
    }

    /**
     * Create face credential from existing employee photo
     */
    async createFaceCredentialFromPhoto(
        employeeId: string,
        metadata: any,
        scope: DataScope,
        createdByUserId: string
    ): Promise<EmployeeCredential> {
        // Verify employee exists and is accessible
        const employee = await this.employeeRepository.findById(employeeId, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        // Check if employee has a photo
        if (!employee.photoKey) {
            throw new BadRequestException('Employee does not have a photo. Please upload a photo first.');
        }

        // Check if employee already has a face credential
        const existingFaceCredential = await this.credentialRepository.findByEmployeeIdAndType(
            employeeId,
            CredentialType.FACE,
            scope
        );

        // Use the existing photo key as the face credential reference
        const credentialMetadata = {
            ...metadata,
            photoKey: employee.photoKey,
            createdFromPhoto: true,
            createdAt: new Date().toISOString(),
        };

        // Use photo key as the credential value (reference to the stored image)
        const credentialValue = employee.photoKey;

        if (existingFaceCredential) {
            // Update existing face credential
            return this.credentialRepository.update(
                existingFaceCredential.id,
                {
                    value: credentialValue,
                    metadata: credentialMetadata,
                    isActive: true,
                },
                scope
            );
        } else {
            // Create new face credential
            return this.credentialRepository.create(
                employeeId,
                {
                    type: CredentialType.FACE,
                    value: credentialValue,
                    metadata: credentialMetadata,
                    isActive: true,
                },
                scope
            );
        }
    }

    /**
     * Get all credentials for an employee
     */
    async getEmployeeCredentials(
        employeeId: string,
        scope: DataScope
    ): Promise<EmployeeCredential[]> {
        // Verify employee exists and is accessible
        const employee = await this.employeeRepository.findById(employeeId, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        const credentials = await this.credentialRepository.findByEmployeeId(employeeId, scope);
        
        // Mask sensitive credential values for security
        return credentials.map(credential => ({
            ...credential,
            value: this.maskCredentialValue(credential.type, credential.value),
        }));
    }

    /**
     * Get credential by ID
     */
    async getCredentialById(id: string, scope: DataScope): Promise<EmployeeCredential> {
        const credential = await this.credentialRepository.findById(id, scope);
        if (!credential) {
            throw new NotFoundException('Credential not found');
        }

        // Mask sensitive credential value for security
        return {
            ...credential,
            value: this.maskCredentialValue(credential.type, credential.value),
        };
    }

    /**
     * Update credential
     */
    async updateCredential(
        id: string,
        updateDto: UpdateEmployeeCredentialDto,
        scope: DataScope,
        updatedByUserId: string
    ): Promise<EmployeeCredential> {
        const existingCredential = await this.credentialRepository.findById(id, scope);
        if (!existingCredential) {
            throw new NotFoundException('Credential not found');
        }

        // Check if new value conflicts with existing credentials
        if (updateDto.value) {
            const conflictingCredential = await this.credentialRepository.existsByTypeAndValue(
                existingCredential.type,
                updateDto.value,
                id
            );

            if (conflictingCredential) {
                throw new ConflictException(
                    `A credential of type ${existingCredential.type} with this value already exists`
                );
            }
        }

        const updatedCredential = await this.credentialRepository.update(id, updateDto, scope);
        
        // Mask sensitive credential value for security
        return {
            ...updatedCredential,
            value: this.maskCredentialValue(updatedCredential.type, updatedCredential.value),
        };
    }

    /**
     * Delete credential
     */
    async deleteCredential(
        id: string,
        scope: DataScope,
        deletedByUserId: string
    ): Promise<void> {
        const credential = await this.credentialRepository.findById(id, scope);
        if (!credential) {
            throw new NotFoundException('Credential not found');
        }

        // Note: We don't delete the photo file when deleting face credential
        // because the photo might still be used for employee profile
        // The photo should be deleted through the employee photo delete endpoint

        await this.credentialRepository.delete(id, scope);
    }

    /**
     * Get active credentials by type for an employee
     */
    async getActiveCredentialsByType(
        employeeId: string,
        type: CredentialType,
        scope: DataScope
    ): Promise<EmployeeCredential[]> {
        // Verify employee exists and is accessible
        const employee = await this.employeeRepository.findById(employeeId, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        const credentials = await this.credentialRepository.findActiveByEmployeeIdAndType(
            employeeId,
            type,
            scope
        );

        // Mask sensitive credential values for security
        return credentials.map(credential => ({
            ...credential,
            value: this.maskCredentialValue(credential.type, credential.value),
        }));
    }

    /**
     * Mask credential value for security
     */
    private maskCredentialValue(type: CredentialType, value: string): string {
        switch (type) {
            case CredentialType.FACE:
            case CredentialType.FINGERPRINT:
                return '****base64_template****';
            case CredentialType.CARD:
                return value.length > 4 ? `****${value.slice(-4)}` : '****';
            case CredentialType.CAR_NUMBER:
                return value.length > 3 ? `***${value.slice(-3)}` : '***';
            case CredentialType.PASSWORD_HASH:
                return '****hash****';
            case CredentialType.QR_CODE:
                return '****qr_code****';
            default:
                return '****masked****';
        }
    }
}