CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text NOT NULL,
	`estimated_minutes` integer NOT NULL,
	`deadline_date` text,
	`deadline_time` text,
	`earliest_start_date` text,
	`earliest_start_time` text,
	`priority` text NOT NULL,
	`dont_split` integer NOT NULL,
	`created_at` integer NOT NULL
);
