import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { posts } from './posts.schema';
import { categories } from './categories.schema';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  posts: many(posts),
  category: one(categories, {
    fields: [users.categoryId],
    references: [categories.id],
  }),
}));
