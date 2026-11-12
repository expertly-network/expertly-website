import { PartialType, PickType } from '@nestjs/swagger';
import { UpdateApplicationDto } from './update-application.dto';

// Admin corrections applied to the member profile on approval (never to the application). Same
// validators and limits as the applicant's own fields, so an admin can't store what an applicant
// couldn't. PickType/PartialType from @nestjs/swagger carry the class-validator metadata over.
export class ProfileOverridesDto extends PartialType(
  PickType(UpdateApplicationDto, [
    'firstName',
    'lastName',
    'contactEmail',
    'workEmail',
    'phoneCountryCode',
    'phone',
    'region',
    'country',
    'state',
    'city',
    'linkedinUrl',
    'bio',
    'yearsOfExperience',
    'rateMinCents',
    'rateMaxCents',
    'workExperiences',
    'educations',
  ] as const)
) {}
