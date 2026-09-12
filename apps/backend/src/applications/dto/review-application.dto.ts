import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewApplicationDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  // Required when status is 'rejected'.
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
