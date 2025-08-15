import { Controller, Get, Param, Res, NotFoundException, Inject } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '@/shared/decorators/public.decorator';
import { IStorageAdapter } from '../adapters/interfaces/storage.adapter';

@Controller('files')
export class FileController {
    constructor(
        @Inject('IStorageAdapter')
        private readonly storageAdapter: IStorageAdapter
    ) {}

    @Get(':key')
    @Public()
    async getFile(@Param('key') key: string, @Res() res: Response) {
        try {
            const result = await this.storageAdapter.downloadFile(key);
            
            res.set({
                'Content-Type': 'image/jpeg',
                'Content-Length': result.contentLength,
                'ETag': `W/"${Date.now()}"`,
                'Cache-Control': 'public, max-age=3600',
            });

            result.stream.pipe(res);
        } catch (error) {
            throw new NotFoundException('File not found');
        }
    }
}