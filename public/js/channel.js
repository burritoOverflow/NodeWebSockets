/**
 * For storing the state of the channel posts
 */
class ChannelPosts {
  channelName;
  channelAdmin;
  posts;
  latestUpdateTime;
  userAdmin;

  constructor(channelName, posts, channelAdmin, latestUpdateTime, userAdmin) {
    this.channelName = channelName;
    this.channelAdmin = channelAdmin;
    this.posts = posts;
    this.latestUpdateTime = latestUpdateTime;
    this.userAdmin = userAdmin;
  }

  /**
   * Append each post from the channel to the DOM
   *
   * @param {HTMLElement} ul - the unordered list to append the posts to
   */
  async displayPosts(ul) {
    let idx = 0;
    let postLen = this.posts.length;
    const chanName = getChannelName();

    this.posts.forEach((post) => {
      const postLi = document.createElement('li');
      const dateSpan = document.createElement('span');
      dateSpan.style.margin = '1em';
      dateSpan.innerText = post.date;

      const postContents = document.createElement('p');
      postContents.innerText = post.contents;

      // create the reaction elements
      const likes = document.createElement('span');
      likes.classList.add('emoji');
      likes.innerHTML = String.fromCodePoint(0x1f44d) + ' ' + post.likes;

      const dislikes = document.createElement('span');
      dislikes.classList.add('emoji');
      dislikes.innerHTML = String.fromCodePoint(0x1f44e) + ' ' + post.dislikes;

      const div = document.createElement('div');
      div.classList.add('emoji-div');
      div.appendChild(likes);
      div.appendChild(dislikes);

      // only allow reactions for non-admin users
      if (!this.userAdmin) {
        likes.addEventListener('click', async () => {
          const res = await addReaction(post._id, 'like', chanName);
          // if the request fails, the user is most likely looking at a stale post
          // eg the admin deleted the post while it still exists on this client
          if (res) {
            console.log(res);
            const likeCounter = likes.innerHTML.slice(3);
            let counter = parseInt(likeCounter);
            ++counter;
            likes.innerHTML = String.fromCodePoint(0x1f44d) + ' ' + counter;

            // toggle the liked class style on like
            div.classList.add('liked');
            postLi.classList.add('liked-border');

            // change the style for a brief period
            setTimeout(() => {
              div.classList.remove('liked');
              postLi.classList.remove('liked-border');
            }, 900);
          }
        });

        dislikes.addEventListener('click', async () => {
          const res = await addReaction(post._id, 'dislike', chanName);
          if (res) {
            const dislikeCounter = dislikes.innerHTML.slice(3);
            let counter = parseInt(dislikeCounter);
            ++counter;
            dislikes.innerHTML = String.fromCodePoint(0x1f44d) + ' ' + counter;

            div.classList.add('disliked');
            postLi.classList.add('disliked-border');
            setTimeout(() => {
              div.classList.remove('disliked');
              postLi.classList.remove('disliked-border');
            }, 940);
          }
        });
      } else {
        // end user admin check--this branch is admin users
        // only user admins get the delete post element
        const deletePostSpan = document.createElement('span');
        deletePostSpan.classList.add('delete-post');
        deletePostSpan.innerText = 'X';
        postLi.appendChild(deletePostSpan);

        // change the padding on the top for a better appearance w/ new element
        postLi.style.paddingTop = 0;

        // need the click handler to delete the post
        const { channelName } = this;
        const _this = this;

        deletePostSpan.onclick = async function () {
          const res = await deletePost(post._id, channelName);
          // if success, we need to delete the post (the parent element containing all post contents)
          if (res) {
            // remove the line element between this post and the previous
            if (postLi.previousSibling) {
              postLi.previousSibling.remove();
            } else {
              // this is the first post element
              // so we also need its next sibling
              if (postLi.nextSibling) {
                postLi.nextSibling.remove();
              }
            }
            // finally, remove the post itself
            postLi.remove();

            // and update the state
            _this.deletePost(post._id);

            // we'll do a quick styling on success
            const channelPosts = document.getElementById('channel-main');
            channelPosts.classList.add('delete-border');

            // revert
            setTimeout(() => {
              channelPosts.classList.remove('delete-border');
            }, 1200);
          }
        };
      }

      // add all created elements to the parent element
      postLi.appendChild(dateSpan);
      postLi.appendChild(postContents);
      postLi.appendChild(div);
      postLi.classList.add('post-element');

      idx % 2 == 0
        ? (postLi.style.marginLeft = '4em')
        : (postLi.style.marginLeft = '8em');

      const backgroundColor = window.getComputedStyle(dateSpan).backgroundColor;
      const color = window.getComputedStyle(dateSpan).color;

      postLi.onmouseenter = () => {
        postLi.firstChild.style.backgroundColor = 'black';
        postLi.firstChild.style.color = getComputedStyle(
          document.documentElement,
        ).getPropertyValue('--primaryColor');
      };

      postLi.onmouseleave = () => {
        dateSpan.style.backgroundColor = backgroundColor;
        dateSpan.style.color = color;
      };

      const lineDiv = document.createElement('div');
      lineDiv.classList.add('line-div');

      ul.appendChild(postLi);
      if (++idx < postLen) {
        ul.appendChild(lineDiv);
      }
    });

    // addLinesToPosts();
  }

  /**
   * Change the color of the title's individual character elements on an interval.
   */
  changeColorTitle() {
    let i = 0;
    const title = document.getElementById('title');
    const titleStrLen = title.innerText.length;
    const defaultColor = 'antiquewhite';
    let doDefault = false;

    // set a property when invoked, for cancellation
    this.intervalId = setInterval(() => {
      const colorChoice = getComputedStyle(
        document.documentElement,
      ).getPropertyValue('--primaryColor');

      // use default color if true
      doDefault
        ? (title.childNodes[i++].style.color = defaultColor)
        : (title.childNodes[i++].style.color = colorChoice);

      // change colors when all characters have been addressed
      if (i >= titleStrLen) {
        i = 0;
        doDefault = !doDefault;
      }
    }, 700);
  }

  /**
   *
   * @param {string} postId  - remove from posts the post with the provided ID
   */
  deletePost(postId) {
    this.posts = this.posts.filter(function (p) {
      return p._id !== postId;
    });
  }
}

/**
 * Get and return the name of the channel from the query string
 *
 * @returns {string} - the name of the channel
 */
function getChannelName() {
  const url = window.location.href;
  const params = url.split('?')[1];
  const channelName = params.split('=')[1];
  return channelName;
}

/**
 * Scroll down to the latest post displayed in the channel
 */
function scrollToBottomPosts() {
  const posts = document.getElementsByClassName('post-element');
  if (posts.length) {
    posts[posts.length - 1].scrollIntoView({
      block: 'end',
      behavior: 'smooth',
    });
  }
}

/**
 * Delete the post (if admin)
 *
 * @param {string} postId - the id of the post to delete
 */
async function deletePost(postId, channelName) {
  const deletePostRoute = '/api/channel/' + channelName + '/' + postId;
  const response = await fetch(deletePostRoute, { method: 'DELETE' });
  const jsonRes = await response.json();
  return jsonRes;
}

/**
 * Fetch the channel's latest timestamp
 *
 * @param {string} chanName - the name of the channel from which to
 * get the latest update timestamp
 * @returns  - the timestamp for the channel
 */
async function getLatestUpdateTime(chanName) {
  const updateTimeRoute = '/api/channel/' + chanName + '/updatetime';
  const response = await fetch(updateTimeRoute);
  const data = await response.json();
  return data.updateTime;
}

/**
 *  POST a reaction to the post
 *
 * @param {ObjectId} postid - the id of post to update the reaction to
 * @param {string} reaction - 'like' or 'dislike', shared from the event handler
 * @param {string} chanName - the name of the channel
 * @returns
 */
async function addReaction(postid, reaction, chanName) {
  const apiRoute = '/api/channel/' + chanName + '/reaction';
  try {
    const response = await fetch(apiRoute, {
      method: 'POST',
      body: JSON.stringify({ reaction, postid }),
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
    });

    const jsonData = await response.json();
    if (response.ok) {
      return jsonData;
    }
  } catch (err) {
    // failed request
    return err;
  }
}

/**
 * Get all posts in the channel
 *
 * @param {string} chanName - the channel's name
 * @returns {} - the data and the sender of the post in the channel
 */
async function getAllPostsInChannel(chanName) {
  const apiRoute = '/api/channel/' + chanName;
  const response = await fetch(apiRoute);
  let data = await response.json();
  const { sender } = data;
  data = data['channelPosts'];
  // convert dates to locale strings
  data.forEach((d) => {
    d.date = new Date(d.date).toLocaleString();
  });
  return { data, sender };
}

/**
 * For non-admins, set the interval to poll the server for updates
 *
 * @param {Object} chanObj - the channel object, representing the
 * channel state
 */
async function setPollingInterval(chanObj) {
  const { channelName } = chanObj;
  setInterval(async () => {
    // check the timestamp
    const latestUpdate = await getLatestUpdateTime(channelName);
    if (latestUpdate > chanObj.latestUpdateTime) {
      // otherwise, fetch the data
      const { data } = await getAllPostsInChannel(channelName);
      // update the ui with the latest posts
      chanObj.posts = data;
      chanObj.latestUpdateTime = latestUpdate;
      resetChannelPosts();
      chanObj.displayPosts(document.getElementById('channel-posts'));
      scrollToBottomPosts();
    } else {
      return;
    }

    // poll every 30 seconds
  }, 30 * 1000);
}

/**
 * Determine if the current user is the admin for the channel
 *
 * @param {string} chanName - the channel name
 * @returns - true if this user is the admin, false otherwise
 */
async function isAdmin(chanName) {
  // get username from cookie
  const username = document.cookie.split('=')[1];
  const route = `/api/channel/${chanName}/admin`;
  const res = await fetch(route);
  const data = await res.json();
  // determine if the user is the channel's admin
  return data.channelAdminName.toLowerCase() === username.toLowerCase();
}

function findAbsolutePosition(htmlElement) {
  let x = 0;
  let y = 0;
  for (; htmlElement != null; htmlElement = htmlElement.offsetParent) {
    x += htmlElement.offsetLeft;
    y += htmlElement.offsetTop;
  }
  return {
    x: x,
    y: y,
  };
}

function drawLine(x1, y1, x2, y2) {
  const color = getComputedStyle(document.documentElement).getPropertyValue(
    '--primaryColor',
  );
  const svg = document.getElementById('canvas');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('x2', x2);
  line.setAttribute('y1', y1);
  line.setAttribute('y2', y2);
  line.setAttributeNS(null, 'stroke-width', '2');
  line.setAttributeNS(null, 'stroke', color);
  svg.appendChild(line);
}

// pass first and second
function connectElements(first, second) {
  const firstPos = findAbsolutePosition(first);
  let x1 = firstPos.x - 5; // trim it a little so it doesn't show past the end
  let y1 = firstPos.y;
  x1 += first.offsetWidth;
  y1 += first.offsetHeight / 2;

  const secondPos = findAbsolutePosition(second);
  // avoid overlap
  const x2 = secondPos.x + 3;
  let y2 = secondPos.y;
  y2 += second.offsetHeight / 2;

  drawLine(x1, y1, x2, y2);
}

function addLinesToPosts() {
  // remove all previous
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';
  const titleEl = document.getElementById('title');
  const postElements = document.getElementById('channel-posts').childNodes;

  for (let index = 0; index < postElements.length; index++) {
    if (index === 0) {
      connectElements(titleEl, postElements[index]);
    } else {
      connectElements(postElements[index - 1], postElements[index]);
    }
  }
}

/**
 * Remove all child elements from the ul for the channel posts.
 */
function resetChannelPosts() {
  document.getElementById('channel-posts').textContent = '';
}

/**
 * Add a post to the channel when a user presses enter
 * if contents are present in the textarea
 *
 * @param {string} channelName - the name of the channel the user is in
 */
async function addEnterHandlerTextArea(channelName, chanObj) {
  const textArea = document.getElementById('channel-post-input');
  const apiRoute = 'api/channel/' + channelName + '/addpost';

  textArea.onkeypress = async function (event) {
    const { key } = event;
    if (key === 'Enter') {
      const postcontents = textArea.value.trim();
      if (postcontents !== '') {
        // post the data to the channel route
        const response = await fetch(apiRoute, {
          method: 'POST',
          body: JSON.stringify({ postcontents }),
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
        });

        if (response.ok) {
          // clear the input area
          textArea.value = '';

          // we need the JSON contents for the id
          const jsonRes = await response.json();
          // add the post to the channel posts
          chanObj.posts.push({
            _id: jsonRes.postId,
            contents: postcontents,
            date: new Date().toLocaleString(),
            likes: 0,
            dislikes: 0,
          });

          resetChannelPosts();
          chanObj.displayPosts(document.getElementById('channel-posts'));
          scrollToBottomPosts();
        } else {
          // TODO handle error
        }
      } else {
        // empty post contents
        return;
      }
    } // key not enter
  };
}

/**
 * init - set admin status, get posts, set timestamp, ste UI elements (header)
 */
window.onload = async function init() {
  const colorChoice = localStorage.getItem('colorChoice');
  if (colorChoice) {
    // if user has stored choice, set the style accordingly
    document.documentElement.style.setProperty('--primaryColor', colorChoice);
  }

  const chanName = getChannelName();
  const title = document.getElementById('title');

  const { data, sender } = await getAllPostsInChannel(chanName);
  const latestUpdate = await getLatestUpdateTime(chanName);
  const isUserAdmin = await isAdmin(chanName);

  // for the application's state
  const channelObj = new ChannelPosts(
    chanName,
    data,
    sender,
    latestUpdate,
    isUserAdmin,
  );

  // create the channel header
  const finalName = isUserAdmin
    ? `Your channel: ${chanName}`
    : `${sender}'s channel:\n\n${chanName}`;

  for (let i = 0; i < finalName.length; ++i) {
    const span = document.createElement('span');
    span.innerText = finalName.charAt(i);
    title.appendChild(span);
  }

  channelObj.displayPosts(document.getElementById('channel-posts'));
  scrollToBottomPosts();

  //   window.onresize = addLinesToPosts;
  const elArr = [document.getElementById('title')];

  //   const svg = document.getElementById('canvas');
  //   svg.style.width = document.body.clientWidth;
  //   svg.style.height = document.body.clientHeight;

  const channelInputEl = document.getElementById('channel-post-parent');
  if (isUserAdmin) {
    // if the user is the admin, show the textarea
    channelInputEl.classList.remove('no-display');

    // add the enter event listener for the text area
    addEnterHandlerTextArea(chanName, channelObj);
  } else {
    // non admins poll for changes; admins the elements are updated when they
    // update the posts in the channel
    setPollingInterval(channelObj);

    // otherwise remove the element (non-admins cannot add channels)
    channelInputEl.remove();
  }

  // brief styling by firing hover events
  setTimeout(() => {
    const mouseOverEvent = new Event('mouseenter');
    const postEls = document.getElementsByClassName('post-element');
    for (let i = 0; i < postEls.length; i++) {
      elArr.push(postEls[i]);
    }

    elArr.forEach((el) => {
      el.dispatchEvent(mouseOverEvent);
      el.style.borderColor = 'whitesmoke';
    });
  }, 1200);

  // revert the style from the change above at a smaller interval
  setTimeout(() => {
    elArr.forEach((el) => {
      const mouseLeaveEvent = new Event('mouseleave');
      el.dispatchEvent(mouseLeaveEvent);
      el.style.borderColor = getComputedStyle(
        document.documentElement,
      ).getPropertyValue('--primaryColor');
    });
  }, 2100);

  setTimeout(() => {
    channelObj.changeColorTitle();
  }, 3000);

  title.onclick = () => {
    clearInterval(channelObj.intervalId);
  };
};
