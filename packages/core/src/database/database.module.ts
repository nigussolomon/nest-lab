import { DynamicModule, Global, Module } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleService } from './database.service';
import { DRIZZLE } from './database.constants';

@Global()
@Module({})
export class DrizzleModule {
  static forRoot(db: NodePgDatabase): DynamicModule {
    return {
      module: DrizzleModule,
      providers: [{ provide: DRIZZLE, useValue: db }, DrizzleService],
      exports: [DrizzleService],
    };
  }
}
