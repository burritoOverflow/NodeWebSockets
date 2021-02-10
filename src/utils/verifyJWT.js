/* eslint-disable no-underscore-dangle */
const jwt = require('jsonwebtoken');
const { User } = require('../models/user');

/**
 *
 * @param {*} token - the JWT to verify
 * @returns - true if a valid user corresponds to the JWT
 */
async function verifyUserJWT(token) {
  const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

  // the user's id is stored in the token
  // determine the the jwt is stored in the jwt array
  const user = await User.findOne({
    _id: decodedToken._id,
    'tokens.token': token,
  });

  // no user found with the provided id
  if (!user) {
    return {};
  }
  return {
    name: user.name,
  };
}

module.exports = verifyUserJWT;
