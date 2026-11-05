import { ApiProperty } from '@nestjs/swagger';

export class ConsentPolicyUrlDto {
  /** Short-lived signed URL to the PDF — displays inline in a new tab, never forces a download. */
  @ApiProperty() contentUrl!: string;
}
