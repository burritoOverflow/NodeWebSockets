(() => {
  fetch("/rooms")
    .then(function (response) {
      if (!response.ok) {
        throw Error(response.statusText);
      }
      // Read the response as json.
      return response.json();
    })
    .then(function (jsonResp) {
      // Do stuff with the JSON
      console.log(jsonResp);

      // empty object
      if (
        Object.keys(jsonResp).length === 0 &&
        jsonResp.constructor === Object
      ) {
        return;
      }
      const roomCountDiv = document.getElementById("room-count");
      roomCountDiv.innerText = "Participants:";

      Object.keys(jsonResp).forEach((roomName) => {
        let p = document.createElement("p");
        p.innerText = `${jsonResp[roomName]} in ${roomName}`;
        p.classList.add("room-counter");
        roomCountDiv.appendChild(p);
      });
    })
    .catch(function (error) {
      console.log("Looks like there was a problem: \n", error);
    });
})();
