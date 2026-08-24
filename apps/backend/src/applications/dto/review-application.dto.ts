import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewApplicationDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  // Required when status is 'rejected' — checked in ApplicationsService, not here, matching this
  // codebase's convention of cross-field rules living in the service (see e.g.
  // UpdateApplicationDto's rateMaxCents > rateMinCents comment).
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
