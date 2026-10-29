-- dynacal no longer asks how long the owner worked (ADR 0006): the review's minutes worked go. The last migration
-- turned them into open Tasks' Remaining Durations; completed Tasks keep their Blocks' answers, without the minutes.
ALTER TABLE `blocks` DROP COLUMN `worked_minutes`;
