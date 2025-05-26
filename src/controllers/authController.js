const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Assuming models/index.js exports models directly

// Register a new user
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    const newUser = await User.create({ username, password });

    // Optionally, log the user in directly and send a token
    const token = jwt.sign({ id: newUser.id, username: newUser.username }, process.env.JWT_SECRET, {
      expiresIn: '1h', // Token expiration time
    });

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: { id: newUser.id, username: newUser.username },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user.', error: error.message });
  }
};

// Login an existing user
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const isMatch = await user.isValidPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '1h', // Token expiration time
    });

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in.', error: error.message });
  }
};