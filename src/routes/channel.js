/* eslint-disable no-underscore-dangle */
const express = require('express');
const { Channel } = require('../models/channel');
const { Post } = require('../models/post');
const { User } = require('../models/user');
const verifyUserJWT = require('../utils/verifyJWT');

const router = express.Router();

// create new channel route
router.post('/channel', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      // invalid token provided
      res.status(401).send({ error: 'Unauthorized' });
    }

    // determine if the channel exists already before creating
    const { name } = req.body;
    const existingChannel = await Channel.findOne({ name });
    // if so, we're done here
    if (existingChannel) {
      res.status(400).send({
        error: `Cannot create channel ${req.body.name}. Already exists`,
      });
    }

    // channel's creator is also the admin
    const { _id } = await User.findOne({ name: userObj.name });
    const channelAdmin = _id;

    // create the new channel object
    const newChannelObj = {
      name: req.body.name,
      admin: channelAdmin,
    };

    try {
      const channel = new Channel(newChannelObj);
      await channel.save();
    } catch (error) {
      // eslint-disable-next-line no-underscore-dangle
      const _error = error?.errors?.name?.message;
      return res.status(400).send({ error: _error });
    }

    return res.status(201).send({
      result: `Channel ${req.body.name} created`,
    });
  }
  // no token
  return res.status(401).send({ error: 'Unauthorized' });
});

// add posted contents to the channel
// {
//     "postcontents" : "foo bar"
// }
router.post('/channel/:channel/addpost', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      // invalid token provided
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // parameter is the room name
    const channelName = req.params.channel;
    // ensure that the channel exists first
    const channel = await Channel.findOne({ name: channelName });

    if (!channel) {
      return res
        .status(404)
        .send({ error: `No channel ${channelName} exists` });
    }

    // since the channel exists, we'll need to determine if the
    // user making the request is the channel's admin/creator
    const user = await User.findOne({ 'tokens.token': req.cookies.token });
    // now see if this user is the channel's admin
    if (!user._id.equals(channel.admin)) {
      // unauthorized request
      return res
        .status(401)
        .send({ error: "You don't have permission to add to this channel" });
    }

    // otherwise, add the post
    const postContents = req.body.postcontents;
    const post = new Post({
      contents: postContents,
      sender: user._id,
      channel: channel._id,
    });

    const savedPost = await post.save();

    // add the post (id) to the channel
    channel.posts.push(savedPost._id);
    await channel.save();
    return res.status(201).send({ result: 'Post Added' });

    // get the post content
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

/**
 * Return all posts from the channel with the name provided
 *
 * */
router.get('/channel/:channel', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // parameter is the room name
    const channelName = req.params.channel;
    // ensure that the channel exists first
    const channel = await Channel.findOne({ name: channelName });

    if (!channel) {
      return res
        .status(404)
        .send({ error: `No channel ${channelName} exists` });
    }

    const user = await User.findOne({ 'tokens.token': req.cookies.token });
    if (!user._id.equals(channel.admin)) {
      return res
        .status(401)
        .send({ error: "You don't have permission to add to this channel" });
    }

    // otherwise get the channel id
    const channelId = channel._id;
    const channelPosts = await Post.find({
      channel: channelId,
    });

    res.status(200).send({
      channelPosts,
    });
  } else {
    return res.status(401).send({ error: 'Unauthorized' });
  }
});

module.exports = router;
