CREATE TABLE `custom_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`system_prompt` text DEFAULT '' NOT NULL,
	`model_id` text,
	`icon` text,
	`is_builtin` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_feedbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_message_feedbacks_chat` ON `message_feedbacks` (`chat_id`);--> statement-breakpoint
CREATE INDEX `idx_message_feedbacks_message` ON `message_feedbacks` (`message_id`);