import { CrudControllerFactory } from '@nest-lab/core';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto';

export const CategoriesController = CrudControllerFactory({
  service: CategoriesService,
  path: 'categories',
  createDto: CreateCategoryDto,
  updateDto: UpdateCategoryDto,
  responseDto: CategoryResponseDto,
  allowedFilters: ['name'],
});
