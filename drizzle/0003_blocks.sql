CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `schedule_flag` text;