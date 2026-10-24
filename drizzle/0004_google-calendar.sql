CREATE TABLE `busy_calendars` (
	`calendar_id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`calendar_id` text NOT NULL,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`free` integer NOT NULL,
	`all_day` integer NOT NULL,
	`start` integer,
	`end` integer,
	`start_date` text,
	`end_date` text,
	PRIMARY KEY(`calendar_id`, `event_id`)
);
--> statement-breakpoint
CREATE TABLE `google_connection` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`refresh_token` text NOT NULL,
	`access_token` text,
	`access_token_expires_at` integer,
	`connected_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `count_free_events` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `count_all_day_events` integer DEFAULT false NOT NULL;