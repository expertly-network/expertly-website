import { PartialType, PickType } from '@nestjs/swagger';
import { UpdateApplicationDto } from './update-application.dto';

// Admin corrections applied to the member profile on approval (never to the application). Same
// validators and limits as the applicant's own fields, so an admin can't store what an applicant
// couldn't. Region isn't here: like the applicant's own saves, it's derived from country.
// PickType/PartialType from @nestjs/swagger carry the class-validator metadata over.
export class ProfileOverridesDto extends PartialType(
  PickType(UpdateApplicationDto, [
    'firstName',
    'lastName',
    'contactEmail',
    'workEmail',
    'phoneCountryCode',
    'phone',
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
