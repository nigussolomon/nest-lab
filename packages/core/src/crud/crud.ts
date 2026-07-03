import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AnyPgTable, AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel, SQL, and, eq, ilike } from 'drizzle-orm';
import { DrizzleService } from '../database/database.service';

export type EndpointName = 'findAll' | 'findOne' | 'create' | 'update' | 'delete';

export type FilterOperator = 'eq' | 'contains';

export interface FilterConfig {
  name: string;
  description?: string;
  example?: string;
  required?: boolean;
  operator?: FilterOperator;
}

export type AllowedFilter = string | FilterConfig;

export interface CrudControllerOptions<
  TService extends CrudService<AnyPgTable>,
> {
  service: abstract new (...args: never[]) => TService;
  path: string;
  createDto?: new (...args: any[]) => any;
  updateDto?: new (...args: any[]) => any;
  responseDto?: new (...args: any[]) => any;
  handlers?: CrudHandlers<TService>;
  exclude?: EndpointName[];
  allowedFilters?: AllowedFilter[];
}

export interface CrudHandlers<TService extends CrudService<AnyPgTable>> {
  findAll?: (this: { service: TService }, query: Record<string, string>) => Promise<any>;
  findOne?: (this: { service: TService }, id: string) => Promise<any>;
  create?: (this: { service: TService }, data: Parameters<TService['create']>[0]) => Promise<any>;
  update?: (this: { service: TService }, id: string, data: Parameters<TService['updateById']>[1]) => Promise<any>;
  delete?: (this: { service: TService }, id: string) => Promise<any>;
}

export interface FindAllOptions {
  where?: SQL;
  limit?: number;
  offset?: number;
  filters?: Record<string, string>;
  filterConfigs?: FilterConfig[];
}

export class CrudService<
  TTable extends AnyPgTable,
  TCreate = InferInsertModel<TTable>,
  TUpdate = Partial<InferInsertModel<TTable>>,
  TResponse = InferSelectModel<TTable>,
> {
  constructor(
    protected readonly table: TTable,
    protected readonly drizzleService: DrizzleService,
    protected readonly pkColumn?: AnyPgColumn,
  ) {}

  protected get db() {
    return this.drizzleService.db;
  }

  async findAll(options?: FindAllOptions): Promise<TResponse[]> {
    const query = this.db
      .select()
      .from(this.table as PgTable)
      .$dynamic();

    const conditions: SQL[] = [];

    if (options?.filters) {
      const configMap = new Map(
        (options.filterConfigs ?? []).map((fc) => [fc.name, fc]),
      );
      for (const [key, value] of Object.entries(options.filters)) {
        const column = (this.table as Record<string, unknown>)[key];
        if (!column || !value) continue;
        const operator = configMap.get(key)?.operator ?? 'contains';
        if (operator === 'contains') {
          conditions.push(ilike(column as AnyPgColumn, `%${value}%`));
        } else {
          conditions.push(eq(column as AnyPgColumn, value));
        }
      }
    }

    if (options?.where) conditions.push(options.where);
    if (conditions.length > 0) query.where(and(...conditions));
    if (options?.limit) query.limit(options.limit);
    if (options?.offset) query.offset(options.offset);
    return query as unknown as Promise<TResponse[]>;
  }

  async findOne(where: SQL): Promise<TResponse | undefined> {
    const rows = await (this.db
      .select()
      .from(this.table as PgTable)
      .where(where)
      .limit(1) as unknown as Promise<TResponse[]>);
    return rows[0];
  }

  async findById(id: string | number): Promise<TResponse | undefined> {
    if (!this.pkColumn) {
      throw new Error('Primary key column not set');
    }
    const rows = await (this.db
      .select()
      .from(this.table as PgTable)
      .where(eq(this.pkColumn as AnyPgColumn, id))
      .limit(1) as unknown as Promise<TResponse[]>);
    return rows[0];
  }

  async create(data: TCreate): Promise<TResponse> {
    const rows = await (this.db
      .insert(this.table as PgTable)
      .values(data as InferInsertModel<TTable>)
      .returning() as unknown as Promise<TResponse[]>);
    return rows[0];
  }

  async update(where: SQL, data: TUpdate): Promise<TResponse> {
    const rows = await (this.db
      .update(this.table as PgTable)
      .set(data as Partial<InferInsertModel<TTable>>)
      .where(where)
      .returning() as unknown as Promise<TResponse[]>);
    return rows[0];
  }

  async updateById(id: string | number, data: TUpdate): Promise<TResponse> {
    if (!this.pkColumn) {
      throw new Error('Primary key column not set');
    }
    return this.update(eq(this.pkColumn as AnyPgColumn, id), data);
  }

  async delete(where: SQL): Promise<TResponse> {
    const rows = await (this.db
      .delete(this.table as PgTable)
      .where(where)
      .returning() as unknown as Promise<TResponse[]>);
    return rows[0];
  }

  async deleteById(id: string | number): Promise<TResponse> {
    if (!this.pkColumn) {
      throw new Error('Primary key column not set');
    }
    return this.delete(eq(this.pkColumn as AnyPgColumn, id));
  }
}

export function CrudControllerFactory<TService extends CrudService<AnyPgTable>>(
  options: CrudControllerOptions<TService>,
) {
  const {
    service: serviceClass,
    path,
    createDto,
    updateDto,
    responseDto,
    handlers,
    exclude = [],
    allowedFilters = [],
  } = options;

  const excludeSet = new Set(exclude);

  const filterConfigs: FilterConfig[] = allowedFilters.map((f) =>
    typeof f === 'string' ? { name: f } : f,
  );

  function filterQueries(): MethodDecorator {
    return (target, key, descriptor) => {
      for (const fc of filterConfigs) {
        ApiQuery({
          name: fc.name,
          required: fc.required ?? false,
          type: String,
          description: fc.description ?? `Filter results by ${fc.name}`,
          ...(fc.example ? { example: fc.example } : {}),
        })(target, key, descriptor);
      }
    };
  }

  @Controller(path)
  @ApiTags(path)
  class CrudControllerHost {
    constructor(
      @Inject(serviceClass) public readonly service: TService,
    ) {}

    @Get()
    @filterQueries()
    @ApiOperation({ summary: `List all ${path}` })
    @ApiOkResponse(
      responseDto
        ? { type: responseDto, isArray: true }
        : { description: 'OK' },
    )
    async findAll(@Query() query: Record<string, string>) {
      if (handlers?.findAll) return handlers.findAll.call(this, query);
      const filters: Record<string, string> = {};
      for (const { name } of filterConfigs) {
        if (query[name] !== undefined) {
          filters[name] = query[name];
        }
      }
      return this.service.findAll({ filters, filterConfigs });
    }

    @Get(':id')
    @ApiOperation({ summary: `Get ${path} by ID` })
    @ApiParam({ name: 'id', type: String })
    @ApiOkResponse(responseDto ? { type: responseDto } : { description: 'OK' })
    @ApiNotFoundResponse({ description: 'Not found' })
    async findOne(@Param('id') id: string) {
      if (handlers?.findOne) return handlers.findOne.call(this, id);
      return this.service.findById(id);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: `Create ${path}` })
    @ApiBody(
      createDto ? { type: createDto } : { description: 'Create payload' },
    )
    @ApiCreatedResponse(
      responseDto ? { type: responseDto } : { description: 'Created' },
    )
    async create(@Body() data: Parameters<TService['create']>[0]) {
      if (handlers?.create) return handlers.create.call(this, data);
      return this.service.create(data);
    }

    @Patch(':id')
    @ApiOperation({ summary: `Update ${path}` })
    @ApiParam({ name: 'id', type: String })
    @ApiBody(
      updateDto ? { type: updateDto } : { description: 'Update payload' },
    )
    @ApiOkResponse(responseDto ? { type: responseDto } : { description: 'OK' })
    @ApiNotFoundResponse({ description: 'Not found' })
    async update(
      @Param('id') id: string,
      @Body() data: Parameters<TService['updateById']>[1],
    ) {
      if (handlers?.update) return handlers.update.call(this, id, data);
      return this.service.updateById(id, data);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: `Delete ${path}` })
    @ApiParam({ name: 'id', type: String })
    @ApiOkResponse(responseDto ? { type: responseDto } : { description: 'OK' })
    @ApiNotFoundResponse({ description: 'Not found' })
    async delete(@Param('id') id: string) {
      if (handlers?.delete) return handlers.delete.call(this, id);
      return this.service.deleteById(id);
    }
  }

  const routeMap: Record<EndpointName, string> = {
    findAll: 'findAll',
    findOne: 'findOne',
    create: 'create',
    update: 'update',
    delete: 'delete',
  };

  for (const [endpoint, methodName] of Object.entries(routeMap)) {
    if (excludeSet.has(endpoint as EndpointName)) {
      const fn = (CrudControllerHost.prototype as any)[methodName];
      if (fn) {
        Reflect.deleteMetadata(PATH_METADATA, fn);
        Reflect.deleteMetadata(METHOD_METADATA, fn);
      }
    }
  }

  return CrudControllerHost;
}
