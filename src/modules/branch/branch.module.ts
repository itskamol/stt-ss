import { Module } from '@nestjs/common';
import { BranchController } from './branch.controller';
import { BranchRepository } from './branch.repository';
import { BranchService } from './branch.service';

@Module({
    controllers: [BranchController],
    providers: [BranchRepository, BranchService],
    exports: [BranchRepository, BranchService],
})
export class BranchModule {}
