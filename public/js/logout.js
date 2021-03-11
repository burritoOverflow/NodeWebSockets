const logoutBtn = document.getElementById('logout-button');

/**
 * Post to the logout route, invalidating the user's current jwt
 */
function doLogout() {
  const logoutUrl = '/api/users/logout';
  fetch(logoutUrl, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  })
    .then((response) => {
      response.json().then((json) => {
        if (response.ok) {
          // successfully logged out
          // remove username and colorChoice from localstorage
          localStorage.removeItem('username');
          localStorage.removeItem('colorChoice');
          window.location.href = '/login';
        } else {
          // logout failed
        }
      });
    })
    .catch((error) => console.error(error));
}

logoutBtn.onclick = doLogout;
