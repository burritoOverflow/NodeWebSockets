/* eslint-disable no-plusplus */
/**
 * IIFE for the typewriter/terminal typing effect on the element showing
 * room name
 */
(() => {
  let counter = 0;
  // get the room from the query string parameters
  const message = `Welcome to ${
    window.location.search.split('&')[1].split('=')[1]
  }`;
  const typeWriterEl = document.getElementById('main-header');
  const inputTextArea = document.getElementById('message-text');

  inputTextArea.style.height = `${
    document.getElementById('message-thread').clientHeight * 0.75
  }px`;

  const durationBetChar = 100;

  const terminalTextRender = () => {
    const currentChar = message.charAt(counter);

    if (counter < message.length) {
      typeWriterEl.innerHTML += currentChar;
      ++counter;
      // dynamically resize the textarea to correspond to
      // the growth of the header area

      setTimeout(terminalTextRender, durationBetChar);
    }
  };

  setTimeout(terminalTextRender, 1100);
})();

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
