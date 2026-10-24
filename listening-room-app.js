/* Separate hash-routed Listening Room shell. Track state and playback remain shared with streaming-app.js. */
(() => {
  const roomPage = document.getElementById('listeningRoomPage');
  const homePage = document.getElementById('home');
  if (!roomPage || !homePage) return;

  const roomHash = '#listening-room';
  const renderRoute = () => {
    const isRoom = window.location.hash === roomHash || (window.location.hash === '#music' && new URLSearchParams(window.location.search).has('track'));
    if (isRoom && window.location.hash !== roomHash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${roomHash}`);
    roomPage.hidden = !isRoom;
    homePage.hidden = isRoom;
    document.body.classList.toggle('is-listening-room', isRoom);
    if (isRoom) window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', !isRoom && link.getAttribute('href') === '#feed');
    });
  };

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="#listening-room"]');
    if (link && window.location.hash === roomHash) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
})();
