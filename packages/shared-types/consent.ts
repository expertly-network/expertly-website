import { ApiProperty } from '@nestjs/swagger';

export class RecordConsentRequest {
  @ApiProperty() marketingConsent!: boolean;
}

export class ConsentStatusDto {
  @ApiProperty() termsAccepted!: boolean;
  @ApiProperty() marketingConsent!: boolean;
}
