import { CrudControllerFactory } from '@nest-lab/core';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';

export const UsersController = CrudControllerFactory({
  service: UsersService,
  path: 'users',
  createDto: CreateUserDto,
  updateDto: UpdateUserDto,
  responseDto: UserResponseDto,
  allowedFilters: ['name', 'email', 'id'],
});
