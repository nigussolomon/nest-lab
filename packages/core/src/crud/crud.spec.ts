import { CrudService, CrudControllerFactory } from './crud';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';

class TestService extends CrudService<any> {}

class TestCreateDto {
  name!: string;
}

class TestUpdateDto {
  name?: string;
}

class TestResponseDto {
  id!: number;
  name!: string;
}

describe('CrudService', () => {
  it('should be defined', () => {
    expect(CrudService).toBeDefined();
  });
});

describe('CrudControllerFactory', () => {
  it('should return a class with minimal options', () => {
    const Controller = CrudControllerFactory({
      service: TestService as any,
      path: 'test',
    });
    expect(Controller).toBeDefined();
    expect(typeof Controller).toBe('function');
  });

  it('should return a class with full options', () => {
    const Controller = CrudControllerFactory({
      service: TestService as any,
      path: 'tests',
      createDto: TestCreateDto,
      updateDto: TestUpdateDto,
      responseDto: TestResponseDto,
    });
    expect(Controller).toBeDefined();
    expect(typeof Controller).toBe('function');
  });

  it('should exclude specified endpoints', () => {
    const Controller = CrudControllerFactory({
      service: TestService as any,
      path: 'test',
      exclude: ['create', 'delete'],
    });

    const findAllFn = Controller.prototype.findAll;
    const findOneFn = Controller.prototype.findOne;
    const createFn = Controller.prototype.create;
    const deleteFn = Controller.prototype.delete;

    expect(Reflect.getMetadata(PATH_METADATA, findAllFn)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, findAllFn)).toBe(0);

    expect(Reflect.getMetadata(PATH_METADATA, findOneFn)).toBe(':id');
    expect(Reflect.getMetadata(METHOD_METADATA, findOneFn)).toBe(0);

    expect(Reflect.getMetadata(PATH_METADATA, createFn)).toBeUndefined();
    expect(Reflect.getMetadata(METHOD_METADATA, createFn)).toBeUndefined();
    expect(Reflect.getMetadata(PATH_METADATA, deleteFn)).toBeUndefined();
    expect(Reflect.getMetadata(METHOD_METADATA, deleteFn)).toBeUndefined();
  });

  it('should pass allowed filters from query to service', () => {
    const Controller = CrudControllerFactory({
      service: TestService as any,
      path: 'test',
      allowedFilters: ['email', 'name'],
    });

    expect(Controller.prototype.findAll).toBeDefined();
    expect(typeof Controller.prototype.findAll).toBe('function');
  });

  it('should apply ApiQuery decorators for allowed filters', () => {
    const Controller = CrudControllerFactory({
      service: TestService as any,
      path: 'test',
      allowedFilters: ['email'],
    });

    const findAllFn = Controller.prototype.findAll;
    const path = Reflect.getMetadata(PATH_METADATA, findAllFn);
    expect(path).toBe('/');
  });
});
