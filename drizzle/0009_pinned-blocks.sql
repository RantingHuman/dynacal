ALTER TABLE `block_events` ADD `block_id` text;--> statement-breakpoint
ALTER TABLE `blocks` ADD `pinned` integer DEFAULT false NOT NULL;