import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// PATCH /consultations/:id — one update endpoint for both participants, authorized per field in
// the service: the member decides (`status` + `responseMessage`, sent together), the requester
// rates a completed request (`rating`). The admin route keeps its own UpdateConsultationStatusDto.
export class UpdateConsultationDto {
  @IsOptional()
  @IsIn(['completed', 'declined'])
  status?: 'completed' | 'declined';

  // Required alongside `status` (checked in the service) — the requester sees this, so a bare
  // status flip with no explanation isn't enough context.
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  responseMessage?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
