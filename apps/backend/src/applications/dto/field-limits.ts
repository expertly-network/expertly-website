// Upper bounds for the application form's free-text fields, shared by its DTOs. Generous enough
// for any real value (incl. LinkedIn-imported ones); they exist to cap payload size.
export const NAME_MAX = 100;
export const PHONE_MAX = 40;
export const PLACE_MAX = 100;
export const EMAIL_MAX = 254;
export const URL_MAX = 2048;
/** Job titles, company/institution/degree names — LinkedIn allows up to ~100-200 characters. */
export const LABEL_MAX = 200;
export const FREE_TEXT_MAX = 2000;
/** Plausible bounds for a career/education year. */
export const YEAR_MIN = 1900;
export const YEAR_MAX = 2100;
