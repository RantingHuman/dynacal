CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders_sent` (
	`task_id` text NOT NULL,
	`block_start` integer NOT NULL,
	`sent_at` integer NOT NULL,
	PRIMARY KEY(`task_id`, `block_start`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
