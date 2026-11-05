import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ConsentPolicyUrlDto } from '@shared/consent-policy';
import { ConsentPoliciesService } from './consent-policies.service';

// 🌐 GET /v1/consent-policies/:slug — signed PDF url, no auth required.
@Controller('consent-policies')
export class ConsentPoliciesController {
  constructor(private readonly consentPoliciesService: ConsentPoliciesService) {}

  @Public()
  @Get(':slug')
  getContentUrl(@Param('slug') slug: string): Promise<ConsentPolicyUrlDto> {
    return this.consentPoliciesService.getContentUrl(slug);
  }
}
