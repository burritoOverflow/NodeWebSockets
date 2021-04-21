/**
 * Add the eventSource listener to add published updates to the list
 */

(function () {
  const eventSource = new EventSource('/updates');
  const updateList = document.getElementById('updates-list');

  eventSource.addEventListener('message', (e) => {
    const li = document.createElement('li');
    li.innerText = `${new Date().toLocaleString()} - ${e.data}`;
    updateList.appendChild(li);
    // scroll the latest into view on update
    updateList.scrollTop = updateList.scrollHeight - updateList.clientHeight;
  });
})();
