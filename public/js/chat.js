/* eslint-disable import/extensions */
/* eslint-disable no-plusplus */
import PrivateMessage from './PrivateMessage.js';
import PrivateMessageMap from './PrivateMessageMap.js';
import {
  parseQSParams,
  isValidHttpUrl,
  isElementHoveredOrFocused,
  displayNotification,
} from './utils.js';

// takes a url arg if not connecting to the same server serving the script
// eslint-disable-next-line no-undef
const socket = io({ autoConnect: false });

const msgInput = document.getElementById('message-text');
const msgBtn = document.getElementById('submit-button');
const fetchOldMessagesBtn = document.getElementById('fetch-older-messages');
const sendLocButton = document.getElementById('share-location-button');
const clientCountMsg = document.getElementById('received-message');
const msgThread = document.getElementById('message-thread');
const filterMsgsInput = document.getElementById('filter-messages');
const fileInput = document.getElementById('file-upload-input');

// count the number of requests to date for fetching data
let olderMessagesReqCount = 0;

// contains object for each connected user with the usernames and the sid
let currentUsersArr = [];

// set when a user LI element is selected
let pmReciever;

// store an object containing pms from each user
const pmMap = new PrivateMessageMap();

/**
 *
 * @param {*} usersObjArr - array of user objects (sids and usernames)
 */
function updateUsersArr(usersObjArr) {
  // reset the state of the users arr
  currentUsersArr = [];

  // get this users username
  let username;
  if (localStorage.getItem('username') === null) {
    username = parseQSParams().username;
  } else {
    username = localStorage.getItem('username');
  }

  // update the user array with other users
  usersObjArr.forEach((user) => {
    if (user.username !== username) {
      currentUsersArr.push(user);
    }
  });
}

/**
 * Set the state of the PM recipient
 * @param {*} username - the username selected from the list by the user
 */
function setPMReciever(username) {
  currentUsersArr.forEach((u) => {
    if (u.username === username) {
      pmReciever = u;
    }
  });
}

/**
 * Fires when the send pm button is clicked, if the preconditions are met.
 */
function sendPM() {
  const content = document.getElementById('pm-textarea').value;
  // must have message contents
  if (content.trim() === '') {
    return;
  }

  // must have a designed recipient
  if (pmReciever === undefined) {
    return;
  }

  socket.emit('private message', {
    content,
    to: pmReciever.id,
    toName: pmReciever.username,
  });

  const toNameLower = pmReciever.username.toLowerCase();
  const msgDate = new Date().toLocaleString();

  const pm = new PrivateMessage(toNameLower, msgDate, content);
  pmMap.addPM(toNameLower, pm);

  // create the indicidual message element and append to the pm list
  const pmList = document.getElementById('pm-list');
  const pmLi = document.createElement('li');
  pmLi.classList.add('sent-pm-li');
  pmLi.innerText = `${msgDate} ${content}`;
  pmList.appendChild(pmLi);

  document.getElementById('pm-textarea').value = '';
}

/**
 * Get all PMs between the user and a specific user
 *
 * @param {string} username - show the PMs between the user and this username
 */
function showPMsListUser(username) {
  const pmList = document.getElementById('pm-list');

  // remove all the children elements from the pm list
  while (pmList.firstChild) {
    pmList.removeChild(pmList.lastChild);
  }

  const userPMs = pmMap.getPMsWithUser(username);

  if (userPMs) {
    userPMs.forEach((pmsg) => {
      const pmLi = document.createElement('li');
      pmLi.innerText = `${pmsg.date} ${pmsg.contents}`;

      // style sent messages
      if (pmsg.to !== 'You') {
        pmLi.classList.add('sent-pm-li');
      }

      pmList.appendChild(pmLi);
    });
  }
}

/**
 * Update the Pm element pertaining to the sender
 *
 * @param {*} username  - the sender of the PM
 */
function updatePmLiElement(username) {
  const usersPMList = document.getElementById('pm-users-list');

  usersPMList.childNodes.forEach((node) => {
    if (node.textContent.toLowerCase() === username) {
      node.classList.add('new-pm');
    }
  });
}

// Runs when the file selection event is emitted
const onSelectFile = () => uploadFile(fileInput.files[0]);
fileInput.addEventListener('change', onSelectFile, false);

/**
 * Fetch previous message from the room the user is currently in
 * Messages are :
 * {
        "contents": "This is a message",
        "date": "2021-02-12T22:06:19.900Z",
        "sender": "SenderOfMessage"
    }
 */
function fetchMessages() {
  const { room } = parseQSParams();
  const messagesApiUrl = `/api/messages/${room}`;
  fetch(messagesApiUrl)
    .then((response) => {
      if (!response.ok) {
        // req failed
      }
      return response.json();
    })
    .then((JSONresponse) => {
      const msgArr = [];
      JSONresponse.forEach((retMsg) => {
        // reformat the message object into the format expected for the addMsgToThread function
        const msgObj = {
          message: retMsg.contents,
          msgSendDate: Date.parse(retMsg.date),
          username: retMsg.sender,
        };
        msgArr.push(msgObj);
      });

      msgArr.forEach((msgObj) => {
        // display the message
        const li = createLiMessageElement(msgObj, false);
        msgThread.appendChild(li);

        if (!isElementHoveredOrFocused(msgThread)) {
          scrollToLatestMessage();
        }
      });
    });
}

/**
 * Filter the messages displayed in the main contents by the string provided
 *
 * @param {*} e - event or string
 */
function filterMsgSearch(e) {
  let contents;
  if (e.target) {
    contents = e.target.value;
  } else {
    contents = e;
  }

  const msgElements = document.querySelectorAll('.message');

  if (contents.trim() === '') {
    // restore display of all searched elements
    msgElements.forEach((msgEl) => {
      // eslint-disable-next-line no-param-reassign
      msgEl.style.display = 'block';
    });
    return;
  }

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < msgElements.length; i++) {
    // get the children from the individual message element
    const msgChildren = msgElements[i].childNodes;
    let usernameSpanContents;
    let msgContents;

    // messages from other users will have 4 children, the first is the 'from'
    // not present on user's own message
    if (msgChildren.length === 4) {
      usernameSpanContents = msgChildren[1].childNodes[0].data;
      msgContents = msgChildren[3].childNodes[0].data;
    } else {
      // message from user contains one less child
      usernameSpanContents = msgChildren[0].childNodes[0].data;

      if (msgChildren[2].childNodes.length === 1) {
        msgContents =
          msgChildren[2].childNodes[0].data ||
          msgChildren[2].childNodes[0].innerText;
      } else {
        // in this instance it contains both an anchor and a message
        msgChildren[2].childNodes.forEach((msgChild) => {
          // data appears for span elements
          if (msgChild.data) {
            msgContents += ` ${msgChild.data} `;
          } else {
            // otherwise just check the inner text of the anchor
            msgContents += ` ${msgChild.innerText} `;
          }
        });
      }
    }

    // display on the elements that contain the contents searched for
    if (
      usernameSpanContents.trim().includes(contents) ||
      msgContents.trim().includes(contents)
    ) {
      msgElements[i].style.display = 'block';
    } else {
      msgElements[i].style.display = 'none';
    }
  }
}

/**
 * Fetch older messages (after the most recent 10) from the database for the room
 *
 * @param {number} countOfReq  - the number of previous requests since page load
 */
function fetchOlderMessages(countOfReq) {
  // first check if the 'clear' secret has been invoked, if so, just call the default fetch messages
  if (msgThread.childNodes.length === 0) {
    fetchMessages();
    return;
  }

  // first request will skip 10, second will skip 20, and so on
  const limit = 10;
  const skipNum = countOfReq * limit;
  const { room } = parseQSParams();
  const messagesApiUrl = `/api/messages/${room}?limit=${limit}&skip=${skipNum}`;

  fetch(messagesApiUrl)
    .then((response) => {
      if (!response.ok) {
        // req failed
      }
      return response.json();
    })
    .then((JSONresponse) => {
      // collect each of the formatted messages
      const msgArr = [];
      JSONresponse.forEach((retMsg) => {
        const msgObj = {
          message: retMsg.contents,
          msgSendDate: Date.parse(retMsg.date),
          username: retMsg.sender,
        };
        msgArr.push(msgObj);
      });

      // display the messages in the correct order
      msgArr.reverse();
      msgArr.forEach((message) => {
        // display the message
        const li = createLiMessageElement(message, false);
        msgThread.prepend(li);
      });

      if (!isElementHoveredOrFocused(msgThread)) {
        scrollToEarliestMessage();
      }
    });
}

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
 * Create and return a message element
 * @param {*} message - a message object, used for creating the message element
 * @param {*} showNotification - boolean to show the notification
 */
function createLiMessageElement(message, showNotification) {
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
  const usersOwnMessage =
    message.username.toLowerCase() ===
    localStorage.getItem('username').toLowerCase();

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
    const msgSpan = document.createElement('span');
    msgSpan.classList.add('message-element-span');
    msgTokens.forEach((token, idx) => {
      if (urlIdxs.includes(idx)) {
        const anchorEl = document.createElement('a');
        anchorEl.setAttribute('href', token);
        anchorEl.setAttribute('target', '_blank');
        anchorEl.innerText = token;
        anchorElements.push(anchorEl);

        msgSpan.appendChild(anchorEl);
      } else {
        // prettier-ignore
        // eslint-disable-next-line template-curly-spacing, no-multi-spaces
        msgSpan.innerText += ` ${token} `;
      }

      li.appendChild(msgSpan);
    });
  } else {
    // in the event a token string is not a URL, we'll
    // create an additional span for the actual string message
    const msgSpan = document.createElement('span');
    msgSpan.classList.add('message-element-span');

    msgSpan.innerHTML = '';

    // determine if contains a tagged user
    const tokens = message.message.split(' ');
    tokens.forEach((token) => {
      const tagIdx = token.indexOf('@');

      if (tagIdx === -1) {
        msgSpan.innerHTML += ` ${token} `;
      } else {
        // ensure that the only tag is the first character
        if (tagIdx !== 0) {
          msgSpan.innerHTML += ` ${token} `;
          return;
        }

        if (token.slice(1).indexOf('@') !== -1) {
          msgSpan.innerHTML += ` ${token} `;
          return;
        }

        // check if the user tagged is the same as the user
        const taggedUser = token.slice(1);

        const thisUser =
          localStorage.getItem('username') || parseQSParams().username;

        if (taggedUser.toLowerCase() === thisUser.toLowerCase()) {
          // notify the user they've been tagged
          const taggedByUserStr = userNameSpan.innerText.trim();
          const taggedStr = `You've been tagged by ${taggedByUserStr}`;

          if (document.hidden) {
            displayNotification(taggedStr);
          } else {
            showUserToast(taggedStr);
          }
          // eslint-disable-next-line quotes
          msgSpan.innerHTML += ` <span class="user-tag">${token}</span> `;
          return;
        }

        // check if the tagged user is a valid user (in the chat)
        const usernameNodes = document.getElementById('users-list').childNodes;
        const currentUsernames = [];

        // collect each user currently in the room
        usernameNodes.forEach((node) => {
          // the text node will not have a child node; each li will (a text node)
          if (node.innerText) {
            // easiest to ignore case
            currentUsernames.push(node.innerText.toLowerCase());
          }
        });

        // if not a valid user, don't bother styling it in any specific manner
        if (!currentUsernames.includes(taggedUser.toLowerCase())) {
          msgSpan.innerHTML += ` ${token} `;
        }

        // edge case, to avoid an empty element
        if (msgSpan.innerHTML.length === 0) {
          msgSpan.innerHTML += ` ${token} `;
        }
      }
    });

    // msgSpan.innerText = `${message.message}`;
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

  // on mouseout, restore the elements' appearance
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

  // show a user a notification
  if (!usersOwnMessage && showNotification) {
    displayNotification(`${message.username} said ${message.message}`);
  }

  return li;
}

/**
 * Scroll the view of messages to the latest message
 * Used on update when a new message arrives
 */
function scrollToLatestMessage() {
  const messages = document.getElementsByClassName('message');
  messages[messages.length - 1].scrollIntoView({
    block: 'end',
    behavior: 'smooth',
  });
}

/**
 * Scroll to the earliest message in the thread
 * Used when fetching older messages
 */
function scrollToEarliestMessage() {
  const messages = document.getElementsByClassName('message');
  messages[0].scrollIntoView({
    block: 'end',
    behavior: 'smooth',
  });
}

msgBtn.addEventListener('click', () => {
  // make sure a message is present
  const msgStr = msgInput.value.trim();
  if (msgStr === '') {
    return;
  }
  sendMessage(msgStr);
});

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

// event listener for the fetch old messages
fetchOldMessagesBtn.addEventListener('click', () => {
  ++olderMessagesReqCount;
  fetchOlderMessages(olderMessagesReqCount);
});

// event listener for filtering messages
filterMsgsInput.addEventListener('input', (e) => {
  filterMsgSearch(e);
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

// do the same for the PM input
document.getElementById('pm-textarea').addEventListener('keypress', (e) => {
  const { key } = e;
  if (key === 'Enter' && pmReciever) {
    // send PM
    // validation occurs within the sendPM function, so we'll just hand that off here
    sendPM();
  }
});

// Event handler for the sending of PMs
document.getElementById('pm-send-button').addEventListener('click', () => {
  sendPM();
});

/**
 * append individual messages to the message thread, used when a message is recieved
 * @param {*} message
 */
function addMsgToThread(message) {
  const li = createLiMessageElement(message, true);
  msgThread.appendChild(li);

  // once the message is added to the DOM, scroll to the latest
  // don't if the message thread is hovered or focused
  if (!isElementHoveredOrFocused(msgThread)) {
    scrollToLatestMessage();
  }
}

/**
 *  Display the other users currently in the room for both the PM li elements
 * and the user element displaying the room's current users
 *
 * @param {*} usersArr - array containing the other users in the room
 */
function addUserToUserList(usersArr) {
  const usernamesArr = usersArr.reduce(
    // eslint-disable-next-line no-sequences
    (usernames, user) => (usernames.push(user.username), usernames),
    [],
  );

  let username;
  // check localstorage first
  if (localStorage.getItem('username') === null) {
    // we can check the query string
    username = parseQSParams().username;
  } else {
    username = localStorage.getItem('username');
  }

  const usersIndex = usernamesArr.indexOf(username.toLowerCase());
  // sanity check
  if (usersIndex > -1) {
    // remove the user from the arr
    usernamesArr.splice(usersIndex, 1);
  }

  // suppose we'll also have an element for the user themselves
  usernamesArr.push('You');

  const usersList = document.getElementById('users-list');
  const currentUserLis = [];

  usersList.childNodes.forEach((li) => {
    currentUserLis.push(li.innerText);
  });

  // add to the pm users list
  const pmUsersList = document.getElementById('pm-users-list');

  usernamesArr.forEach((userStr) => {
    // avoid appending users that are already in the DOM
    if (currentUserLis.includes(userStr)) {
      return;
    }

    // create elements for each list
    const userLi = document.createElement('li');

    userLi.innerText = userStr;
    userLi.addEventListener('click', () => {
      const userNameStr = userLi.innerText;

      if (filterMsgsInput.value === userNameStr) {
        filterMsgsInput.value = '';
        // restore the state to show all messages
        filterMsgSearch('');
      } else {
        filterMsgsInput.value = userNameStr;
        filterMsgSearch(userNameStr);
      }
    });

    usersList.appendChild(userLi);

    if (userStr === 'You') {
      return;
    }

    // otherwise add to the PM elements
    const userPmLi = document.createElement('li');
    userPmLi.innerText = userStr;

    // click handler for each username li element
    userPmLi.addEventListener('click', () => {
      const pmList = document.getElementById('pm-list');

      pmList.style.visibility = 'visible';
      userPmLi.classList.remove('new-pm');

      // toggle this as selected
      userPmLi.classList.add('selected-user-pm');

      // change the button to reflect the state of the user that the
      // PM will be sent to
      const sendPMButton = document.getElementById('pm-send-button');
      sendPMButton.innerText = `PM ${userStr}`;

      const usernameToSend = userPmLi.textContent;
      setPMReciever(usernameToSend);
      showPMsListUser(usernameToSend);

      pmUsersList.childNodes.forEach((node) => {
        if (node === userPmLi || node.nodeName === '#text') {
          return;
        }
        node.classList.remove('selected-user-pm');
      });
    }); // end click handler

    pmUsersList.appendChild(userPmLi);
  });
}

// for debugging during development only
socket.onAny((event, ...args) => {
  console.log(event, args);
});

// receive the client count when the server updates
socket.on('clientCount', (message) => {
  const msgNum = Number(message);
  clientCountMsg.innerText =
    message > 1 ? `${msgNum} users currently` : 'You are the only user';
});

// recv's an array of usernames for the current room
socket.on('currentRoomUsers', (usersArr) => {
  updateUsersArr(usersArr);
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

// recvs a broadcast when a new connection is detected server-side.
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
  // we'll just get the first token from the message (that's the username of the client that left)
  const usernameToRemove = message.split(' ')[0];
  const usersList = document.getElementById('users-list');
  const pmUsersList = document.getElementById('pm-users-list');

  usersList.childNodes.forEach((node) => {
    // skip the text node
    if (!node.innerText) {
      return;
    }

    if (node.innerText.includes(usernameToRemove)) {
      usersList.removeChild(node);
    }
  });

  // repeat for the PM users list
  pmUsersList.childNodes.forEach((node) => {
    if (node.textContent.includes(usernameToRemove)) {
      pmUsersList.removeChild(node);
    }
  });

  if (document.hidden) {
    displayNotification(message);
  } else {
    showUserToast(message);
  }
});

// store the PM when recv'd
socket.on('private message', (pm) => {
  const fromNameLower = pm.fromName.toLowerCase();

  const pmsg = {
    content: pm.content,
    date: new Date().toLocaleString(),
  };

  const privMsg = new PrivateMessage('You', pmsg.date, pmsg.content);
  pmMap.addPM(fromNameLower, privMsg);

  const message = `PM from ${pm.fromName}`;
  // add the corresponding class
  updatePmLiElement(fromNameLower);

  if (document.hidden) {
    displayNotification(message);
  } else {
    showUserToast(message);
  }

  // if the currently selected PM user is the user that sent the
  // PM, update the PM list when recieved
  if (pmReciever.username === fromNameLower) {
    const pmList = document.getElementById('pm-list');
    const pmLi = document.createElement('li');
    pmLi.innerText = `${pmsg.date} ${pmsg.content}`;
    pmList.appendChild(pmLi);
  }
});

// emit a join event to the server with the username and room
// we'll also store the User's name in localstorage, and should change the DOM
// elements to reflect that
socket.emit('join', parseQSParams(), (error) => {
  setTimeout(() => {
    fetchMessages();
    fetchOldMessagesBtn.style.visibility = 'visible';
    filterMsgsInput.style.visibility = 'visible';
  }, 1200);

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

// keybinding iife
// eslint-disable-next-line wrap-iife
(function () {
  const secretCommand = 'clear';
  let offset = 0;

  document.onkeypress = (event) => {
    // eslint-disable-next-line no-underscore-dangle
    const _event = event || window.event;
    const eventCharCode = _event.charCode;

    // find the location of the input event (here, either global or the text area)
    const eventNodeType = _event.target.nodeName.toUpperCase();

    // if the event fires on the text input area, return
    if (
      eventCharCode === 0 ||
      eventNodeType === 'TEXTAREA' ||
      eventNodeType === 'INPUT'
    ) {
      return;
    }

    if (eventCharCode === 120) {
      const isFullScreen =
        (document.fullScreenElement && document.fullScreenElement !== null) ||
        document.mozFullScreen ||
        document.webkitIsFullScreen;

      let supportedMethod;

      // exit fullscreen if set
      if (isFullScreen) {
        supportedMethod =
          document.cancelFullScreen ||
          document.webkitCancelFullScreen ||
          document.mozCancelFullScreen ||
          document.exitFullscreen ||
          document.webkitExitFullscreen;

        if (supportedMethod) {
          supportedMethod.call(document);
        }
      } else {
        // enter full screen
        supportedMethod =
          document.body.requestFullScreen ||
          document.body.webkitRequestFullScreen ||
          document.body.mozRequestFullScreen ||
          document.body.msRequestFullScreen;

        if (supportedMethod) {
          supportedMethod.call(document.body);
        }
      }

      return;
    }

    if (eventCharCode === 102) {
      // focus on the 'filter messages element'
      document.getElementById('filter-messages').focus();
      return;
    }

    if (eventCharCode === 112) {
      // toggle the visibility of the PM ui
      document.getElementById('pm-div').classList.toggle('hidden');
      return;
    }

    if (eventCharCode === 115) {
      // open the file upload prompt with 's' (click the file input element)
      document.getElementById('file-upload-input').click();
      return;
    }

    if (eventCharCode === 116) {
      // scroll the messages thread to the top for 't'
      scrollToEarliestMessage();
      return;
    }

    if (eventCharCode === 98) {
      // scroll to bottom messages for 'b'
      scrollToLatestMessage();
      return;
    }

    // vi style, j for down, k for up
    // we'll scroll down by the approximate size of a child element
    if (eventCharCode === 106) {
      if (msgThread.childNodes.length > 0) {
        // make sure there are even children
        const verticalScrollHeight = msgThread.childNodes[0].offsetHeight;
        msgThread.scrollBy(0, -verticalScrollHeight);
      } else {
        return;
      }
    }

    if (eventCharCode === 107) {
      if (msgThread.childNodes.length > 0) {
        // make sure there are even children
        const verticalScrollHeight = msgThread.childNodes[0].offsetHeight;
        msgThread.scrollBy(0, verticalScrollHeight);
      } else {
        return;
      }
    }

    if (eventCharCode === 109) {
      // focus on messages
      msgInput.focus();
      return;
    }

    if (eventCharCode !== secretCommand.charCodeAt(offset)) {
      // reset the index into the string
      offset = eventCharCode === secretCommand.charCodeAt(0) ? 1 : 0;
    } else if (offset < secretCommand.length - 1) {
      // correct input; increment
      offset++;
    } else {
      // correct, remove all children and reset the state
      while (msgThread.firstChild) {
        msgThread.removeChild(msgThread.lastChild);
      }
      offset = 0;
      olderMessagesReqCount = 0;
    }
  };
})();

/**
 * Set the addition parameters on the socket when the user joins
 * the room. Get the room name and the username from the QS params
 */
window.onload = function init() {
  const userObj = parseQSParams();
  socket.auth = { username: userObj.username, room: userObj.room };
  socket.connect();

  // set the click handler on the pm display button
  const pmToggleButton = document.getElementById('pm-display-button');
  pmToggleButton.addEventListener('click', () => {
    document.getElementById('pm-div').classList.toggle('hidden');
  });
};
