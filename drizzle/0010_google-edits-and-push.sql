CREATE TABLE `calendar_watches` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`token` text NOT NULL,
	`address` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `not_then_times` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
