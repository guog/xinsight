CREATE TABLE `agent_datasources` (
	`agent_id` text NOT NULL,
	`datasource_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`agent_id`, `datasource_id`),
	FOREIGN KEY (`datasource_id`) REFERENCES `datasources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `datasources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`auth` text NOT NULL,
	`config` text NOT NULL,
	`endpoints` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
