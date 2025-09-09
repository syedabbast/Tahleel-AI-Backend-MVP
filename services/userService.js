// Replace with Supabase/Postgres/your DB integration as needed

// Example in-memory user store (replace with DB queries)
const users = [];
let userIdCounter = 1;

async function getUserByEmail(email) {
  return users.find(u => u.email === email);
}

async function createUser({ name, email, passwordHash, team }) {
  const user = { id: userIdCounter++, name, email, passwordHash, team };
  users.push(user);
  return user;
}

async function getUserById(id) {
  return users.find(u => u.id === id);
}

module.exports = { getUserByEmail, createUser, getUserById };
