/* eslint-disable no-console */
/**
 * Fetch data from the 'rooms' route and
 * display it on the main page: {count} in {room}
 */

/**
 * Populate the select element with options for each room name
 *
 * @param {*} roomNamesArr - array of room names
 */
function addOptionsToRoomSelect(roomNamesArr) {
  const roomSelect = document.getElementById('room-select');
  roomNamesArr.forEach((roomName) => {
    // create an option
    const option = document.createElement('option');
    option.value = roomName;
    option.innerText = roomName;
    roomSelect.appendChild(option);
  });
}

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

  // set user selected accent style if present
  const colorChoice = localStorage.getItem('colorChoice');
  if (colorChoice) {
    document.documentElement.style.setProperty('--primaryColor', colorChoice);
  }

  fetch('/api/room')
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
      roomCountDiv.innerText = 'Room Status:';

      const roomNamesArr = [];

      // use the api data to display the number of users in each room
      jsonResp.forEach((roomObj) => {
        const p = document.createElement('p');
        const { name, numUsers } = roomObj;
        roomNamesArr.push(name);
        p.innerText = `${numUsers} users in ${name}`;
        p.classList.add('room-counter');
        roomCountDiv.appendChild(p);
      });

      // we just need the room names to display
      addOptionsToRoomSelect(roomNamesArr);
    })
    .catch((error) => {
      console.error('Error fetching data', error);
    });
})();
