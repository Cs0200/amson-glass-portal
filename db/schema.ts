import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const consultationRequests=sqliteTable('consultation_requests',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),
 name:text('name').notNull(),email:text('email').notNull(),phone:text('phone').notNull(),
 city:text('city').notNull(),address:text('address').notNull(),postalCode:text('postal_code').notNull(),customerType:text('customer_type').notNull(),
 message:text('message').notNull(),estimate:text('estimate_json'),estimatedTotal:integer('estimated_total'),
 customerUserId:text('customer_user_id'),requestKey:text('request_key').unique(),consentedAt:text('consented_at'),
 notes:text('notes').notNull().default(''),followUp:text('follow_up').notNull().default(''),revision:integer('revision').notNull().default(0),
 status:text('status').notNull().default('New'),createdAt:text('created_at').notNull()
},t=>[index('request_email_idx').on(t.email),index('request_created_idx').on(t.createdAt),index('request_status_idx').on(t.status)]);

export const requestActivity=sqliteTable('request_activity',{
 id:text('id').primaryKey(),requestId:text('request_id').notNull(),actor:text('actor').notNull(),
 summary:text('summary').notNull(),createdAt:text('created_at').notNull()
},t=>[index('activity_request_idx').on(t.requestId)]);
export const requestQuotes=sqliteTable('request_quotes',{
 id:integer('id').primaryKey({autoIncrement:true}),requestId:text('request_id').notNull(),token:text('token').notNull().unique(),
 scope:text('scope').notNull(),subtotal:integer('subtotal').notNull(),tax:integer('tax').notNull(),deposit:integer('deposit').notNull(),
 validUntil:text('valid_until').notNull(),terms:text('terms').notNull(),createdAt:text('created_at').notNull(),
 acceptedAt:text('accepted_at'),acceptedBy:text('accepted_by')
},t=>[index('quote_request_idx').on(t.requestId)]);
export const submissionLimits=sqliteTable('submission_limits',{
 key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()
},t=>[index('limit_expiry_idx').on(t.expiresAt)]);
export const requestPayments=sqliteTable('request_payments',{
 id:text('id').primaryKey(),requestId:text('request_id').notNull(),quoteId:integer('quote_id').notNull(),
 amount:integer('amount').notNull(),reference:text('reference').notNull().unique(),paidOn:text('paid_on').notNull(),
 recordedBy:text('recorded_by').notNull(),createdAt:text('created_at').notNull(),voidedAt:text('voided_at'),voidReason:text('void_reason')
});
