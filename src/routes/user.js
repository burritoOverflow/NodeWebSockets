/* eslint-disable no-underscore-dangle */
const express = require('express');

const router = express.Router();

const { User } = require('../models/user');
const { appendToLog } = require('../utils/logging');

// add a new user
router.post('/users', async (req, res) => {
  const user = new User(req.body);

  if (!user) {
    // creation failed
    res.status(400).send({ status: 'User creation failed' });
  }

  try {
    const _user = await user.save();
    // after creation, generate an auth token
    const token = await _user.generateAuthToken();
    if (process.env.NODE_ENV === 'production') {
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: true,
      });
    } else {
      // during dev w/ http the cookie is discarded by most browsers, as
      // secure cookies cannot be set over http
      res.cookie('token', token, { httpOnly: true, sameSite: true });
    }
    res.status(201).send({ user: _user, token });
  } catch (error) {
    // return the appropriate error message to the client
    if (error.errors.password) {
      return res.status(400).send({ status: error.errors.password.message });
    }

    // uniqueness is enforced for users
    if (error.keyValue.email) {
      return res.status(400).send({ status: 'Email already in use.' });
    }

    if (error.keyValue.name) {
      return res.status(400).send({ status: 'Username already in use' });
    }

    res.status(400).send({ status: error._message });
  }
});

// authenticate a user to initialize a session
router.post('/users/login', async (req, res) => {
  try {
    const user = await User.findByCredentials(
      req.body.email,
      req.body.password,
    );

    // log the failed login attempt (no, don't log the plaintext password)
    if (!user) {
      appendToLog(
        `'/users/login': POST User not found with e-mail: ${req.body.email} and provided password}`,
      );
    }

    const token = await user.generateAuthToken();

    // log the successful login
    appendToLog(
      `'/users/login': POST User ${user.name} ${user.email} granted token ${token}`,
    );

    // set the cookie as appropriate
    if (process.env.NODE_ENV === 'production') {
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: true,
      });
    } else {
      res.cookie('token', token, { httpOnly: true, sameSite: true });
    }
    res.status(200).send({
      user,
      token,
    });
  } catch (error) {
    // return an error when login fails
    res.status(400).send({ status: error._message });
  }
});

module.exports = router;
