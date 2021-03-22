/* eslint-disable import/extensions */
/* eslint-disable no-plusplus */
import PrivateMessage from './PrivateMessage.js';
import PrivateMessageMap from './PrivateMessageMap.js';
import {
  parseQSParams,
  isValidHttpUrl,
  isElementHoveredOrFocused,
  displayNotification,
  determineIfDelayedMessage,
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

// store the room's admin; this will be used on init and on users joining
let adminName;

// for this user
let thisUserAdmin = false;

// store an object containing pms from each user
const pmMap = new PrivateMessageMap();

// state of the focused mode
let inFocusMode = false;

/**
 *
 * @param {*} usersObjArr - array of user objects (sids and usernames)
 */
function updateUsersArr(usersObjArr) {
  // reset the state of the users arr
  currentUsersArr = [];

  // get this user's username
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
 *  Toggle the display mode from focused
 */
function toggleDisplayFocusMode() {
  const headingEl = document.getElementById('heading');
  const activeUserList = document.getElementById('active-users-list');
  const btnContainer = document.getElementById('button-div');
  const dropdownMain = document.getElementById('dropdown');
  const pmDisplayBtn = document.getElementById('pm-display-button');

  const elementsToToggleDisplay = [
    headingEl,
    activeUserList,
    btnContainer,
    dropdownMain,
    pmDisplayBtn,
  ];

  // toggle the display width
  elementsToToggleDisplay.forEach((element) => {
    if (!inFocusMode) {
      element.classList.add('no-display');
    } else {
      element.classList.remove('no-display');
    }
  });

  // get the grey color property
  const darkGrey = getComputedStyle(document.documentElement).getPropertyValue(
    '--backgroundColor',
  );

  const blackStr = 'black';

  // enter focus mode
  if (!inFocusMode) {
    // change the grid layout for both the message element and the
    // message thread
    // use all of the grid rows
    msgThread.style.gridRow = '1/5';
    msgInput.style.height = '89%';

    // let's make the background for the input the same as the background color

    msgInput.style.backgroundColor = darkGrey;

    document.getElementsByTagName('body')[0].style.backgroundColor = blackStr;
    document.getElementsByTagName('html')[0].style.backgroundColor = blackStr;
  } else {
    // exit focus mode
    msgInput.style.width = '83%';

    // make the input about 2/3 the height of the thread
    const msgThreadHeight = window.getComputedStyle(msgThread).height;

    // returns a string of the height in pixels; we don't need the 'px'
    const heightVal = Number(
      msgThreadHeight.slice(0, msgThreadHeight.length - 3),
    );

    // now we'll set the height to this value
    msgInput.style.height = `${heightVal * 0.72}px`;

    // restore the default grid row orientation
    msgThread.style.gridRow = '2/5';

    // restore the original color
    document.getElementsByTagName('body')[0].style.backgroundColor = darkGrey;
    document.getElementsByTagName('html')[0].style.backgroundColor = darkGrey;
    msgInput.style.backgroundColor = blackStr;
  }

  inFocusMode = !inFocusMode;
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
 *  Send the user selected file to the API
 *
 * @param {*} file the file the user is uploading
 */
function uploadFile(file) {
  const data = new FormData();
  data.append('upload', file);

  fetch('/api/messages/file', {
    method: 'POST',
    body: data,
  })
    // response is JSON, so convert
    .then((response) => response.json())
    .then(
      (resJSON) => {
        if (resJSON.error) {
          showUserToast(resJSON.error);
        } else {
          const userMessage = `shared ${resJSON.originalName} : ${resJSON.url}`;
          sendMessage(userMessage);
        }
        // clear the selection from the input
        fileInput.value = '';
      }, // Handle the success response object
    )
    .catch(
      (error) => console.log(error), // Handle the error response object
    );
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
 * @param {number} countOfReq  - the number of previous requests since page load--used for the num
 * of previous messages to skip (in intervals of 10)
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

      // we'll scroll to the earliest regardless of the state
      scrollToEarliestMessage();
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
 * Emit the message to connected clients.
 *
 * @param {*} message - The string contents from the input element
 */
function sendMessage(message) {
  const msgObj = { message, msgSendDate: +new Date() };
  // callback is invoked when profanity is detected
  socket.emit('clientChat', msgObj, (serverMsg) => {
    showUserToast(serverMsg);
  });
}

/**
 * Handles both the cleanup of the message and the sending delay
 *
 * @param {*} message - message to send, from the user input
 */
function sendDelayedMessage(message) {
  // first, prune the message; we already know it's valid
  const msgTokens = message.split(' ');

  // convert to seconds; default is ms
  const delay = parseInt(msgTokens[1], 10) * 1000;

  // recreate a string excluding the first token (verb) and the second (delay)
  const finalMessage = msgTokens.slice(2).join(' ');

  showUserToast(`Your message will be sent in ${msgTokens[1]} seconds`);

  setTimeout(() => {
    sendMessage(finalMessage);
  }, delay);
}

/**
 * Create and return a message element
 *
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
        // no tag index found
        msgSpan.innerHTML += ` ${token} `;
      } else {
        // ensure that the only tag is the first character
        if (tagIdx !== 0) {
          msgSpan.innerHTML += ` ${token} `;
          return;
        }

        // mulitple tokens
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
            currentUsernames.push(node.innerText.trim().toLowerCase());
          }
        });

        // if not a valid user, don't bother styling it in any specific manner
        if (!currentUsernames.includes(taggedUser.toLowerCase())) {
          msgSpan.innerHTML += ` ${token} `;
        } else {
          msgSpan.innerHTML += ` <span class="user-tag">${token}</span> `;
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

  // Initial right click to create quoted message
  li.oncontextmenu = (event) => {
    event.preventDefault();
    // quote the message and add it as the text field input
    const quotedMsg = makeQuotedMessage(li);
    document.getElementById('message-text').value = `${quotedMsg} \n\n`;
  };

  // show a user a notification
  if (!usersOwnMessage && showNotification) {
    displayNotification(`${message.username} said ${message.message}`);
  }

  return li;
}

/**
 * Build and return quote string for replies
 *
 * @param {HTMLElement} messageElement - the message li element
 * @returns - string containing the quoted message
 */
function makeQuotedMessage(messageElement) {
  let messageUsername;
  let messageContents;
  const msgElChildren = messageElement.childNodes;

  msgElChildren.forEach((childElement) => {
    // if it has the class for username
    // text element
    if (!childElement.classList) {
      return;
    }

    if (childElement.classList[0] === 'username-span') {
      // if it's not the own user's message, we'll tag the user later, so keep the username
      const msgSenderUsername = childElement.innerText.trim();
      // otherwise don't bother
      if (msgSenderUsername !== 'You') {
        messageUsername = childElement.innerText.trim();
      }
    }

    // get the message contents (trimmed)
    if (childElement.classList[0] === 'message-element-span') {
      messageContents = childElement.innerText.trim();
    }
  });

  let quoteStr;
  if (messageUsername) {
    quoteStr = `Reply to @${messageUsername} '${messageContents}': `;
  } else {
    // add to the user's previous message
    quoteStr = `Adding to previous message '${messageContents}'`;
  }
  return quoteStr;
}

/**
 * Get the admin username for the current room
 *
 * @param {string} roomName - the current room name
 */
function getAdminNameForRoom(roomName) {
  const adminNameUrl = `/api/room/admin/${roomName}`;
  return fetch(adminNameUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
    .then((response) => response.json())
    .then((jsonRes) => {
      if (jsonRes.admin !== 'none') {
        // the room has an admin
        return jsonRes.admin;
      }
      // no admin
      return 'none';
    })
    .catch((error) => {
      console.error(error);
    });
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

  if (determineIfDelayedMessage(msgStr)) {
    sendDelayedMessage(msgStr);
  } else {
    sendMessage(msgStr);
  }

  // clear the input after send
  msgInput.value = '';

  // restore default color when appropriate
  msgInput.style.color = getComputedStyle(
    document.documentElement,
  ).getPropertyValue('--primaryColor');
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
      if (determineIfDelayedMessage(msgStr)) {
        sendDelayedMessage(msgStr);
      } else {
        sendMessage(msgStr);
      }

      // clear the message that was sent
      msgInput.value = '';

      // restore the default color
      msgInput.style.color = getComputedStyle(
        document.documentElement,
      ).getPropertyValue('--primaryColor');
    }
  }
  // entered a space
  if (key === ' ') {
    const enteredTokens = msgInput.value.trim().split(' ');

    // modify the styling if the first token is for an expiring message
    if (enteredTokens[0] === '/explode' || enteredTokens[0] === '/expire') {
      msgInput.style.color = 'red';
    } else {
      const primaryColorHex = getComputedStyle(
        document.documentElement,
      ).getPropertyValue('--primaryColor');
      msgInput.style.color = primaryColorHex;
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
 *
 * @param {*} message
 */
function addMsgToThread(message) {
  const li = createLiMessageElement(message, true);
  msgThread.appendChild(li);

  li.childNodes.forEach((node) => {
    if (node.classList && node.classList.contains('username-span')) {
      // get the username
      const username = node.innerText.trim();
      // get the username and update the corresponding element in the user's list's span
      document.getElementById('users-list').childNodes.forEach((child) => {
        // exit on the text element
        if (!child.innerText) {
          return;
        }

        // found the matching element
        if (username === child.innerText.trim()) {
          // same so update the data element with the latest timestamp
          const timeNow = +new Date();
          // eslint-disable-next-line no-param-reassign
          child.dataset.lastSeenTime = timeNow;
        }
      });
    }
  });

  // once the message is added to the DOM, scroll to the latest
  // don't if the message thread is hovered or focused
  if (!isElementHoveredOrFocused(msgThread)) {
    scrollToLatestMessage();
  }

  return li;
}

/**
 * Invoked on the chatMessage event. Style the element appropriately if an expiring message
 *
 * @param {string} message - the message contents
 */
function chatMessageReceived(message) {
  // create the list element from the message
  const createdLi = addMsgToThread(message);

  // set the message to expire according to the duration, where applicable
  // and style appropriately
  if (message.expireDuration) {
    createdLi.classList.add('expire-msg');

    createdLi.childNodes.forEach((child) => {
      if (!child.classList) {
        return;
      }

      // ignore the date element
      if (!child.classList.contains('date-span')) {
        child.style.backgroundColor = 'white';
      } else {
        // former date element
        const secondsExpire = Number(message.expireDuration) / 1000;
        child.innerText = `Remains for: ${secondsExpire}`;

        // update the remaining time on the message once per second
        setInterval(() => {
          let updateTime = Number(child.innerText.split(' ')[2]);
          --updateTime;
          // eslint-disable-next-line no-param-reassign
          child.innerText = `Remains for: ${updateTime}`;
        }, 1000);
      }
    });

    // remove the message from the dom based on the expiration timer
    setTimeout(() => {
      createdLi.remove();
    }, Number(message.expireDuration));
  } // not an expiring message
}

/**
 * Handler for the userLeft event
 *
 * @param {string} message - the message to display when a user leaves
 */
function userLeftHandler(message) {
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
}

/**
 *  Display the other users currently in the room for both the PM li elements
 *  and the user element displaying the room's current users
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
    // create a timestamp
    userLi.dataset.lastSeenTime = +new Date();
    userLi.dataset.username = userStr;

    // always check case insensitivity
    if (userStr === adminName) {
      userLi.classList.add('admin-user-li');
    }

    // click handler for each li element
    userLi.addEventListener('click', () => {
      // considering the added tooltip on hover, we only need the
      // text content for the first child node
      const userNameStr = userLi.childNodes[0].data.trim();

      // toggle back to the empty string state on subsequent
      // click
      if (filterMsgsInput.value === userNameStr) {
        filterMsgsInput.value = '';
        // restore the state to show all messages
        filterMsgSearch('');
      } else {
        // default state: populate empty element with the
        // username string
        filterMsgsInput.value = userNameStr;
        filterMsgSearch(userNameStr);
      }
    });

    userLi.addEventListener('mouseenter', () => {
      const tooltip = document.createElement('p');
      tooltip.classList.add('active-tooltip');
      // calculate the difference
      const timeNow = +new Date();
      const timeSince = timeNow - userLi.dataset.lastSeenTime;
      const elapsedTime = timeSince / 1000 / 60;

      const minutesStr = Math.floor(elapsedTime);
      if (minutesStr === 0) {
        tooltip.innerText = 'Last Seen: Just Now';
      } else if (minutesStr === 1) {
        tooltip.innerText = `Last Seen: ${minutesStr} minute ago`;
      } else {
        tooltip.innerText = `Last Seen: ${minutesStr} minutes ago`;
      }

      userLi.appendChild(tooltip);
    });

    userLi.addEventListener('mouseleave', () => {
      // remove the child(ren) node (tooltip) there's only one
      userLi.textContent = userLi.dataset.username;
    });

    usersList.appendChild(userLi);

    if (userStr === 'You') {
      if (thisUserAdmin) {
        userLi.classList.add('admin-user-li');
      }
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
socket.on('chatMessage', (message) => chatMessageReceived(message));

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
  userLeftHandler(message);
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
    showUserToast(`Failed to join ${room}`);
  } else {
    showUserToast(`You joined ${room}!`);
    // NOTE: this will blow away the previous username stored
    // this probably isn't a problem, but it's best to check
    localStorage.setItem('username', username);
  }
});

/**
 * Set the initial keybindings for interaction with the UI
 */
function setKeybindings() {
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
      // focus on the 'filter messages element' with 'f'
      event.preventDefault();
      const filterMessEl = document.getElementById('filter-messages');
      filterMessEl.focus();
      return;
    }

    if (eventCharCode === 112) {
      // toggle the visibility of the PM ui
      document.getElementById('pm-div').classList.toggle('hidden');
      return;
    }

    if (eventCharCode === 113) {
      // 'q' for toggle focus mode
      toggleDisplayFocusMode();
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
      event.preventDefault();
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
}

/**
 * Set the addition parameters on the socket when the user joins
 * the room. Get the room name and the username from the QS params
 */
window.onload = function init() {
  const userObj = parseQSParams();
  socket.auth = { username: userObj.username, room: userObj.room };
  socket.connect();

  // set the accent color if the user has one saved
  const colorChoice = localStorage.getItem('colorChoice');

  if (colorChoice) {
    // if user has stored choice, set the style accordingly
    document.documentElement.style.setProperty('--primaryColor', colorChoice);
    const snackBar = document.getElementById('snackbar');
    snackBar.style.backgroundColor = colorChoice;
  }

  // set the click handler on the pm display button
  const pmToggleButton = document.getElementById('pm-display-button');
  pmToggleButton.addEventListener('click', () => {
    document.getElementById('pm-div').classList.toggle('hidden');
  });

  // add event listeners for each of the dropdown color options
  const dropdown = document.getElementsByClassName('dropdown-content')[0];
  const choiceStr = 'Choice';

  // skip the first child; it's the button
  for (let i = 1; i < dropdown.childNodes.length; i += 2) {
    // add a click handler to each
    dropdown.childNodes[i].addEventListener('click', (e) => {
      e.preventDefault();
      const textColorChoice =
        dropdown.childNodes[i].innerText.toLowerCase() + choiceStr;

      const colorHex = getComputedStyle(
        document.documentElement,
      ).getPropertyValue(`--${textColorChoice}`);

      document.documentElement.style.setProperty('--primaryColor', colorHex);

      // we also need to set the snackbar color
      const snackBar = document.getElementById('snackbar');
      snackBar.style.backgroundColor = colorHex;

      // set the selection in the user's localstorage
      localStorage.setItem('colorChoice', colorHex);
    });
  }

  // Runs when the file selection event is emitted
  const onSelectFile = () => uploadFile(fileInput.files[0]);
  fileInput.addEventListener('change', onSelectFile, false);

  // last, we'll set up the keybindings
  setKeybindings();

  // and check if the room has an admin
  const { room, username } = parseQSParams();
  getAdminNameForRoom(room).then((res) => {
    if (res === 'none') {
      // no admin; nothing to do here
      return;
    }

    // set the admin's name
    adminName = res;

    console.log(adminName);

    if (adminName.toLowerCase() === username.toLowerCase()) {
      // we're looking for the 'You' element
      thisUserAdmin = true;
    }

    // check for the admin in the room; apply the style if so
    document.getElementById('users-list').childNodes.forEach((element) => {
      if (!element.innerText) {
        return;
      }

      // check if the element is the admin username
      if (element.innerText === adminName.toLowerCase()) {
        // add the class where appropriate
        element.classList.add('admin-user-li');
      }

      // style the 'You' element if this user is the admin
      if (element.innerText === 'You' && thisUserAdmin) {
        element.classList.add('admin-user-li');
      }
    });
  });
};
