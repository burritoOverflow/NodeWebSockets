/**
 * Show the user a toast containing the message
 *
 * @param {*} message - the string contents of the toast
 * @param {boolean} - if true, redirect
 */
function showSnackbarAndRedirect(message, success) {
  const snackbar = document.getElementById('snackbar');
  snackbar.innerText = message;
  snackbar.classList.add('show');
  setTimeout(() => {
    snackbar.classList.remove('show');
    if (success) {
      // send the user to the index page to choose a room
      window.location.replace('/');
    }
  }, 900);
}

/**
 * Post user's creds to login
 *
 * @param {*} loginObj - the provided email and password from the form
 */
function doLogin(loginObj) {
  const loginApiUrl = '/api/users/login';
  fetch(loginApiUrl, {
    method: 'POST',
    body: JSON.stringify(loginObj),
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  })
    .then((response) => {
      if (response.ok) {
        // login successful
        showSnackbarAndRedirect('Welcome back!', true);
      } else {
        // login failed
        showSnackbarAndRedirect('Login failed', false);
      }
    })
    .catch((error) => {
      console.error(error);
    });
}

/**
 * Set the event listener for the form
 */
document.getElementById('login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  // if both form values are present, attempt login
  if (email && password) {
    doLogin({
      email,
      password,
    });
  }
});
