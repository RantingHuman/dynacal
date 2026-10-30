ALTER TABLE `settings` ADD `task_buffer_before_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `buffer_before_minutes` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `buffer_after_minutes` integer;