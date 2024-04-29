const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const connection = require('./database');

const app = express();
const port = 3000;

app.use(bodyParser.json());

const secretKey = 'secretkey'; 

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.post('/login', (req, res) => {
  const { firstname, password } = req.body;
  // Authenticate user with database logic If valid credentials, generate token
  const token = jwt.sign({ firstname }, secretKey);
  res.json({ token });
});

// CRUD operations for users table

// Create a new user
app.post('/users', authenticateToken, (req, res) => {
  const { firstname, lastname, email, password } = req.body;
  const newUser = { firstname, lastname, email, password };
  connection.query('INSERT INTO user SET ?', newUser, (error, results) => {
    if (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'An error occurred while creating user' });
      return;
    }
    res.json({ message: 'User created successfully', user_id: results.insertId });
  });
});

// Get all users
app.get('/users', authenticateToken, (req, res) => {
  connection.query('SELECT * FROM user', (error, results) => {
    if (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'An error occurred while fetching users' });
      return;
    }
    res.json(results);
  });
});

// Get user by ID
app.get('/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  connection.query('SELECT * FROM user WHERE user_id = ?', userId, (error, results) => {
    if (error) {
      console.error('Error fetching user by ID:', error);
      res.status(500).json({ error: 'An error occurred while fetching user by ID' });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(results[0]);
  });
});

// Delete user by ID
app.delete('/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  connection.query('DELETE FROM user WHERE user_id = ?', userId, (error, results) => {
    if (error) {
      console.error('Error deleting user by ID:', error);
      res.status(500).json({ error: 'An error occurred while deleting user by ID' });
      return;
    }
    if (results.affectedRows === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ message: 'User deleted successfully' });
  });
});

// CRUD operations for userprofile table

// Create a new user profile
app.post('/userprofiles', authenticateToken, (req, res) => {
  const { user_id, age, address, contact_number, pnn_number } = req.body;

  // Check if the user exists
  connection.query('SELECT * FROM user WHERE user_id = ?', user_id, (error, results) => {
    if (error) {
      console.error('Error checking user existence:', error);
      res.status(500).json({ error: 'An error occurred while checking user existence' });
      return;
    }
    if (results.length === 0) {
      // User does not exist, return an error
      res.status(404).json({ error: 'User does not exist. Create the user first.' });
      return;
    }

    // User exists, proceed with creating user profile
    const newUserProfile = { user_id, age, address, contact_number, pnn_number };
    connection.query('INSERT INTO user_profile SET ?', newUserProfile, (error, results) => {
      if (error) {
        console.error('Error creating user profile:', error);
        res.status(500).json({ error: 'An error occurred while creating user profile' });
        return;
      }
      res.json({ message: 'User profile created successfully', user_profile_id: results.insertId });
    });
  });
});


// Get all user profiles
app.get('/userprofiles', authenticateToken, (req, res) => {
  connection.query('SELECT * FROM user_profile', (error, results) => {
    if (error) {
      console.error('Error fetching user profiles:', error);
      res.status(500).json({ error: 'An error occurred while fetching user profiles' });
      return;
    }
    res.json(results);
  });
});

// Get user profile by ID
app.get('/userprofiles/:id', authenticateToken, (req, res) => {
  const userProfileId = req.params.id;
  connection.query('SELECT * FROM user_profile WHERE user_id = ?', userProfileId, (error, results) => {
    if (error) {
      console.error('Error fetching user profile by ID:', error);
      res.status(500).json({ error: 'An error occurred while fetching user profile by ID' });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }
    res.json(results[0]);
  });
});

/// Delete user profile by ID
app.delete('/userprofiles/:id', authenticateToken, (req, res) => {
  const userProfileId = req.params.id;
  connection.query('DELETE FROM user_profile WHERE id = ?', userProfileId, (error, results) => {
    if (error) {
      console.error('Error deleting user profile by ID:', error);
      res.status(500).json({ error: 'An error occurred while deleting user profile by ID' });
      return;
    }
    if (results.affectedRows === 0) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }
    res.json({ message: 'User profile deleted successfully' });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});

module.exports = app;
