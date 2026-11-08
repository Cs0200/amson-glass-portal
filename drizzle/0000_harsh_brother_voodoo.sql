CREATE TABLE `consultation_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`city` text NOT NULL,
	`address` text NOT NULL,
	`postal_code` text NOT NULL,
	`customer_type` text NOT NULL,
	`message` text NOT NULL,
	`estimate_json` text,
	`estimated_total` integer,
	`status` text DEFAULT 'New' NOT NULL,
	`created_at` text NOT NULL
);
