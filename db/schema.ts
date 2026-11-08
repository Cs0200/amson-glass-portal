import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const consultationRequests=sqliteTable('consultation_requests',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),
 name:text('name').notNull(),email:text('email').notNull(),phone:text('phone').notNull(),
 city:text('city').notNull(),address:text('address').notNull(),postalCode:text('postal_code').notNull(),customerType:text('customer_type').notNull(),
 message:text('message').notNull(),estimate:text('estimate_json'),estimatedTotal:integer('estimated_total'),
 status:text('status').notNull().default('New'),createdAt:text('created_at').notNull()
});
