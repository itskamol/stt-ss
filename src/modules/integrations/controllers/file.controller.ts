import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@/shared/decorators/public.decorator';
import { IStorageAdapter } from '../adapters/interfaces/storage.adapter';
import { BypassResponseInterceptor } from '@/shared/decorators';
import { ApiErrorResponse } from '@/shared/dto';

@ApiTags('Integrations')
@Controller('files')
export class FileController {
    constructor(
        @Inject('IStorageAdapter')
        private readonly storageAdapter: IStorageAdapter
    ) {}

    @Get(':key(*)')
    @Public()
    @BypassResponseInterceptor()
    @ApiOperation({ summary: 'Get a file by its key' })
    @ApiParam({ name: 'key', description: 'The key of the file to retrieve' })
    @ApiResponse({ status: 200, description: 'The file stream.' })
    @ApiResponse({ status: 404, description: 'File not found.', type: ApiErrorResponse })
    async getFile(@Param('key') key: string, @Res() res: Response) {
        try {
            const result = await this.storageAdapter.downloadFile(key);
            
            res.set({
                'Content-Type': result.contentType || 'application/octet-stream',
                'Content-Length': result.contentLength.toString(),
                'ETag': `W/"${Date.now()}"`,
                'Cache-Control': 'public, max-age=3600',
            });

            result.stream.pipe(res);
        } catch (error) {
            throw new NotFoundException('File not found');
        }
    }
}