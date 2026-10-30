-- Busy Events get a Buffer before and after, one setting each for all of them, starting at 0.
ALTER TABLE `settings` ADD `event_buffer_before_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `event_buffer_after_minutes` integer DEFAULT 0 NOT NULL;
