-- Tasks get a Buffer after: by default dynacal keeps 15 minutes free after each Task when placing the next thing.
ALTER TABLE `settings` ADD `task_buffer_after_minutes` integer DEFAULT 15 NOT NULL;
