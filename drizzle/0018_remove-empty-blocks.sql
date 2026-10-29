-- A Recalculation as a Block in progress ended could store a 0-minute Block after it (a float rounding error).
DELETE FROM `blocks` WHERE `end` <= `start`;
