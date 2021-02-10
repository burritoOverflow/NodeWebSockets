/* eslint-disable no-console */
/**
 * Fetch data from the 'rooms' route and
 * display it on the main page: {count} in {room}
 */
(() => {
  const usernameinput = document.getElementById('username-input');
  usernameinput.style.color = 'black';
  usernameinput.style.fontWeight = 'bold';
  usernameinput.style.textAlign = 'center';
  const cookieArr = document.cookie.split('=');
  const displayname = cookieArr[cookieArr.indexOf('displayname') + 1];
  if (displayname) {
    usernameinput.value = displayname;
  } else {
    usernameinput.getElementById('username-input').removeAttribute('readonly');
  }

  fetch('/rooms')
    .then((response) => {
      if (!response.ok) {
        throw Error(response.statusText);
      }
      // Read the response as json.
      return response.json();
    })
    .then((jsonResp) => {
      // empty object (no rooms occupied), nothing to do
      if (
        Object.keys(jsonResp).length === 0 &&
        jsonResp.constructor === Object
      ) {
        return;
      }

      const roomCountDiv = document.getElementById('room-count');
      roomCountDiv.innerText = 'Participants:';

      Object.keys(jsonResp).forEach((roomName) => {
        const p = document.createElement('p');
        p.innerText = `${jsonResp[roomName]} in ${roomName}`;
        p.classList.add('room-counter');
        roomCountDiv.appendChild(p);
      });
    })
    .catch((error) => {
      console.error('Error fetching data', error);
    });
})();
