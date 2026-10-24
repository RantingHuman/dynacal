CREATE TABLE `block_events` (
	`calendar_id` text NOT NULL,
	`event_id` text NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`reminder_minutes` integer NOT NULL,
	PRIMARY KEY(`calendar_id`, `event_id`)
);
--> statement-breakpoint
ALTER TABLE `google_connection` ADD `dynacal_calendar_id` text;