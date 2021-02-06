// takes a url arg if not connecting to the same server serving the script
// eslint-disable-next-line no-undef
const socket = io();

const msgInput = document.getElementById('message-text');
const msgBtn = document.getElementById('submit-button');
const sendLocButton = document.getElementById('share-location-button');
const clientCountMsg = document.getElementById('received-message');
const msgThread = document.getElementById('message-thread');

/**
 * Show the user a toast containing the string argument
 * @param {*} message - the string contents of the toast
 */
function showUserToast(message) {
  const snackbar = document.getElementById('snackbar');
  snackbar.innerText = message;
  snackbar.classList.add('show');
  setTimeout(() => {
    snackbar.classList.remove('show');
  }, 2000);
}

/**
 * @param {*} message - the message to show in the notification
 */
function displayNotification(message) {
  if (!('Notification' in window)) {
    // we'll just fail gracefully
    return;
  }

  if (Notification.permission === 'granted') {
    const notification = new Notification(message);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        const notification = new Notification(message);
      }
    });
  }
}

/**
 * Emit the message to connected clients
 * @param {*} message - The string contents from the input element
 */
function sendMessage(message) {
  const msgObj = { message, msgSendDate: +new Date() };
  // callback is invoked when profanity is detected
  socket.emit('clientChat', msgObj, (serverMsg) => {
    showUserToast(serverMsg);
  });
  // remove text from the input text-element
  msgInput.value = '';
}

/**
 *
 * @param {*} element - html element
 * @return - true if the element is either hover or focused
 */
function isElementHoveredOrFocused(element) {
  const isHover = element.parentElement.querySelector(':hover') === element;
  const isFocus = element.parentElement.querySelector(':focus') === element;
  return isHover || isFocus;
}

/**
 * Scroll the view of messages to the latest message
 */
function scrollToLatestMessage() {
  const messages = document.getElementsByClassName('message');
  messages[messages.length - 1].scrollIntoView({
    block: 'end',
    behavior: 'smooth',
  });
}

/**
 * determine if valid http(s) url
 * @param {*} string
 * @return {boolean} - true if valid
 */
function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

msgBtn.addEventListener('click', () => {
  // make sure a message is present
  const msgStr = msgInput.value.trim();
  if (msgStr === '') {
    return;
  }
  sendMessage(msgStr);
});

/**
 * Parse the query string parameters for the room and the user name
 * Return an object containing those
 * @return {Object} - object containing username and room
 */
function parseQSParams() {
  const queryStr = window.location.search;
  const qsParameters = queryStr.split('&');
  return {
    username: qsParameters[0].split('=')[1],
    room: qsParameters[1].split('=')[1],
  };
}

// event handler for the send location button
sendLocButton.addEventListener('click', () => {
  sendLocButton.disabled = true;
  sendLocButton.classList.add('blurry-text');

  if (!navigator.geolocation) {
    return;
  }

  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    const latLng = {
      latitude,
      longitude,
    };
    socket.emit('userLocation', latLng, (serverAckMessage) => {
      showUserToast(serverAckMessage);
      sendLocButton.enabled = true;
    });
  });
});

// allow for enter key in the text input to send a message
msgInput.addEventListener('keypress', (e) => {
  const { key } = e;
  if (key === 'Enter') {
    const msgStr = msgInput.value.trim();
    if (msgStr !== '') {
      sendMessage(msgStr);
    }
  }
});

/**
 * append individual messages to the message thread
 * @param {*} message
 */
function addMsgToThread(message) {
  const li = document.createElement('li');
  li.classList.add('message');

  const msgTokens = message.message.split(' ');

  let containsURL = false;
  const urlIdxs = [];

  const anchorElements = [];

  // check if a single string in the message is a valid HTTP(S) url
  msgTokens.forEach((token, idx) => {
    if (isValidHttpUrl(token)) {
      urlIdxs.push(idx);
      containsURL = true;
    }
  });

  // create the spans for the user name the date of the message
  const userNameSpan = document.createElement('span');

  // check if the user is seeing their own sent message
  const usersOwnMessage = message.username === localStorage.getItem('username');

  // UI should reflect a user seeing their own message differently
  if (usersOwnMessage) {
    userNameSpan.innerText = 'You ';
  } else {
    userNameSpan.innerText = `${message.username} `;
  }
  userNameSpan.classList.add('username-span');

  // parse the timestamp in the message and display
  // as a formatted string
  const dateSpan = document.createElement('span');
  dateSpan.innerText = ` on ${new Date(message.msgSendDate)
    .toLocaleString()
    .replace(',', ' at')} `;
  dateSpan.classList.add('date-span');

  // prepend the text on the list element, only if other user's message
  if (!usersOwnMessage) {
    li.innerText = 'From ';
  }

  li.appendChild(userNameSpan);
  li.appendChild(dateSpan);

  // if the message sent contains a url
  if (containsURL) {
    msgTokens.forEach((token, idx) => {
      if (urlIdxs.includes(idx)) {
        const anchorEl = document.createElement('a');
        anchorEl.setAttribute('href', token);
        anchorEl.setAttribute('target', '_blank');
        anchorEl.innerText = token;
        anchorElements.push(anchorEl);

        li.appendChild(anchorEl);
      } else {
        // prettier-ignore
        // eslint-disable-next-line template-curly-spacing, no-multi-spaces
        li.innerText += `${token} `;
      }
    });
  } else {
    // in the event a token string is not a URL, we'll
    // create an additional span for the actual string message
    const msgSpan = document.createElement('span');
    msgSpan.classList.add('message-element-span');
    msgSpan.innerText = `${message.message}`;
    li.appendChild(msgSpan);
  }

  // dynamically change the style on hover events
  li.addEventListener('mouseover', () => {
    msgThread.style.backgroundColor = 'black';
    document.querySelectorAll('.message').forEach((msgEl) => {
      if (msgEl !== li) {
        msgEl.classList.add('blurry-text');
      }
    });
  });

  li.addEventListener('mouseout', () => {
    msgThread.style.backgroundColor = '#18181b';
    document.querySelectorAll('.message').forEach((msgEl) => {
      if (msgEl !== li) {
        // eslint-disable-next-line no-param-reassign
        msgEl.style.opacity = 1.0;
        msgEl.classList.remove('blurry-text');
      }
    });
  });

  msgThread.appendChild(li);

  // once the message is added to the DOM, scroll to the latest
  if (!isElementHoveredOrFocused(msgThread)) {
    scrollToLatestMessage();
  }

  // show a user a notification
  if (!usersOwnMessage) {
    displayNotification(`${message.username} said ${message.message}`);
  }
}

/**
 *  Display the other users currently in the room
 * @param {*} usersArr - array containing the other users in the room
 */
function addUserToUserList(usersArr) {
  let username;
  // check localstorage first
  if (localStorage.getItem('username') === null) {
    // we can check the query string
    username = parseQSParams().username;
  } else {
    username = localStorage.getItem('username');
  }

  const usersIndex = usersArr.indexOf(username);
  // sanity check
  if (usersIndex > -1) {
    // remove the user from the arr
    usersArr.splice(usersIndex, 1);
  }

  // suppose we'll also have an element for the user themselves
  usersArr.push('You');

  const usersList = document.getElementById('users-list');
  const currentUserLis = [];

  // probably should have used a framework or something to avoid sloppy
  // state management
  usersList.childNodes.forEach((li) => {
    currentUserLis.push(li.innerText);
  });

  usersArr.forEach((userStr) => {
    // avoid appending users that are already in the DOM
    if (currentUserLis.includes(userStr)) {
      return;
    }
    const userLi = document.createElement('li');
    userLi.innerText = userStr;
    usersList.appendChild(userLi);
  });
}

// receive the client count when the server updates
socket.on('clientCount', (message) => {
  const msgNum = Number(message);
  clientCountMsg.innerText =
    message > 1 ? `${msgNum} users currently` : 'You are the only user';
});

// recv's an array of usernames for the current room
socket.on('currentRoomUsers', (usersArr) => {
  addUserToUserList(usersArr);
});

// event listener for incoming events
socket.on('chatMessage', (message) => {
  addMsgToThread(message);
});

// server emits tweak event when a special message is detected
socket.on('tweak', (messageObj) => {
  const { type } = messageObj;
  switch (type) {
    case 'bright':
      document.body.classList.add('bright');
      document.getElementById('message-thread').classList.add('bright');
      document.getElementById('message-text').classList.add('bright');
      break;
    case 'dark':
      document.body.classList.remove('bright');
      document.getElementById('message-thread').classList.remove('bright');
      document.getElementById('message-text').classList.remove('bright');
      break;
    case 'slidedown':
      document.getElementById('message-thread').classList.add('slide-down');
      document.getElementById('message-text').classList.add('slide-down');
      break;
    default:
      break;
  }
});

// recvs a broadcast when a connection is detected server-side.
// add this message in a seperate fashion
socket.on('newUserMessage', (message) => {
  if (document.hidden) {
    displayNotification(message);
  } else {
    showUserToast(message);
  }
});

// display the toast when a client leaves, if the page
// is visible, else we'll use a notification
socket.on('userLeft', (message) => {
  if (document.hidden) {
    displayNotification(message);
  } else {
    showUserToast(message);
  }
});

// emit a join event to the server with the username and room
// we'll also store the User's name in localstorage, and should change the DOM
// elements to reflect that
socket.emit('join', parseQSParams(), (error) => {
  const { username, room } = parseQSParams();
  if (error) {
    window.location.href = '/';
    // TODO handle the toast on login, perhaps
    showUserToast(`Failed to join ${room}`);
  } else {
    showUserToast(`You joined ${room}!`);
    // NOTE: this will blow away the previous username stored
    // this probably isn't a problem, but it's best to check
    localStorage.setItem('username', username);
  }
});
