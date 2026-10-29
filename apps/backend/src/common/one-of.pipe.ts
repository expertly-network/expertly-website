import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// Optional enum-like query param: absent/empty passes through as undefined, a listed value passes
// as-is, anything else is a 400 — instead of reaching Postgres as a bad enum cast (a 500).
@Injectable()
export class OptionalOneOfPipe<T extends string> implements PipeTransform<unknown, T | undefined> {
  constructor(
    private readonly name: string,
    private readonly allowed: readonly T[]
  ) {}

  transform(value: unknown): T | undefined {
    if (value === undefined || value === '') return undefined;
    if (typeof value === 'string' && (this.allowed as readonly string[]).includes(value)) return value as T;
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: [`${this.name} must be one of: ${this.allowed.join(', ')}`],
    });
  }
}
