CREATE INDEX `request_email_idx` ON `consultation_requests` (`email`);--> statement-breakpoint
CREATE INDEX `request_created_idx` ON `consultation_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `request_status_idx` ON `consultation_requests` (`status`);--> statement-breakpoint
CREATE INDEX `activity_request_idx` ON `request_activity` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `request_quotes_token_unique` ON `request_quotes` (`token`);--> statement-breakpoint
CREATE INDEX `quote_request_idx` ON `request_quotes` (`request_id`);--> statement-breakpoint
CREATE INDEX `limit_expiry_idx` ON `submission_limits` (`expires_at`);