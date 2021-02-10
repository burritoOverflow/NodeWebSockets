/* eslint-disable no-underscore-dangle */
const express = require('express');

const router = express.Router();

const { User } = require('../models/user');

// add a new user
router.post('/users', async (req, res) => {
  const user = new User(req.body);
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
    console.error(error._message);
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
    const token = await user.generateAuthToken();
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
