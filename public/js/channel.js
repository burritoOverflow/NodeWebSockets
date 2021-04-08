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

      // only allow reactions for non-admin users
      if (!this.userAdmin) {
        likes.addEventListener('click', async () => {
          const res = await addReaction(post._id, 'like', chanName);
          if (res) {
            console.log(res);
            const likeCounter = likes.innerHTML.slice(3);
            let counter = parseInt(likeCounter);
            ++counter;
            likes.innerHTML = String.fromCodePoint(0x1f44d) + ' ' + counter;
          }
        });

        dislikes.addEventListener('click', async () => {
          const res = await addReaction(post._id, 'dislike', chanName);
          if (res) {
            const dislikeCounter = dislikes.innerHTML.slice(3);
            let counter = parseInt(dislikeCounter);
            ++counter;
            dislikes.innerHTML = String.fromCodePoint(0x1f44d) + ' ' + counter;
          }
        });
      } // end user admin check

      const div = document.createElement('div');
      div.classList.add('emoji-div');
      div.appendChild(likes);
      div.appendChild(dislikes);

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
   * Change the color of the title elements on an interval.
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

function scrollToBottomPosts() {
  const posts = document.getElementsByClassName('post-element');
  if (posts.length) {
    posts[posts.length - 1].scrollIntoView({
      block: 'end',
      behavior: 'smooth',
    });
  }
}

async function getLatestUpdateTime(chanName) {
  const updateTimeRoute = '/api/channel/' + chanName + '/updatetime';
  const response = await fetch(updateTimeRoute);
  const data = await response.json();
  return data.updateTime;
}

async function addReaction(postid, reaction, chanName) {
  const apiRoute = '/api/channel/' + chanName + '/reaction';
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
      console.log('new');
      // otherwise, fetch the data
      const { data } = await getAllPostsInChannel(channelName);
      // update the ui with the latest posts
      chanObj.posts = data;
      chanObj.latestUpdateTime = latestUpdate;
      resetChannelPosts();
      chanObj.displayPosts(document.getElementById('channel-posts'));
      scrollToBottomPosts();
    } else {
      console.log('old');
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
 * Remove all child elements from the ul for the channel posts
 */
function resetChannelPosts() {
  document.getElementById('channel-posts').textContent = '';
}

/**
 * Add a post to the channel
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

          // add the post to the channel posts
          chanObj.posts.push({
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
