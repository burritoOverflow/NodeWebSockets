const jwt = require('jsonwebtoken');
const { User } = require('../models/user');

// jwt env var
require('dotenv').config();

// auth middleware, used to verify the JWT in a typical pattern.
const auth = async (req, res, next) => {
  // attempt to validate user
  try {
    const tokenContents = req.header('Authorization');
    // value is 'Bearer <token>'
    const token = tokenContents.split(' ')[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    // the user's id is stored in the token
    // determine the the jwt is stored in the jwt array
    const user = await User.findOne({
      // eslint-disable-next-line no-underscore-dangle
      _id: decodedToken._id,
      'tokens.token': token,
    });

    if (!user) {
      console.error('No user found with provided token ', token);
      throw new Error('No user found');
    }

    // otherwise user is authenticated correctly
    // so add the user and the token to the request (avoid repeated look-up)
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error(error);
    res.status(401).send({ error: 'Unauthenticated request' });
    next();
  }
};

module.exports = auth;
