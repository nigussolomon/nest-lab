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
import {
  InferInsertModel,
  InferSelectModel,
  SQL,
  and,
  or,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  ilike,
  like,
  inArray,
  notInArray,
  isNull,
  isNotNull,
} from 'drizzle-orm';
import { DrizzleService } from '../database/database.service';

export type EndpointName = 'findAll' | 'findOne' | 'create' | 'update' | 'delete';

export type ServiceColumns<TService extends CrudService<AnyPgTable>> =
  TService extends CrudService<infer TTable, any, any, any>
    ? string & keyof InferSelectModel<TTable>
    : string;

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'like'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull';

const OPERATOR_SUFFIXES: Record<string, FilterOperator> = {
  eq: 'eq',
  ne: 'ne',
  contains: 'contains',
  starts: 'startsWith',
  ends: 'endsWith',
  like: 'like',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  in: 'in',
  notin: 'notIn',
  'not_in': 'notIn',
  null: 'isNull',
  notnull: 'isNotNull',
  'not_null': 'isNotNull',
};

const DEFAULT_OPERATOR: FilterOperator = 'contains';

export interface CrudControllerOptions<
  TService extends CrudService<AnyPgTable>,
  TColumn extends string = ServiceColumns<TService>,
> {
  service: abstract new (...args: never[]) => TService;
  path: string;
  createDto?: new (...args: any[]) => any;
  updateDto?: new (...args: any[]) => any;
  responseDto?: new (...args: any[]) => any;
  handlers?: CrudHandlers<TService>;
  exclude?: EndpointName[];
  allowedFilters?: TColumn[];
}

export interface CrudHandlers<TService extends CrudService<AnyPgTable>> {
  findAll?: (this: { service: TService }, query: Record<string, string>) => Promise<any>;
  findOne?: (this: { service: TService }, id: string) => Promise<any>;
  create?: (this: { service: TService }, data: Parameters<TService['create']>[0]) => Promise<any>;
  update?: (this: { service: TService }, id: string, data: Parameters<TService['updateById']>[1]) => Promise<any>;
  delete?: (this: { service: TService }, id: string) => Promise<any>;
}

export interface FilterEntry {
  column: string;
  operator: FilterOperator;
  value: string;
}

export interface FindAllOptions {
  where?: SQL;
  limit?: number;
  offset?: number;
  filters?: FilterEntry[];
  orFilters?: FilterEntry[];
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

    function buildCondition(
      col: unknown,
      value: string,
      op: FilterOperator,
    ): SQL | null {
      const column = col as AnyPgColumn;
      switch (op) {
        case 'eq':
          return eq(column, value);
        case 'ne':
          return ne(column, value);
        case 'contains':
          return ilike(column, `%${value}%`);
        case 'startsWith':
          return ilike(column, `${value}%`);
        case 'endsWith':
          return ilike(column, `%${value}`);
        case 'like':
          return like(column, value);
        case 'gt':
          return gt(column, value);
        case 'gte':
          return gte(column, value);
        case 'lt':
          return lt(column, value);
        case 'lte':
          return lte(column, value);
        case 'in':
          return inArray(column, value.split(',').map((v) => v.trim()));
        case 'notIn':
          return notInArray(column, value.split(',').map((v) => v.trim()));
        case 'isNull':
          return isNull(column);
        case 'isNotNull':
          return isNotNull(column);
        default:
          return ilike(column, `%${value}%`);
      }
    }

    const mapEntries = (entries: FilterEntry[] | undefined) => {
      return (entries ?? [])
        .map((e) => {
          const col = (this.table as Record<string, unknown>)[e.column];
          if (!col) return null;
          if (e.operator === 'isNull' || e.operator === 'isNotNull') {
            return buildCondition(col, '', e.operator);
          }
          if (!e.value) return null;
          return buildCondition(col, e.value, e.operator);
        })
        .filter((c): c is SQL => c !== null);
    };

    const andConditions = mapEntries(options?.filters);
    const orConditions = mapEntries(options?.orFilters);

    if (options?.where) andConditions.push(options.where);

    const andGroup = andConditions.length > 0 ? (and(...andConditions) as SQL) : null;
    const orGroup = orConditions.length > 0 ? (or(...orConditions) as SQL) : null;

    if (andGroup && orGroup) {
      query.where(or(andGroup, orGroup) as SQL);
    } else if (andGroup) {
      query.where(andGroup);
    } else if (orGroup) {
      query.where(orGroup);
    }

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

function parseFilterParam(
  key: string,
  allowedFields: Set<string>,
): { field: string; operator: FilterOperator; or: boolean } | null {
  const parts = key.split('__');
  const field = parts[0];
  if (!allowedFields.has(field)) return null;

  let operator: FilterOperator = DEFAULT_OPERATOR;
  let or = false;

  for (const suffix of parts.slice(1)) {
    const lower = suffix.toLowerCase();
    if (lower === 'or') {
      or = true;
    } else {
      const op = OPERATOR_SUFFIXES[lower];
      if (op) operator = op;
    }
  }

  return { field, operator, or };
}

const GENERATED_QUERY_PARAMS = [
  { suffix: '', label: 'contains' },
  { suffix: '__eq', label: 'eq' },
  { suffix: '__ne', label: 'ne' },
  { suffix: '__contains', label: 'contains' },
  { suffix: '__starts', label: 'starts with' },
  { suffix: '__ends', label: 'ends with' },
  { suffix: '__like', label: 'SQL like' },
  { suffix: '__gt', label: 'greater than' },
  { suffix: '__gte', label: '>= ' },
  { suffix: '__lt', label: 'less than' },
  { suffix: '__lte', label: '<=' },
  { suffix: '__in', label: 'in list (csv)' },
  { suffix: '__notin', label: 'not in list' },
  { suffix: '__null', label: 'is null' },
  { suffix: '__notnull', label: 'is not null' },
];

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
  const allowedFields = new Set(allowedFilters);

  function filterQueries(): MethodDecorator {
    return (target, key, descriptor) => {
      for (const field of allowedFields) {
        for (const { suffix, label } of GENERATED_QUERY_PARAMS) {
          const isDefault = suffix === '';
          ApiQuery({
            name: `${field}${suffix}`,
            required: false,
            type: String,
            description: isDefault
              ? `Filter by ${field}`
              : `Filter by ${field} (${label})`,
          })(target, key, descriptor);
        }
        ApiQuery({
          name: `${field}__or`,
          required: false,
          type: String,
          description: `Filter by ${field} (OR)`,
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

      const andFilters: FilterEntry[] = [];
      const orFilters: FilterEntry[] = [];

      for (const [key, value] of Object.entries(query)) {
        const parsed = parseFilterParam(key, allowedFields);
        if (!parsed) continue;
        const target = parsed.or ? orFilters : andFilters;
        target.push({
          column: parsed.field,
          operator: parsed.operator,
          value,
        });
      }

      return this.service.findAll({ filters: andFilters, orFilters });
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
