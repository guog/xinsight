CREATE TABLE `wiki_feedbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `datasources` ADD `last_tested_at` integer;--> statement-breakpoint
ALTER TABLE `datasources` ADD `last_test_result` text;--> statement-breakpoint
ALTER TABLE `datasources` ADD `last_test_message` text;--> statement-breakpoint
ALTER TABLE `datasources` ADD `last_called_at` integer;--> statement-breakpoint
ALTER TABLE `datasources` ADD `call_count` integer DEFAULT 0 NOT NULL;