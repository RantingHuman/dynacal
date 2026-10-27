-- A past Block reviewed "not done" is now removed rather than kept, so it doesn't sit beside the Block that
-- replaced it. It counted as no time worked, so removing it leaves every Remaining Duration as it was.
DELETE FROM `blocks` WHERE `review` = 'not-done';
