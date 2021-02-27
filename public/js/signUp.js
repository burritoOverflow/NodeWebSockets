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
  }, 1100);
}

/**
 * The form allowing the user to sign up.
 *
 * @param {*} signUpObj - the sign up form's contents
 */
function sendSignUpData(signUpObj) {
  const signUpForm = document.getElementById('sign-up-form');
  signUpForm.classList.add('blur-element');
  const apiUrl = '/api/users';
  fetch(apiUrl, {
    method: 'POST',
    body: JSON.stringify(signUpObj),
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  })
    .then((response) => {
      response.json().then((json) => {
        if (response.ok) {
          // successfully added user
          const userName = document.getElementById('name').value;
          showSnackbarAndRedirect(`Welcome ${userName}!`, true);
        } else {
          // sign up failed
          const failureMsg = `sign up failed: ${json.status}`;
          showSnackbarAndRedirect(failureMsg, false);
        }
      });
    })
    .catch((error) => console.error(error));
  setTimeout(() => {
    signUpForm.classList.remove('blur-element');
  }, 800);
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
