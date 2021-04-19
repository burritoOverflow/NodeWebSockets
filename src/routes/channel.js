/* eslint-disable no-restricted-syntax */
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

  // first get all channels
  const channels = await Channel.find({});
  const channelIds = new Array();

  // collect all channel ids
  for (let idx = 0; idx < channels.length; idx++) {
    const { _id, name } = channels[idx];
    // channel map contains channel's id as key and the channel's
    // name as the value
    channelMap.set(_id.toString(), name);
    channelIds.push(_id);
  }

  // create a query for each channel id to get the latest post
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

  // handle all queries simultaneously
  Promise.all(queries).then((response) => {
    response.forEach((doc) => {
      if (doc.length) {
        const { date, channel } = doc[0];
        // get the channel name from the channel id
        const chanName = channelMap.get(channel.toString());
        // for handling the case where there is a channel w/o posts
        channelMap.delete(channel.toString());
        channelsLastUpdate.set(chanName, +new Date(date));
      }
    });

    // check for any remaining keys in the channel map
    // these are for leftover channels not covered by the query
    // (those with 0 posts)
    const channelIdKeys = [...channelMap.keys()];
    // we have a channel w/o posts
    if (channelIdKeys.length) {
      // eslint-disable-next-line no-unused-vars
      for (const [_, cName] of channelMap) {
        // set the channel with no posts to no update time
        channelsLastUpdate.set(cName, null);
      }
    }
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
    const channelName = req.body.name;
    const newChannelObj = {
      name: channelName,
      admin: channelAdmin,
    };

    try {
      // save the new channel and set the
      // latest post time to null
      const channel = new Channel(newChannelObj);
      await channel.save();
      channelsLastUpdate.set(channelName, null);
      // errors occur as a result of invalid parameters wrt to schema requirements
    } catch (error) {
      // eslint-disable-next-line no-underscore-dangle
      const _error = error?.errors?.name?.message;
      return res.status(400).send({ error: _error });
    }

    return res.status(201).send({
      result: `Channel ${channelName} created`,
    });
  }
  // no token
  return res.status(401).send({ error: 'Unauthorized' });
});

/**
 *  add posted contents to the channel
 * Example
 * {
 *     "postcontents" : "foo bar"
 * }
 */
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
    return res
      .status(201)
      .send({ result: 'Post Added', postId: savedPost._id });
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

/**
 * Add the supplied reaction to the target post
 */
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
    // get the names of all channels
    const allChannels = await Channel.find();

    // return only the number of posts in the channel and the name
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
 * Delete the post associated with postid
 */
router.delete('/channel/:channel/:postid', async (req, res) => {
  // user validation
  if (req.cookies.token) {
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    // determine if the user making the request is the admin of the channel
    const channel = await Channel.findOne({ name: req.params.channel });
    if (!channel) {
      return res
        .status(404)
        .send({ error: `Channel ${req.params.channel} does not exist` });
    }

    // provided a valid channel, check that the user is the admin of the channel
    const { admin } = channel;
    const user = await User.findOne({ 'tokens.token': req.cookies.token });

    // now see if this user is the channel's admin
    if (!user._id.equals(admin)) {
      return res.status(401).send({
        error: "You don't have permission to delete posts from this channel",
      });
    }

    // we have a valid user, now we need to delete the post
    const post = await Post.findOneAndDelete({ _id: req.params.postid });
    // post doesn't exist
    if (!post) {
      return res.status(404).send({ error: 'Invalid Post id provided' });
    }

    // since the post has been deleted update the channel's latest update time
    channelsLastUpdate.set(req.params.channel, +new Date());
    return res.status(200).send({ result: 'Post deleted' });
  } // invalid user token provided
  return res.status(401).send({ error: 'Unauthorized' });
});

/**
 * Find all channels that the user provided is admin of
 * Returns an arr of names of the channels that the user is admin
 * of
 */
router.get('/channel/getchannels/:adminname', async (req, res) => {
  if (req.cookies.token) {
    // verify that the user is valid
    const userObj = await verifyUserJWT(req.cookies.token);
    if (!userObj.name) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const username = req.params.adminname;

    // we need the user's id in order to determine which
    // channels they admin
    const userId = await User.findOne({ name: username });
    if (!userId) {
      return res.status(404).send({ error: `No user ${username}` });
    }

    // otherwise, find all channels where the user provided is admin
    const { _id } = userId;
    const usersChannels = await Channel.find({ admin: _id });
    // just return the names of the channels
    return res.send({ usersChannels: usersChannels.map((ch) => ch.name) });
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

    // and all posts from the channel
    const channelPosts = await Post.find({
      channel: channelId,
    });

    const { name } = await User.findById({ _id: channel.admin });
    return res.status(200).send({
      channelPosts,
      sender: name,
    });
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

/**
 * Return the update timestamp for the channel supplied
 */
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

    // otherwise, return the latest update for the channel
    res.set('Keep-Alive', 'timeout=31, max=100');
    return res.status(200).send({
      updateTime: channelsLastUpdate.get(channelName),
    });
  }
  return res.status(401).send({ error: 'Unauthorized' });
});

(async () => {
  // run the queries on server start
  await setLatestPostTimes();
})();

module.exports = router;
