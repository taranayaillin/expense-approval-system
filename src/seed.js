const db = require('./db');

const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (count === 0) {
  const insert = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)');
  insert.run('Alex Employee', 'alex@example.com', 'Employee');
  insert.run('Morgan Manager', 'morgan@example.com', 'Manager');
  insert.run('Taylor Finance', 'taylor@example.com', 'Finance');
  console.log('Seeded three users.');
} else {
  console.log('Users already exist; seed skipped.');
}
