CREATE TABLE IF NOT EXISTS catalogue (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);

ALTER TABLE questions ADD catalogue INTEGER NOT NULL;

CREATE TEMPORARY TABLE temp AS
SELECT *
FROM questions;

DROP TABLE questions;

CREATE TABLE questions (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	question TEXT NOT NULL DEFAULT 'Frage',
	answerOne TEXT NOT NULL DEFAULT 'A',
	answerTwo TEXT NOT NULL DEFAULT 'B',
	answerThree TEXT NOT NULL DEFAULT 'C',
	answerFour TEXT NOT NULL DEFAULT 'D',
	answerIndex INTEGER NOT NULL DEFAULT 0,
	catalogue INTEGER NOT NULL,
	CONSTRAINT questions_FK FOREIGN KEY (catalogue) REFERENCES catalogue(id) ON DELETE CASCADE
);

INSERT INTO questions
SELECT *
FROM temp;

DROP TABLE temp;
