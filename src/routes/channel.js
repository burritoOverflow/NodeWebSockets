/* eslint-disable no-underscore-dangle */
const express = require('express');
const { Channel } = require('../models/channel');
const { Post } = require('../models/post');
const { User } = require('../models/user');
const verifyUserJWT = require('../utils/verifyJWT');

const router = express.Router();

// store the channel name with the date of the latest post
let channelsLastUpdate;

/**
 * Update the channel time map with the latest timestamp for
 * each channel's latest update
 */
async function setLatestPostTimes() {
  channelsLastUpdate = new Map();
  const channelMap = new Map();
  const channels = await Channel.find({});
  const channelIds = new Array();

  // get all channel ids
  for (let idx = 0; idx < channels.length; idx++) {
    const { _id, name } = channels[idx];
    channelMap.set(_id.toString(), name);
    channelIds.push(_id);
  }

  // create a query for each
  const queries = new Array();
  channelIds.forEach((ch) => {
    // we only need the latest post from each channel
    const getPostsQuery = Post.find({ channel: ch })
      .sort({
        date: -1,
      })
      .limit(1);
    queries.push(getPostsQuery.exec());
  });

  Promise.all(queries).then((response) => {
    response.forEach((doc) => {
      const { date, channel } = doc[0];
      // get the channel name from the channel id
      const chanName = channelMap.get(channel.toString());
      channelsLastUpdate.set(chanName, +new Date(date));
    });
  });
}

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

    // update the map to reflect the update
    channelsLastUpdate.set(channelName, +new Date());

    await channel.save();
    return res.status(201).send({ result: 'Post Added' });

    // get the post content
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

router.post('/channel/:channel/reaction', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      // invalid token provided
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const { reaction, postid } = req.body;
    // we only need this to see if it's a valid channel
    const channelName = req.params.channel;
    const postToUpdate = await Post.findById({ _id: postid });

    if (!channelsLastUpdate.has(channelName) || !postToUpdate) {
      return res.status(404).send({ error: 'Invalid post or channel' });
    }

    // update the metric
    switch (reaction) {
      case 'like':
        postToUpdate.likes += 1;
        await postToUpdate.save();
        return res.status(201).send({ updated: postToUpdate.likes });
      case 'dislike':
        postToUpdate.dislikes += 1;
        await postToUpdate.save();
        return res.status(201).send({ updated: postToUpdate.dislikes });
      default:
        return res.status(400).send({ error: 'invalid reaction provided' });
    }
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

/**
 * Get the names of the channels and the number of posts in that channel
 */
router.get('/channel', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const allChannels = await Channel.find();
    const channels = allChannels.map((c) => ({
      name: c.name,
      numPosts: c.posts.length,
    }));
    return res.status(200).send({ channels });
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

/**
 * Get the admin for the channel provided in the param
 */
router.get('/channel/:channel/admin', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const channelName = req.params.channel;
    const channel = await Channel.findOne({ name: channelName });

    if (!channel) {
      return res
        .status(404)
        .send({ error: `No channel ${channelName} exists` });
    }

    // get and return the admin's name
    const adminId = channel.admin;
    const channelAdmin = await User.findById(adminId);
    const channelAdminName = channelAdmin.name;

    return res.status(200).send({
      channelAdminName,
    });
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

/**
 * Return all posts from the channel with the name provided.
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

    // otherwise get the channel id
    const channelId = channel._id;
    const channelPosts = await Post.find({
      channel: channelId,
    });

    return res.status(200).send({
      channelPosts,
      sender: userObj.name,
    });
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

router.get('/channel/:channel/updatetime', async (req, res) => {
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      // invalid token provided
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // parameter is the room name
    const channelName = req.params.channel;
    if (!channelsLastUpdate.has(channelName)) {
      return res
        .status(404)
        .send({ error: `No channel ${channelName} exists` });
    }

    // return the latest update for the channel
    return res.status(200).send({
      updateTime: channelsLastUpdate.get(channelName),
    });
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

(async () => {
  await setLatestPostTimes();
})();

module.exports = router;
