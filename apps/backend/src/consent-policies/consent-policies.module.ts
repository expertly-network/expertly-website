import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsentPoliciesController } from './consent-policies.controller';
import { ConsentPoliciesService } from './consent-policies.service';
import { ConsentPoliciesRepository } from './consent-policies.repository';

@Module({
  imports: [AuthModule],
  controllers: [ConsentPoliciesController],
  providers: [ConsentPoliciesService, ConsentPoliciesRepository],
  exports: [ConsentPoliciesService],
})
export class ConsentPoliciesModule {}
