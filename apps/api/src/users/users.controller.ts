import { CrudControllerFactory } from '@nest-lab/core';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';

export const UsersController = CrudControllerFactory({
  service: UsersService,
  path: 'users',
  createDto: CreateUserDto,
  updateDto: UpdateUserDto,
  responseDto: UserResponseDto,
  allowedFilters: [
    { name: 'name', description: 'Search by display name', example: 'John' },
    {
      name: 'email',
      description: 'Search by email',
      example: 'user@example.com',
    },
  ],
});
