CREATE TABLE `request_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`actor` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`token` text NOT NULL,
	`scope` text NOT NULL,
	`subtotal` integer NOT NULL,
	`tax` integer NOT NULL,
	`deposit` integer NOT NULL,
	`valid_until` text NOT NULL,
	`terms` text NOT NULL,
	`created_at` text NOT NULL,
	`accepted_at` text,
	`accepted_by` text
);
--> statement-breakpoint
CREATE TABLE `submission_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `consultation_requests` ADD `customer_user_id` text;--> statement-breakpoint
ALTER TABLE `consultation_requests` ADD `request_key` text;--> statement-breakpoint
ALTER TABLE `consultation_requests` ADD `consented_at` text;--> statement-breakpoint
ALTER TABLE `consultation_requests` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `consultation_requests` ADD `follow_up` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `consultation_requests` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `consultation_requests_request_key_unique` ON `consultation_requests` (`request_key`);