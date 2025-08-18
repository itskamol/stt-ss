import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ApiMetaDto {
    @ApiProperty({
        description: 'The number of items on the current page.',
        example: 10,
    })
    itemCount: number;

    @ApiProperty({
        description: 'The total number of items available.',
        example: 100,
    })
    totalItems: number;

    @ApiProperty({
        description: 'The number of items per page.',
        example: 10,
    })
    itemsPerPage: number;

    @ApiProperty({
        description: 'The total number of pages.',
        example: 10,
    })
    totalPages: number;

    @ApiProperty({
        description: 'The current page number.',
        example: 1,
    })
    currentPage: number;
}

export class ApiSuccessResponse<T> {
    @ApiProperty({
        description: 'Indicates if the request was successful.',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'The main data payload of the response.',
        oneOf: [{ $ref: getSchemaPath(ApiMetaDto) }], // This is a placeholder
    })
    data: T;

    @ApiProperty({
        description: 'Optional metadata, typically used for pagination.',
        required: false,
        type: ApiMetaDto,
    })
    @Type(() => ApiMetaDto)
    meta?: ApiMetaDto;

    constructor(data: T, meta?: ApiMetaDto) {
        this.success = true;
        this.data = data;
        this.meta = meta;
    }
}

export class ApiErrorDto {
    @ApiProperty({
        description: 'A unique, machine-readable error code.',
        example: 'VALIDATION_ERROR',
    })
    code: string;

    @ApiProperty({
        description: 'A human-readable message providing details about the error.',
        example: 'Input validation failed',
    })
    message: string;

    @ApiProperty({
        description: 'An array of detailed error messages, often used for validation errors.',
        example: [
            {
                field: 'email',
                message: 'Email must be a valid email address.',
            },
        ],
        required: false,
    })
    details?: any;
}

export class ApiErrorResponse {
    @ApiProperty({
        description: 'Indicates if the request was successful.',
        example: false,
    })
    success: boolean;

    @ApiProperty({
        description: 'The detailed error information.',
        type: ApiErrorDto,
    })
    error: ApiErrorDto;

    @ApiProperty({
        description: 'The server timestamp when the error occurred.',
    })
    timestamp: string;

    @ApiProperty({
        description: 'A unique identifier for the request, useful for logging and troubleshooting.',
    })
    correlationId: string;

    constructor(error: ApiErrorDto, correlationId: string) {
        this.success = false;
        this.error = error;
        this.timestamp = new Date().toISOString();
        this.correlationId = correlationId;
    }
}
