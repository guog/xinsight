CREATE TABLE `wiki_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wiki_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`original_name` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`ingest_task_id` text,
	`ingest_progress` integer DEFAULT 0 NOT NULL,
	`ingest_error` text,
	`invalid_reason` text,
	`pages_created` text,
	`source` text DEFAULT 'upload' NOT NULL,
	`uploaded_at` integer NOT NULL,
	`ingested_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_uploads_stored_path_unique` ON `wiki_uploads` (`stored_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_uploads_sha256_unique` ON `wiki_uploads` (`sha256`);