/* eslint-disable no-underscore-dangle */
const express = require('express');

const router = express.Router();

const { User } = require('../models/user');
const { appendToLog } = require('../utils/logging');
const verifyUserJWT = require('../utils/verifyJWT');

// add a new user
router.post('/users', async (req, res) => {
  const userObj = req.body;
  // enforce all usernames must be lowercase
  userObj.name = userObj.name.toLowerCase();
  const user = new User(userObj);

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
    if (error.errors && error.errors.password) {
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

// allow a user to logout of the current session
router.post('/users/logout', async (req, res) => {
  if (req.cookies.token) {
    // verify that the token exists
    const validUser = await verifyUserJWT(req.cookies.token);

    if (!validUser.name) {
      // invalid token provided
      return res.status(401).send({ error: 'Unauthorized - Invalid Token' });
    }

    // get the user
    const user = await User.findOne({ 'tokens.token': req.cookies.token });

    // valid user, so we'll remove the token provided from the user's tokens
    const { tokens } = user;
    const initTokensLength = tokens.length;

    // save the updated token array and update the user object
    user.tokens = tokens.filter((token) => token.token !== req.cookies.token);
    const savedUser = await user.save();

    // check that the single token has been removed
    if (initTokensLength - 1 === savedUser.tokens.length) {
      appendToLog(
        `POST /api/users/logout - removed token ${req.cookies.token}  from user ${savedUser._id}`,
      );

      // for immediate expiry of the cookie
      const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));

      // set expire for yesterday
      if (process.env.NODE_ENV === 'production') {
        res.cookie('token', req.cookies.token, {
          httpOnly: true,
          secure: true,
          sameSite: true,
          expires: yesterday,
        });

        res.cookie('username', user.name, {
          httpOnly: true,
          secure: true,
          sameSite: true,
          expires: yesterday,
        });
      } else {
        // cannot set secure w/o https; for development
        res.cookie('token', req.cookies.token, {
          httpOnly: true,
          sameSite: true,
          expires: yesterday,
        });
      }

      res.cookie('username', user.name, {
        httpOnly: true,
        sameSite: true,
        expires: yesterday,
      });

      // expire the remaining cookie
      res.cookie('displayname', user.name, {
        expires: yesterday,
      });

      return res
        .status(200)
        .send({ status: `Token ${req.cookies.token} removed` });
    }
    return res.status(500).send({ error: 'Update failed' });
  }
  // no token, no user to logout
  return res.status(400).send({ error: 'No token provided' });
});

module.exports = router;
