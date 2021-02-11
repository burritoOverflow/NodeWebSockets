/**
 * Show the user a toast containing the string argument
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
      window.location.replace('/');
    }
  }, 900);
}

function sendSignUpData(signUpObj) {
  const apiUrl = '/api/users';
  fetch(apiUrl, {
    method: 'POST',
    body: JSON.stringify(signUpObj),
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  })
    .then((response) => {
      if (response.ok) {
        // successfully added user
        const userName = document.getElementById('name').value;
        showSnackbarAndRedirect(`Welcome ${userName}!`, true);
      } else {
        showSnackbarAndRedirect('sign up failed', false);
      }
    })
    .then((json) => console.log(json))
    .catch((error) => console.error(error));
}

document.getElementById('sign-up-form').addEventListener('submit', (event) => {
  event.preventDefault();
  // get the parameters
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (name && email && password) {
    sendSignUpData({
      name,
      email,
      password,
    });
  }
});
