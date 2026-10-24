CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`working_hours` text NOT NULL,
	`time_zone` text,
	`minimum_block_minutes` integer NOT NULL,
	`reminder_lead_minutes` integer NOT NULL
);
