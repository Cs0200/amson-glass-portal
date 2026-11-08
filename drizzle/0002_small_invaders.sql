CREATE TABLE `request_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`quote_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`reference` text NOT NULL,
	`paid_on` text NOT NULL,
	`recorded_by` text NOT NULL,
	`created_at` text NOT NULL,
	`voided_at` text,
	`void_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `request_payments_reference_unique` ON `request_payments` (`reference`);