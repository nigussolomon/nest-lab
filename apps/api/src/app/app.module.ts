import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DrizzleModule } from '@nest-lab/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

@Module({
  imports: [DrizzleModule.forRoot(drizzle(pool))],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
