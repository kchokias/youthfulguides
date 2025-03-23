-- Start at -1 so first value becomes 0 (i.e., no offset from 2025-01-01)
SET @i := -1;
SET @start_date := '2025-01-01';

INSERT INTO guide_availability (guide_id, date, status)
SELECT
  23,
  DATE_ADD(@start_date, INTERVAL t.n DAY),
  'unavailable'
FROM (
  SELECT @i := @i + 1 AS n FROM
    information_schema.COLUMNS
  LIMIT 365
) AS t;

this is to make unavailable a user for all the year in sql