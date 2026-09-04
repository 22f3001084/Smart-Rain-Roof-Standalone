/* Voice-over playback.
 *
 * Every spoken line in the activity is a file on disk, rendered ahead of time by
 * tools/build_voice.py. There is deliberately no speech-synthesis path: browser
 * voices differ per machine, are silent where no voice pack is installed, and
 * read this lesson's copy badly. If a clip is missing the line simply stays
 * silent and is still on screen, which is the behaviour the lesson is designed
 * around.
 */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  SRR.voiceOn = true;

  var clips = {};        // id -> HTMLAudioElement
  var current = null;    // the clip that is sounding
  var pending = null;    // blocked by autoplay policy, waiting for a gesture
  var warned = {};

  function base() {
    return SRR.VOICE_BASE || 'assets/voice/';
  }

  function clip(id) {
    if (clips[id]) { return clips[id]; }
    var entry = (SRR.VOICE_CLIPS || {})[id];
    if (!entry) {
      if (!warned[id]) {
        warned[id] = true;
        // Loud in the console, silent for the learner: a missing clip is a build
        // problem, never something to paper over at runtime.
        if (window.console) { console.warn('[voice] no clip for "' + id + '"'); }
      }
      return null;
    }
    var audio = new Audio(base() + entry.file);
    audio.preload = 'auto';
    clips[id] = audio;
    return audio;
  }

  /** Warm the cache so the first line does not wait on the network. */
  SRR.preloadVoice = function () {
    Object.keys(SRR.VOICE_CLIPS || {}).forEach(function (id) {
      var audio = clip(id);
      if (audio && typeof audio.load === 'function') { audio.load(); }
    });
  };

  SRR.stopVoice = function () {
    pending = null;
    if (!current) { return; }
    try {
      current.pause();
      current.currentTime = 0;
    } catch (err) { /* a clip that never started cannot be rewound */ }
    current = null;
  };

  /**
   * Play one line. Returns true when a clip exists for it, whether or not the
   * browser lets it sound immediately.
   */
  SRR.playVoice = function (id) {
    SRR.stopVoice();
    if (!SRR.voiceOn) { return !!(SRR.VOICE_CLIPS || {})[id]; }
    var audio = clip(id);
    if (!audio) { return false; }

    current = audio;
    try { audio.currentTime = 0; } catch (err) { /* not seekable yet */ }
    var started = audio.play();
    if (started && typeof started.catch === 'function') {
      started.catch(function () {
        // Autoplay policy: a page that has had no interaction yet may not make
        // sound. Hold the line and let the first gesture release it.
        pending = id;
      });
    }
    return true;
  };

  SRR.voiceLength = function (id) {
    var entry = (SRR.VOICE_CLIPS || {})[id];
    return entry ? entry.seconds : 0;
  };

  /* A small, namespaced read-out so QA can confirm a line actually sounded,
     rather than confirming only that play() was called. Matches the intent of
     SRR.activityDiagnostic for the 3D scene. */
  SRR.voiceState = function () {
    var id = null;
    Object.keys(clips).forEach(function (key) {
      if (clips[key] === current) { id = key; }
    });
    return {
      on: SRR.voiceOn,
      clipCount: Object.keys(SRR.VOICE_CLIPS || {}).length,
      loaded: Object.keys(clips).length,
      playing: !!(current && !current.paused && !current.ended),
      id: id,
      at: current ? Math.round(current.currentTime * 100) / 100 : 0,
      blockedWaitingForGesture: pending
    };
  };

  function release() {
    if (!pending || !SRR.voiceOn) { pending = null; return; }
    var id = pending;
    pending = null;
    SRR.playVoice(id);
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    window.addEventListener(evt, release, { passive: true });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SRR.preloadVoice);
  } else {
    SRR.preloadVoice();
  }
})(window.SRR);
