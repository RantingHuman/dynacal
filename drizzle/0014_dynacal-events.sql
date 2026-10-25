CREATE TABLE `dynacal_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text NOT NULL,
	`all_day` integer NOT NULL,
	`start` integer,
	`end` integer,
	`start_date` text,
	`end_date` text,
	`google_event_id` text,
	`created_at` integer NOT NULL
);
