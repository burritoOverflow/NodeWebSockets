class ChannelPosts {
  channelName;
  channelAdmin;
  posts;

  constructor(channelName, posts, channelAdmin) {
    this.channelName = channelName;
    this.channelAdmin = channelAdmin;
    this.posts = posts;
  }

  /**
   *
   * @param {HTMLElement} ul - the unordered list to append the posts to
   */
  displayPosts(ul) {
    this.posts.forEach((post) => {
      const postLi = document.createElement('li');
      const dateSpan = document.createElement('span');
      dateSpan.innerText = post.date;
      const postContents = document.createElement('p');
      postContents.innerText = post.contents;
      postLi.appendChild(dateSpan);
      postLi.appendChild(postContents);
      postLi.classList.add('post-element');

      const backgroundColor = window.getComputedStyle(dateSpan).backgroundColor;
      const color = window.getComputedStyle(dateSpan).color;

      postLi.onmouseenter = () => {
        postLi.firstChild.style.backgroundColor = 'black';
        postLi.firstChild.style.color = getComputedStyle(
          document.documentElement,
        ).getPropertyValue('--primaryColor');
      };

      postLi.onmouseleave = () => {
        dateSpan.style.backgroundColor = backgroundColor;
        dateSpan.style.color = color;
      };

      ul.appendChild(postLi);
    });

    addLinesToPosts();
  }

  /**
   * Change the color of the title elements on an interval
   */
  changeColorTitle() {
    let i = 0;
    const title = document.getElementById('title');
    const titleStrLen = title.innerText.length;
    const defaultColor = 'antiquewhite';
    let doDefault = false;

    // set a property when invoked, for cancellation
    this.intervalId = setInterval(() => {
      const colorChoice = getComputedStyle(
        document.documentElement,
      ).getPropertyValue('--primaryColor');

      doDefault
        ? (title.childNodes[i++].style.color = defaultColor)
        : (title.childNodes[i++].style.color = colorChoice);

      if (i >= titleStrLen) {
        i = 0;
        doDefault = !doDefault;
      }
    }, 700);
  }
}

/**
 * Get and return the name of the channel from the query string
 *
 * @returns {string} - the name of the channel
 */
function getChannelName() {
  const url = window.location.href;
  const params = url.split('?')[1];
  const channelName = params.split('=')[1];
  return channelName;
}

async function getAllPostsInChannel(chanName) {
  const apiRoute = '/api/channel/' + chanName;
  const response = await fetch(apiRoute);
  let data = await response.json();
  const { sender } = data;
  data = data['channelPosts'];
  // convert dates to locale strings
  data.forEach((d) => {
    d.date = new Date(d.date).toLocaleString();
  });
  return { data, sender };
}

function findAbsolutePosition(htmlElement) {
  let x = 0;
  let y = 0;
  for (; htmlElement != null; htmlElement = htmlElement.offsetParent) {
    x += htmlElement.offsetLeft;
    y += htmlElement.offsetTop;
  }
  return {
    x: x,
    y: y,
  };
}

function drawLine(x1, y1, x2, y2) {
  const color = getComputedStyle(document.documentElement).getPropertyValue(
    '--primaryColor',
  );
  const svg = document.getElementById('canvas');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('x2', x2);
  line.setAttribute('y1', y1);
  line.setAttribute('y2', y2);
  line.setAttributeNS(null, 'stroke-width', '2');
  line.setAttributeNS(null, 'stroke', color);
  svg.appendChild(line);
}

// pass first and second
function connectElements(first, second) {
  const firstPos = findAbsolutePosition(first);
  let x1 = firstPos.x - 5; // trim it a little so it doesn't show past the end
  let y1 = firstPos.y;
  x1 += first.offsetWidth;
  y1 += first.offsetHeight / 2;

  const secondPos = findAbsolutePosition(second);
  // avoid overlap
  const x2 = secondPos.x + 3;
  let y2 = secondPos.y;
  y2 += second.offsetHeight / 2;

  drawLine(x1, y1, x2, y2);
}

function addLinesToPosts() {
  // remove all previous
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';
  const titleEl = document.getElementById('title');
  const postElements = document.getElementById('channel-posts').childNodes;

  for (let index = 0; index < postElements.length; index++) {
    if (index === 0) {
      connectElements(titleEl, postElements[index]);
    } else {
      connectElements(postElements[index - 1], postElements[index]);
    }
  }
}

window.onload = async function init() {
  const colorChoice = localStorage.getItem('colorChoice');
  if (colorChoice) {
    // if user has stored choice, set the style accordingly
    document.documentElement.style.setProperty('--primaryColor', colorChoice);
  }

  const chanName = getChannelName();
  const title = document.getElementById('title');

  for (let i = 0; i < chanName.length; ++i) {
    const span = document.createElement('span');
    span.innerText = chanName.charAt(i);
    title.appendChild(span);
  }

  const { data, sender } = await getAllPostsInChannel(chanName);
  const channelObj = new ChannelPosts(chanName, data, sender);
  channelObj.displayPosts(document.getElementById('channel-posts'));

  window.onresize = addLinesToPosts;
  const elArr = [document.getElementById('title')];

  const svg = document.getElementById('canvas');
  svg.style.width = document.body.clientWidth;
  svg.style.height = document.body.clientHeight;

  setTimeout(() => {
    const mouseOverEvent = new Event('mouseenter');
    const postEls = document.getElementsByClassName('post-element');
    for (let i = 0; i < postEls.length; i++) {
      elArr.push(postEls[i]);
    }

    elArr.forEach((el) => {
      el.dispatchEvent(mouseOverEvent);
      el.style.borderColor = 'whitesmoke';
    });
  }, 1200);

  setTimeout(() => {
    elArr.forEach((el) => {
      const mouseLeaveEvent = new Event('mouseleave');
      el.dispatchEvent(mouseLeaveEvent);
      el.style.borderColor = getComputedStyle(
        document.documentElement,
      ).getPropertyValue('--primaryColor');
    });
  }, 2100);

  setTimeout(() => {
    channelObj.changeColorTitle();
  }, 3000);

  title.onclick = () => {
    clearInterval(channelObj.intervalId);
  };
};
