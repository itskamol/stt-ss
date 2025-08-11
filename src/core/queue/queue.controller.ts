import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueProducer } from './queue.producer';
import { Permissions, Public } from '../../shared/decorators';

@Controller('admin/queues')
export class QueueController {
    constructor(
        private readonly queueService: QueueService,
        private readonly queueProducer: QueueProducer
    ) {}

    @Get('stats')
    @Permissions('admin:queue:read')
    async getQueueStats() {
        return this.queueService.getAllQueueStats();
    }

    @Get(':queueName/stats')
    @Permissions('admin:queue:read')
    async getQueueStatsByName(@Param('queueName') queueName: string) {
        return this.queueService.getQueueStats(queueName);
    }

    @Post(':queueName/clean')
    @Permissions('admin:queue:manage')
    @HttpCode(HttpStatus.OK)
    async cleanQueue(@Param('queueName') queueName: string, @Query('grace') grace?: number) {
        const cleanedCount = await this.queueService.cleanQueue(
            queueName,
            grace ? parseInt(grace.toString()) : undefined
        );

        return {
            queueName,
            cleanedCount,
            timestamp: new Date(),
        };
    }

    @Post(':queueName/retry-failed')
    @Permissions('admin:queue:manage')
    @HttpCode(HttpStatus.OK)
    async retryFailedJobs(@Param('queueName') queueName: string) {
        const retriedCount = await this.queueService.retryFailedJobs(queueName);

        return {
            queueName,
            retriedCount,
            timestamp: new Date(),
        };
    }

    @Post('health-check')
    @Permissions('admin:system:manage')
    @HttpCode(HttpStatus.OK)
    async triggerHealthCheck() {
        const job = await this.queueProducer.scheduleHealthCheck({
            checkType: 'database',
        });

        return {
            jobId: job.id,
            message: 'Health check scheduled',
            timestamp: new Date(),
        };
    }

    @Post('monitoring')
    @Permissions('admin:system:manage')
    @HttpCode(HttpStatus.OK)
    async triggerQueueMonitoring() {
        const job = await this.queueProducer.scheduleQueueMonitoring();

        return {
            jobId: job.id,
            message: 'Queue monitoring scheduled',
            timestamp: new Date(),
        };
    }

    @Get('health')
    @Public()
    async getQueueHealth() {
        try {
            const stats = await this.queueService.getAllQueueStats();

            const totalFailed = stats.reduce((sum, stat) => sum + stat.failed, 0);
            const totalWaiting = stats.reduce((sum, stat) => sum + stat.waiting, 0);

            const isHealthy = totalFailed < 50 && totalWaiting < 500;

            return {
                status: isHealthy ? 'healthy' : 'degraded',
                queues: stats,
                totalFailed,
                totalWaiting,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date(),
            };
        }
    }
}
