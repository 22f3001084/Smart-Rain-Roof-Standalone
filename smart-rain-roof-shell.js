(function () {
  'use strict';

  var full = document.querySelector('.hud-bar .full');
  if (full) {
    full.title = 'Fullscreen';
    full.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () {});
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key.toLowerCase() === 'f' && event.target.tagName !== 'INPUT') {
      if (full) full.click();
    }
  });
})();

