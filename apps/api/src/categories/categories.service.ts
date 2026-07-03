import { Injectable } from '@nestjs/common';
import { CrudService, DrizzleService } from '@nest-lab/core';
import { categories } from '../schema/categories.schema';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService extends CrudService<
  typeof categories,
  CreateCategoryDto,
  UpdateCategoryDto
> {
  constructor(drizzleService: DrizzleService) {
    super(categories, drizzleService, categories.id);
  }
}
