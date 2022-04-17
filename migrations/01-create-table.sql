CREATE TABLE IF NOT EXISTS questions (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	question TEXT DEFAULT 'Frage' NOT NULL,
	answerOne TEXT DEFAULT 'A' NOT NULL,
	answerTwo TEXT DEFAULT 'B' NOT NULL,
	answerThree TEXT DEFAULT 'C' NOT NULL,
	answerFour TEXT DEFAULT 'D' NOT NULL,
	answerIndex INTEGER NOT NULL
);