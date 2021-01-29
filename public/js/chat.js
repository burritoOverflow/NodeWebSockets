const socket = io();

const msgInput = document.getElementById("message-text");
const msgBtn = document.getElementById("submit-button");
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

// append individual messages to the list
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

  if (containsURL) {
    li.innerText = `${new Date(message.msgSendDate)
      .toLocaleString()
      .replace(",", " at")} `;

    msgTokens.forEach((token, idx) => {
      if (urlIdxs.includes(idx)) {
        const anchorEl = document.createElement("a");
        anchorEl.setAttribute("href", token);
        anchorEl.innerText = token;
        anchorElements.push(anchorEl);

        li.appendChild(anchorEl);
      } else {
        li.innerText += token + " ";
      }
    });
  } else {
    const msgText = `${new Date(message.msgSendDate)
      .toLocaleString()
      .replace(",", " at")} ${message.message}`;
    li.innerText = msgText;
  }

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

// determine if valid http url
function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

// receive the client count when the server updates
socket.on("clientCount", (message) => {
  clientCountMsg.innerText = message;
});

socket.on("chatMessage", (message) => {
  addMsgToThread(message);
});

// send the message from the input element
function sendMessage(message) {
  const msgObj = { message: message, msgSendDate: +new Date() };
  socket.emit("clientChat", msgObj);
  // remove text from the element
  msgInput.value = "";
}
