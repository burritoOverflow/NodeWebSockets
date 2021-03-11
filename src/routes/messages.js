const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');

const fs = require('fs');

const { Room } = require('../models/room');
const { Message } = require('../models/messages');
const { User } = require('../models/user');
const verifyUserJWT = require('../utils/verifyJWT');
const { appendToLog } = require('../utils/logging');

const router = express.Router();
require('dotenv').config();

// AWS config
AWS.config.update({ region: 'us-east-1' });
const s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// return most recent messages from the room provided
// either via a qs param, or default 10
router.get('/messages/:room', async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  const skip = req.query.skip ? parseInt(req.query.skip, 10) : 0;

  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      // invalid token
      res.status(401).send({ error: 'Unauthorized' });
    }
    // get the id for the room provided
    const roomName = req.params.room;
    const room = await Room.findOne({ name: roomName });

    // eslint-disable-next-line no-underscore-dangle
    const messagesFromRoom = await Message.find({ room: room._id })
      .sort({
        date: -1,
      }) // oldest first
      .limit(limit)
      .skip(skip);

    // simplify the contents; don't need the message's id
    const msgArr = messagesFromRoom.reverse().map((msg) => ({
      contents: msg.contents,
      date: msg.date,
      sender: msg.sender,
    }));

    // collect just the userIDs from the messages
    const userIDArr = [];
    msgArr.forEach((msg) => {
      // eslint-disable-next-line no-underscore-dangle
      userIDArr.push(msg.sender);
    });

    // get an array of users with the ids provided
    const userList = await User.find().in('_id', userIDArr);

    // given the result of the query, convert the IDs in the message array into usernames
    const userIDSenderObj = userList.map((u) => ({
      // eslint-disable-next-line no-underscore-dangle
      _id: u._id,
      name: u.name,
    }));

    const retList = [];

    // now convert the sender (User's ID) to the user's name
    msgArr.forEach((msgObj) => {
      userIDSenderObj.forEach((senderObj) => {
        // eslint-disable-next-line no-underscore-dangle
        if (msgObj.sender.equals(senderObj._id)) {
          // format the message in the manner that the client code expects
          // this format is the same as the format for messages emitted during
          // a message event from sio
          const msg = {
            contents: msgObj.contents,
            date: msgObj.date,
            sender: senderObj.name,
          };
          retList.push(msg);
        }
      });
    });

    return res.status(200).send(retList);
  }
  // no token provided
  res.status(401).send({ error: 'Unauthorized' });
  // need the user names from the users that sent the messages
});

// multer config, for file uploads
const upload = multer({
  limits: {
    // 1MB limit for these photos (1MB == 1,000,000 B)
    fileSize: 5000 ** 2,
  },
  fileFilter(req, file, cb) {
    // called by multer, (req, file, cb)
    cb(undefined, true);
  },
});

// route for filesharing; 'upload' is the key
router.post(
  '/messages/file',
  upload.single('upload'),
  async (req, res) => {
    // verify the user
    if (req.cookies.token) {
      const userObj = await verifyUserJWT(req.cookies.token);

      if (!userObj.name) {
        // invalid token
        res.status(401).send({ error: 'Unauthorized' });
      }

      // we'll append the timestamp string to avoid overwriting filenames
      const uploadDateStr = String(+new Date());

      // get the data (file buffer) from multer
      const fileBuffer = req.file.buffer;

      const fileExtension = req.file.originalname.slice(
        req.file.originalname.indexOf('.'),
      );

      let filename = req.file.originalname.slice(
        0,
        req.file.originalname.indexOf('.'),
      );

      // for ease of use here, we'll just replace all spaces with underscores
      filename = filename.split(' ').join('_');

      const uploadFilename = `${filename}_${uploadDateStr}.${fileExtension}`;

      const s3Response = await s3
        .upload({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: uploadFilename,
          Body: fileBuffer,
        })
        .promise();

      // log the response
      appendToLog(JSON.stringify(s3Response));

      // build the public URL
      const filePublicURL = `https://ws-app-storage.s3.amazonaws.com/${uploadFilename}`;

      // on success, return the public url in the response
      res.status(201).send({
        originalName: req.file.originalname,
        url: filePublicURL,
      });
    } else {
      // no token provided
      res.status(401).send({ error: 'Unauthorized' });
    }
  },
  (error, req, res, next) => {
    // if error, we'll handle this more appropriately
    res.status(400).send({ error: error.message });
  },
);

module.exports = router;
