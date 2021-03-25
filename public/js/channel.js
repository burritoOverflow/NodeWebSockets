class ChannelPosts {
  channelName;
  posts;

  constructor(channelName, posts) {
    this.channelName = channelName;
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
}

function getChannelName() {
  const url = window.location.href;
  const params = url.split('?')[1];
  const channelName = params.split('=')[1];
  return channelName;
}

async function getAllPostsInChannel(chanName) {
  const apiRoute = '/api/channel/' + chanName;
  const response = await fetch(apiRoute);
  const data = await response.json();
  return data['channelPosts'];
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
  const svg = document.getElementById('canvas');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('x2', x2);
  line.setAttribute('y1', y1);
  line.setAttribute('y2', y2);
  line.setAttributeNS(null, 'stroke-width', '2');
  line.setAttributeNS(null, 'stroke', 'white');
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
  const x2 = secondPos.x;
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
  const chanName = getChannelName();
  document.getElementById('title').innerText = chanName;
  const posts = await getAllPostsInChannel(chanName);
  const channelObj = new ChannelPosts(chanName, posts);
  channelObj.displayPosts(document.getElementById('channel-posts'));

  const svg = document.getElementById('canvas');
  svg.style.width = document.body.clientWidth;
  svg.style.height = document.body.clientHeight;

  window.onresize = addLinesToPosts;
};
