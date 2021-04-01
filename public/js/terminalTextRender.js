/* eslint-disable no-plusplus */
/**
 * IIFE for the typewriter/terminal typing effect on the element showing
 * room name
 */
(() => {
  let counter = 0;
  // get the room from the query string parameters
  const roomName = window.location.search.split('&')[1].split('=')[1];
  const message = `Welcome to ${roomName}`;
  const typeWriterEl = document.getElementById('main-header');
  const inputTextArea = document.getElementById('message-text');

  // make the input element size 75% of the message thread
  inputTextArea.style.height = `${
    document.getElementById('message-thread').clientHeight * 0.75
  }px`;

  const durationBetChar = 100;
  const terminalTextRender = () => {
    const currentChar = message.charAt(counter);
    if (counter < message.length) {
      typeWriterEl.innerHTML += currentChar;
      ++counter;
      // add the next character every 100ms until each character
      // is present
      setTimeout(terminalTextRender, durationBetChar);
    }
  };

  setTimeout(terminalTextRender, 1100);
})();

// toggle the visibility of the cursor at a fixed interval to
// provide the appearance of a blinking cursor
(() => {
  const consoleCursor = document.getElementById('console-cursor');
  let visible = true;
  setInterval(() => {
    if (visible === true) {
      consoleCursor.className = 'console-underscore hidden';
      visible = false;
    } else {
      consoleCursor.className = 'console-underscore';
      visible = true;
    }
  }, 400);
})();
