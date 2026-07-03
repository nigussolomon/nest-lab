import { Injectable } from '@nestjs/common';
import { CrudService, DrizzleService } from '@nest-lab/core';
import { posts } from '../schema/posts.schema';
import { CreatePostDto, UpdatePostDto } from './dto';

@Injectable()
export class PostsService extends CrudService<
  typeof posts,
  CreatePostDto,
  UpdatePostDto
> {
  constructor(drizzleService: DrizzleService) {
    super(posts, drizzleService, posts.id);
  }
}
