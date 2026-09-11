import { Injectable } from '@nestjs/common';
import { PracticeAreasRepository } from './practice-areas.repository';
import type { PracticeAreaDto } from '@shared/practice-area';

@Injectable()
export class PracticeAreasService {
  constructor(private readonly practiceAreasRepository: PracticeAreasRepository) {}

  async list(): Promise<PracticeAreaDto[]> {
    return this.practiceAreasRepository.findAllActive();
  }
}
