CREATE TABLE `busy_overrides` (
	`calendar_id` text NOT NULL,
	`event_id` text NOT NULL,
	`busy` integer NOT NULL,
	PRIMARY KEY(`calendar_id`, `event_id`)
);
--> statement-breakpoint
ALTER TABLE `busy_calendars` ADD `name` text;