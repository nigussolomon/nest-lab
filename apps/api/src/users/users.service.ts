import { Injectable } from '@nestjs/common';
import { CrudService, DrizzleService } from '@nest-lab/core';
import { users } from '../schema/users.schema';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService extends CrudService<
  typeof users,
  CreateUserDto,
  UpdateUserDto
> {
  constructor(drizzleService: DrizzleService) {
    super(users, drizzleService, users.id);
  }
}
