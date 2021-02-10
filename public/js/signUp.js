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
      } else {
        document.getElementById('message').innerText = 'sign up failed';
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
