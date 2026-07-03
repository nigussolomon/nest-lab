import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DrizzleModule } from '@nest-lab/core';
import { UsersModule } from '../users/users.module';
import { PostsModule } from '../posts/posts.module';
import { CategoriesModule } from '../categories/categories.module';
import * as schema from '../schema';

const request = require('supertest');

const databaseUrl = process.env['DATABASE_URL'];
const describeCrud = databaseUrl ? describe : describe.skip;

describeCrud('CRUD e2e', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  let app: INestApplication;
  let server: any;
  let dbOk = false;

  async function cleanDb() {
    await db.delete(schema.posts);
    await db.delete(schema.users);
    await db.delete(schema.categories);
    await db.insert(schema.categories).values([
      { id: 1, name: 'Technology' },
      { id: 2, name: 'Design' },
    ]);
    await db.insert(schema.users).values([
      { id: 1, email: 'john@test.com', name: 'John Doe', categoryId: 1 },
      { id: 2, email: 'jane@test.com', name: 'Jane Smith', categoryId: 1 },
      { id: 3, email: 'bob@test.com', name: 'Bob Brown', categoryId: 2 },
      { id: 4, email: 'admin@test.com', name: 'Alice Admin' },
    ]);
    await db.insert(schema.posts).values([
      { id: 1, title: 'Intro to NestJS', content: 'NestJS rocks', authorId: 1 },
      { id: 2, title: 'Drizzle Guide', content: 'ORM basics', authorId: 1 },
      {
        id: 3,
        title: 'Design Patterns',
        content: 'Learn patterns',
        authorId: 2,
      },
    ]);
    await pool.query("SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 0) FROM categories))");
    await pool.query("SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 0) FROM users))");
    await pool.query("SELECT setval('posts_id_seq', (SELECT COALESCE(MAX(id), 0) FROM posts))");
  }

  beforeAll(async () => {
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch {
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        DrizzleModule.forRoot(drizzle(pool)),
        UsersModule,
        PostsModule,
        CategoriesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  beforeEach(async () => {
    if (!dbOk) return;
    await cleanDb();
  });

  // ─── BASIC CRUD ─────────────────────────────────────────

  describe('Users CRUD', () => {
    it('GET /api/users — list all', async () => {
      const res = await request(server).get('/api/users').expect(200);
      expect(res.body).toHaveLength(4);
      expect(res.body[0].email).toBe('john@test.com');
    });

    it('GET /api/users/:id — find one', async () => {
      const res = await request(server).get('/api/users/1').expect(200);
      expect(res.body.id).toBe(1);
      expect(res.body.name).toBe('John Doe');
    });

    it('POST /api/users — create', async () => {
      const res = await request(server)
        .post('/api/users')
        .send({ email: 'new@test.com', name: 'New User' })
        .expect(201);
      expect(res.body.email).toBe('new@test.com');
    });

    it('PATCH /api/users/:id — update', async () => {
      const res = await request(server)
        .patch('/api/users/1')
        .send({ name: 'Updated Name' })
        .expect(200);
      expect(res.body.name).toBe('Updated Name');
    });

    it('DELETE /api/users/:id — delete and return deleted record', async () => {
      const res = await request(server).delete('/api/users/4').expect(200);
      expect(res.body.id).toBe(4);
    });

    it('DELETE /api/users/:id — 404 for non-existent', async () => {
      const res = await request(server).delete('/api/users/999').expect(404);
      expect(res.body.message).toContain('not found');
    });
  });

  // ─── FILTERS ────────────────────────────────────────────

  describe('Filters', () => {
    it('default contains (case-insensitive)', async () => {
      const res = await request(server).get('/api/users?name=john').expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('John Doe');
    });

    it('__eq operator', async () => {
      const { body } = await request(server)
        .get('/api/users?email__eq=john@test.com')
        .expect(200);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('John Doe');
    });

    it('__ne operator', async () => {
      const { body } = await request(server)
        .get('/api/users?email__ne=john@test.com')
        .expect(200);
      expect(body.length).toBeGreaterThanOrEqual(3);
    });

    it('__starts & __ends', async () => {
      const s = await request(server)
        .get('/api/users?name__starts=John')
        .expect(200);
      expect(s.body).toHaveLength(1);

      const e = await request(server)
        .get('/api/users?name__ends=Doe')
        .expect(200);
      expect(e.body).toHaveLength(1);
    });

    it('__gt / __gte / __lt / __lte on id', async () => {
      const gt = await request(server).get('/api/users?id__gt=2').expect(200);
      expect(gt.body.length).toBeGreaterThanOrEqual(2);

      const gte = await request(server).get('/api/users?id__gte=2').expect(200);
      expect(gte.body.length).toBeGreaterThanOrEqual(3);

      const lt = await request(server).get('/api/users?id__lt=3').expect(200);
      expect(lt.body).toHaveLength(2);

      const lte = await request(server).get('/api/users?id__lte=3').expect(200);
      expect(lte.body).toHaveLength(3);
    });

    it('__in & __notin', async () => {
      const ins = await request(server)
        .get('/api/users?id__in=1,3')
        .expect(200);
      expect(ins.body).toHaveLength(2);

      const nin = await request(server)
        .get('/api/users?id__notin=1,3')
        .expect(200);
      expect(nin.body.length).toBeGreaterThanOrEqual(2);
    });

    it('__null & __notnull', async () => {
      const notNull = await request(server)
        .get('/api/users?categoryId__notnull=1')
        .expect(200);
      expect(notNull.body).toHaveLength(3);

      const isNull = await request(server)
        .get('/api/users?categoryId__null=1')
        .expect(200);
      expect(isNull.body).toHaveLength(1);
      expect(isNull.body[0].name).toBe('Alice Admin');
    });

    it('multiple filters — AND', async () => {
      const { body } = await request(server)
        .get('/api/users?name__contains=o&id__gt=1')
        .expect(200);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('Bob Brown');
    });

    it('__or suffix — OR', async () => {
      const { body } = await request(server)
        .get('/api/users?name__eq=John+Doe&name__or__eq=Bob+Brown')
        .expect(200);
      expect(body).toHaveLength(2);
    });
  });

  // ─── RELATIONS / INCLUDES ───────────────────────────────

  describe('Relations & Includes', () => {
    it('GET /api/posts?include=author — single level nesting', async () => {
      const { body } = await request(server)
        .get('/api/posts?include=author')
        .expect(200);
      expect(body[0].author).toBeDefined();
      expect(body[0].author.name).toBe('John Doe');
      expect(body[0].author.email).toBeDefined();
      expect(body[0].id).toBeDefined();
      expect(body[0].title).toBeDefined();
    });

    it('GET /api/posts?include=author.category — two levels', async () => {
      const { body } = await request(server)
        .get('/api/posts?include=author.category')
        .expect(200);
      expect(body[0].author).toBeDefined();
      expect(body[0].author.category).toBeDefined();
      expect(body[0].author.category.name).toBe('Technology');
    });

    it('GET /api/posts?include=author,author.category — dedup join', async () => {
      const { body } = await request(server)
        .get('/api/posts?include=author,author.category')
        .expect(200);
      expect(body[0].author).toBeDefined();
      expect(body[0].author.category).toBeDefined();
    });

    it('GET /api/posts?author.name=John — filter by relation field', async () => {
      const { body } = await request(server)
        .get('/api/posts?author.name__contains=John')
        .expect(200);
      expect(body).toHaveLength(2);
    });

    it('GET /api/posts?author.category.name__eq=Technology — deep relation filter', async () => {
      const { body } = await request(server)
        .get('/api/posts?author.category.name__eq=Technology')
        .expect(200);
      expect(body.length).toBeGreaterThanOrEqual(2);
    });

    it('relation filter with OR', async () => {
      const { body } = await request(server)
        .get('/api/posts?title__contains=Intro&author.name__or__contains=Jane')
        .expect(200);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── ERROR HANDLING ────────────────────────────────────

  describe('Error handling', () => {
    it('unique violation → 409', async () => {
      const { body } = await request(server)
        .post('/api/users')
        .send({ email: 'john@test.com', name: 'Dup' })
        .expect(409);
      expect(body.message).toContain('email');
      expect(body.message).toContain('unique');
    });

    it('FK violation → 400', async () => {
      const { body } = await request(server)
        .post('/api/posts')
        .send({ title: 'Bad', authorId: 999 })
        .expect(400);
      expect(body.message).toContain('does not exist');
    });

    it('NOT NULL violation → 400', async () => {
      const { body } = await request(server)
        .post('/api/users')
        .send({ email: 'x@x.com' })
        .expect(400);
      expect(body.message).toContain('required');
    });

    it('devErrors in non-production', async () => {
      const { body } = await request(server)
        .post('/api/posts')
        .send({ title: 'Bad', authorId: 999 })
        .expect(400);
      expect(body.devErrors).toBeDefined();
      expect(body.devErrors.code).toBe('23503');
    });
  });

  // ─── CATEGORIES CRUD (second resource) ─────────────────

  describe('Categories CRUD', () => {
    it('GET /api/categories — list all', async () => {
      const { body } = await request(server).get('/api/categories').expect(200);
      expect(body).toHaveLength(2);
    });

    it('POST /api/categories — create', async () => {
      const { body } = await request(server)
        .post('/api/categories')
        .send({ name: 'Marketing' })
        .expect(201);
      expect(body.name).toBe('Marketing');
    });

    it('DELETE /api/categories — non-existent 404', async () => {
      await request(server).delete('/api/categories/999').expect(404);
    });
  });

  // ─── POSTS CRUD ────────────────────────────────────────

  describe('Posts CRUD', () => {
    it('GET /api/posts — list all', async () => {
      const { body } = await request(server).get('/api/posts').expect(200);
      expect(body).toHaveLength(3);
    });

    it('POST /api/posts — create', async () => {
      const { body } = await request(server)
        .post('/api/posts')
        .send({ title: 'New Post', content: 'Hello', authorId: 1 })
        .expect(201);
      expect(body.title).toBe('New Post');
    });
  });
});
