import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse, ApiMetaDto } from '../dto/api-response.dto';
import { PaginationResponseDto } from '../dto/pagination.dto';
import { BYPASS_RESPONSE_INTERCEPTOR } from '../decorators/bypass-interceptor.decorator';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
    constructor(private readonly reflector: Reflector) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler
    ): Observable<any> {
        const bypass = this.reflector.get<boolean>(
            BYPASS_RESPONSE_INTERCEPTOR,
            context.getHandler()
        );

        if (bypass) {
            return next.handle();
        }

        const httpContext = context.switchToHttp();
        const response = httpContext.getResponse();

        return next.handle().pipe(
            map(data => {
                // For 204 No Content, NestJS returns an empty string.
                // We'll transform it into a standard success response with null data.
                if (response.statusCode === HttpStatus.NO_CONTENT || data === undefined) {
                    response.status(HttpStatus.OK); // Change status to 200 for a consistent body
                    return new ApiSuccessResponse(null);
                }

                // Handle paginated data
                if (data instanceof PaginationResponseDto) {
                    const meta = new ApiMetaDto();
                    meta.itemCount = data.data.length;
                    meta.totalItems = data.total;
                    meta.itemsPerPage = data.limit;
                    meta.totalPages = Math.ceil(data.total / data.limit);
                    meta.currentPage = data.page;

                    return new ApiSuccessResponse(data.data as any, meta);
                }

                // Handle all other successful responses
                return new ApiSuccessResponse(data);
            })
        );
    }
}
