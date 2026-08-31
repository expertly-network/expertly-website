import { IsBoolean } from 'class-validator';

export class RecordConsentDto {
  @IsBoolean()
  marketingConsent!: boolean;
}
