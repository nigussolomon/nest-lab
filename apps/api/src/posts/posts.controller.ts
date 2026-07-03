import { CrudControllerFactory } from '@nest-lab/core';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto, PostResponseDto } from './dto';
import { users } from '../schema/users.schema';
import { categories } from '../schema/categories.schema';

export const PostsController = CrudControllerFactory({
  service: PostsService,
  path: 'posts',
  createDto: CreatePostDto,
  updateDto: UpdatePostDto,
  responseDto: PostResponseDto,
  allowedFilters: ['title', 'content', 'authorId'],
  relations: {
    author: {
      table: users,
      on: { local: 'authorId', target: 'id' },
      relations: {
        category: {
          table: categories,
          on: { local: 'categoryId', target: 'id' },
        },
      },
    },
  },
});
