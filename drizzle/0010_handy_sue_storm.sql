CREATE TABLE `agent_wiki_namespaces` (
	`agent_id` text NOT NULL,
	`namespace_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`agent_id`, `namespace_id`),
	FOREIGN KEY (`namespace_id`) REFERENCES `wiki_namespaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wiki_namespaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_namespaces_name_unique` ON `wiki_namespaces` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_message_feedback` ON `message_feedbacks` (`user_id`,`message_id`);