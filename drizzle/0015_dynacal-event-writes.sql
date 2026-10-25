CREATE TABLE `dynacal_event_writes` (
	`calendar_id` text NOT NULL,
	`event_id` text NOT NULL,
	`dynacal_event_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`all_day` integer NOT NULL,
	`start` integer,
	`end` integer,
	`start_date` text,
	`end_date` text,
	`reminder_minutes` integer NOT NULL,
	PRIMARY KEY(`calendar_id`, `event_id`)
);
--> statement-breakpoint
ALTER TABLE `dynacal_events` DROP COLUMN `google_event_id`;