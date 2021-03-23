class ApplicationState {
  titleHeading;
  isIntervalSet;
  mainHeading;
  numHoverEvents;
  signUpForm;

  killAllIntervals() {
    // hack to kill all intervals and timers
    const highestTimeoutId = setTimeout(';');
    for (let i = 0; i < highestTimeoutId; ++i) {
      clearTimeout(i);
    }
  }

  windowDownEffect() {
    // arrow function for sure; we need 'this'
    setInterval(() => {
      const mainHeadingHeightInt = parseInt(
        window.getComputedStyle(this.mainHeading).height,
        10,
      );
      this.mainHeading.style.height =
        Math.floor(mainHeadingHeightInt * 1.76) + 'px';

      if (mainHeadingHeightInt >= window.innerHeight) {
        // ho boy...
        return this.killAllIntervals();
      }
    }, 3);
  }

  easterEggWalkAway() {
    // random winner
    const coinFlip = Math.floor(Math.random() * 2);
    let numBounces = 0;

    let mIncrement;
    let tIncrement;

    if (coinFlip) {
      mIncrement = 4;
      tIncrement = 1;
    } else {
      tIncrement = 4;
      mIncrement = 1;
    }

    let passed = false;

    this.intervalId = setInterval(() => {
      // are either greater
      const tooFar =
        window.innerWidth < tIncrement || window.innerWidth < mIncrement;

      if (numBounces === 2) {
        this.titleHeading.style.paddingLeft = `0px`;
        // eslint-disable-next-line no-param-reassign
        this.mainHeading.style.paddingLeft = `0px`;
        this.mainHeading.style.backgroundColor = 'black';
        this.mainHeading.style.border = '1px solid black';
        document.body.style.backgroundColor = 'rgb(14, 13, 13)';
        this.signUpForm.style.border = 'black';
        // weeeee
        this.killAllIntervals();
        return this.windowDownEffect();
      }

      if (!tooFar && !passed) {
        this.titleHeading.style.paddingLeft = `${(tIncrement += 1)}px`;
        // eslint-disable-next-line no-param-reassign
        this.mainHeading.style.paddingLeft = `${(mIncrement += 2)}px`;
      } else {
        // gone too far
        passed = true;

        if (tIncrement < 0 || mIncrement < 0) {
          this.titleHeading.style.paddingLeft = `${(tIncrement += 7)}px`;
          // eslint-disable-next-line no-param-reassign
          this.mainHeading.style.paddingLeft = `${(mIncrement += 9)}px`;
          numBounces += 1;
          passed = false;
        }

        this.titleHeading.style.paddingLeft = `${(tIncrement -= 1)}px`;
        // eslint-disable-next-line no-param-reassign
        this.mainHeading.style.paddingLeft = `${(mIncrement -= 2)}px`;
      }
    }, 3);
  }
}

/**
 * Show the user a toast containing the string argument.
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

window.onload = function init() {
  const appState = new ApplicationState();
  appState.isIntervalSet = false;
  appState.numHoverEvents = 0;
  appState.titleHeading = document.getElementsByClassName('title-heading')[0];
  appState.mainHeading = document.getElementById('main-heading');
  appState.signUpForm = document.getElementById('sign-up-form');

  appState.mainHeading.addEventListener('mouseout', () => {
    // hover twivce for the effect
    if (++appState.numHoverEvents >= 7 && !appState.isIntervalSet) {
      // we'll need this for the eventual finish
      appState.isIntervalSet = true;
      appState.easterEggWalkAway();
      document.getElementsByTagName('a')[0].style.zIndex = 1;
    }
  });

  appState.signUpForm.addEventListener('submit', (event) => {
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
};
