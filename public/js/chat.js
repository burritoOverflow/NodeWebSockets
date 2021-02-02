const socket = io();

const msgInput = document.getElementById("message-text");
const msgBtn = document.getElementById("submit-button");
const sendLocButton = document.getElementById("share-location-button");
const clientCountMsg = document.getElementById("received-message");
const msgThread = document.getElementById("message-thread");

msgBtn.addEventListener("click", () => {
  // make sure a message is present
  const msgStr = msgInput.value.trim();
  if (msgStr == "") {
    return;
  } else {
    sendMessage(msgStr);
  }
});

/**
 * Parse the query string parameters for the room and the user name
 * Return an object containing those
 * @param {string} querystring
 */
function parseQSParams(querystring) {
  const queryStr = location.search;
  const qsParameters = queryStr.split("&");
  return {
    username: qsParameters[0].split("=")[1],
    room: qsParameters[1].split("=")[1],
  };
}

// event handler for the send location button
sendLocButton.addEventListener("click", () => {
  sendLocButton.disabled = true;
  sendLocButton.classList.add("blurry-text");

  if (!navigator.geolocation) {
    // no geolocation available
    return alert("geolocation is not available");
  }

  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    const latLng = {
      latitude: latitude,
      longitude: longitude,
    };
    socket.emit("userLocation", latLng, (serverAckMessage) => {
      showUserToast(serverAckMessage);
      sendLocButton.enabled = true;
    });
  });
});

// allow for enter key in the text input to send a message
msgInput.addEventListener("keypress", (e) => {
  const key = e.key;
  if (key === "Enter") {
    const msgStr = msgInput.value.trim();
    if (msgStr !== "") {
      sendMessage(msgStr);
    }
  }
});

/**
 * append individual messages to the message thread
 * @param {*} message
 */
function addMsgToThread(message) {
  const li = document.createElement("li");
  li.classList.add("message");

  const msgTokens = message.message.split(" ");

  let containsURL = false;
  let urlIdxs = [];

  let anchorElements = [];

  msgTokens.forEach((token, idx) => {
    if (isValidHttpUrl(token)) {
      urlIdxs.push(idx);
      containsURL = true;
    }
  });

  // create the spans for the user name the date of the message
  const userNameSpan = document.createElement("span");
  userNameSpan.innerText = `${message.username} `;
  userNameSpan.classList.add("username-span");

  const dateSpan = document.createElement("span");
  dateSpan.innerText = ` on ${new Date(message.msgSendDate)
    .toLocaleString()
    .replace(",", " at")} `;
  dateSpan.classList.add("date-span");

  li.innerText = "From ";
  li.appendChild(userNameSpan);
  li.appendChild(dateSpan);

  // if the message sent contains a url
  if (containsURL) {
    msgTokens.forEach((token, idx) => {
      if (urlIdxs.includes(idx)) {
        const anchorEl = document.createElement("a");
        anchorEl.setAttribute("href", token);
        anchorEl.setAttribute("target", "_blank");
        anchorEl.innerText = token;
        anchorElements.push(anchorEl);

        li.appendChild(anchorEl);
      } else {
        li.innerText += token + " ";
      }
    });
  } else {
    // in the event a token string is not a URL, we'll
    // create an additional span for the actual string message
    const msgSpan = document.createElement("span");
    msgSpan.classList.add("message-element-span");
    msgSpan.innerText = `${message.message}`;
    li.appendChild(msgSpan);
  }

  // dynamically change the style on hover events
  li.addEventListener("mouseover", (e) => {
    msgThread.style.backgroundColor = "black";
    document.querySelectorAll(".message").forEach((msgEl) => {
      if (msgEl !== li) {
        msgEl.classList.add("blurry-text");
      }
    });
  });

  li.addEventListener("mouseout", (e) => {
    msgThread.style.backgroundColor = "#18181b";
    document.querySelectorAll(".message").forEach((msgEl) => {
      if (msgEl !== li) {
        msgEl.style.opacity = 1.0;
        msgEl.classList.remove("blurry-text");
      }
    });
  });

  msgThread.appendChild(li);
}

/**
 * determine if valid http(s) url
 * @param {*} string
 */
function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Show the user a toast containing the string argument
 * @param {*} message - the string contents of the toast
 */
function showUserToast(message) {
  const snackbar = document.getElementById("snackbar");
  snackbar.innerText = message;
  snackbar.classList.add("show");
  setTimeout(() => {
    snackbar.classList.remove("show");
  }, 2000);
}

// receive the client count when the server updates
socket.on("clientCount", (message) => {
  message = Number(message);
  clientCountMsg.innerText =
    message > 1 ? `${message} users currently` : "You are the only user";
});

socket.on("chatMessage", (message) => {
  addMsgToThread(message);
});

// server emits tweak event when a special message is detected
socket.on("tweak", (messageObj) => {
  const { type } = messageObj;
  switch (type) {
    case "bright":
      document.body.classList.add("bright");
      document.getElementById("message-thread").classList.add("bright");
      document.getElementById("message-text").classList.add("bright");
      break;
    case "dark":
      document.body.classList.remove("bright");
      document.getElementById("message-thread").classList.remove("bright");
      document.getElementById("message-text").classList.remove("bright");
      break;
    case "slidedown":
      document.getElementById("message-thread").classList.add("slide-down");
      document.getElementById("message-text").classList.add("slide-down");
    default:
      break;
  }
});

// recvs a broadcast when a connection is detected server-side.
// add this message in a seperate fashion
socket.on("newUserMessage", (message) => {
  showUserToast(message);
});

// display the toast when a client leaves
socket.on("userLeft", (message) => {
  showUserToast(message);
});

/**
 * Emit the message to connected clients
 * @param {*} message - The string contents from the input element
 */
function sendMessage(message) {
  const msgObj = { message: message, msgSendDate: +new Date() };
  socket.emit("clientChat", msgObj, (serverMsg) => {
    showUserToast(serverMsg);
  });
  // remove text from the element
  msgInput.value = "";
}

// emit a join event to the server with the username and room
socket.emit("join", parseQSParams(), (error) => {
  const { room } = parseQSParams();
  if (error) {
    location.href = "/";
    // TODO handle the toast on login, perhaps
    showUserToast(`Failed to join ${room}`);
  } else {
    showUserToast(`You joined ${room}!`);
  }
});
