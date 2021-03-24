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
      ul.appendChild(postLi);
    });
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

window.onload = async function init() {
  const chanName = getChannelName();
  document.getElementById('title').innerText = chanName;
  const posts = await getAllPostsInChannel(chanName);
  const channelObj = new ChannelPosts(chanName, posts);
  channelObj.displayPosts(document.getElementById('channel-posts'));
};
