CREATE VIEW Work_In_Part AS
SELECT *
FROM Work AS o
JOIN Part AS c ON o.PartNumber = c.ID;