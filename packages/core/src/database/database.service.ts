import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from './database.module';

@Injectable()
export class DrizzleService {
  constructor(@Inject(DRIZZLE) readonly db: NodePgDatabase) {}
}
