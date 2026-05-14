CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`ip` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_ip_action` ON `rate_limits` (`ip`,`action`);