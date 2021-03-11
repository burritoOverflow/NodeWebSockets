/* eslint-disable func-names */
/* eslint-disable no-underscore-dangle */
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// env vars
require('dotenv').config();

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      minLength: 3,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error('Email is invalid');
        }
      },
    },
    password: {
      type: String,
      required: true,
      trim: true,
      // add password requirements
      validate(value) {
        if (
          !validator.isStrongPassword(value, {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
            returnScore: false,
          })
        ) {
          throw new Error('Weak password');
        }
      },
    },
    age: {
      type: Number,
      min: 18,
    },
    tokens: [
      // store JWT with the user
      {
        token: {
          type: String,
          required: true,
        },
      },
    ],
    socketIOIDs: [
      {
        sid: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// adds an instance method
// generate a jwt
// eslint-disable-next-line func-names
UserSchema.methods.generateAuthToken = async function () {
  const user = this;
  const jwtSecret = process.env.JWT_SECRET;
  const token = jwt.sign({ _id: user._id.toString() }, jwtSecret);
  // add the auth token to the user and save to the db
  user.tokens = user.tokens.concat({ token });
  await user.save();
  return token;
};

// override toJSON to return the data that should be shown publicly
// eslint-disable-next-line func-names
UserSchema.methods.toJSON = function () {
  const user = this;
  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.tokens;
  delete userObj.socketIOIDs;
  delete userObj.createdAt;
  delete userObj.updatedAt;

  return userObj;
};

// add an additional static method for finding a user by creds
UserSchema.statics.findByCredentials = async (email, password) => {
  // eslint-disable-next-line no-use-before-define
  const user = await User.findOne({ email });

  const genericErrorStr = 'Unable to login';

  // no user with that email
  if (!user) {
    throw new Error(genericErrorStr);
  }

  // determine if password is a match
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error(genericErrorStr);
  }

  return user;
};

// prior to saving, hash the provided password
UserSchema.pre('save', async function (next) {
  // the user about to be saved
  const user = this;
  // only hash the password if modified by the user
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
  next();
});
const User = mongoose.model('User', UserSchema);

module.exports = {
  User,
};
