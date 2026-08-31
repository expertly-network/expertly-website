import { ApiProperty } from '@nestjs/swagger';

export type PracticeAreaCategory = 'taxation' | 'legal' | 'finance_advisory';

export class PracticeAreaDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['taxation', 'legal', 'finance_advisory'] }) category!: PracticeAreaCategory;
  // Decorative-only representative image (directory/homepage chip art) — null until set,
  // never blocks rendering.
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
}
