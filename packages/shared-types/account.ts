import { ApiProperty } from '@nestjs/swagger';

export type AccountRole = 'client' | 'member' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'deleted';
export type AccountMemberStatus = 'active' | 'deactivated';

/** Response shape for GET /v1/me — the caller's identity as the API sees it (from the verified JWT). */
export class MeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['client', 'member', 'admin'] }) role!: AccountRole;
  @ApiProperty({ enum: ['active', 'suspended', 'deleted'] }) status!: AccountStatus;
  /** member_profiles.status; null for non-members. */
  @ApiProperty({ enum: ['active', 'deactivated'], nullable: true, type: String }) memberStatus!: AccountMemberStatus | null;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
}

/** Response shape for GET /v1/me/contact — both null when the caller never set a phone number. */
export class MyContactResponse {
  @ApiProperty({ nullable: true, type: String }) phoneCountryCode!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
}
