DROP TABLE token;

CREATE TABLE IF NOT EXISTS token (user_id NUMBER PRIMARY KEY NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, token TEXT NOT NULL);