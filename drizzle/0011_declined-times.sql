ALTER TABLE `not_then_times` RENAME TO `declined_times`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_declined_times` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_declined_times`("id", "task_id", "start", "end") SELECT "id", "task_id", "start", "end" FROM `declined_times`;--> statement-breakpoint
DROP TABLE `declined_times`;--> statement-breakpoint
ALTER TABLE `__new_declined_times` RENAME TO `declined_times`;--> statement-breakpoint
PRAGMA foreign_keys=ON;