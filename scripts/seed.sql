CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY,
 name VARCHAR(50),
 email VARCHAR(100) UNIQUE
);

INSERT INTO users (name, email) VALUES
 ('John Wich', 'pencileye@example.com'),
 ('Ryan Gosling', 'ryan@example.com'),
 ('Oompa Loompa', 'oompaloompa@example.com')
ON CONFLICT (email) DO NOTHING;