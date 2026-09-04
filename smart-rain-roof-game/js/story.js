/* Story mode: Aisha and Arjun are two child makers. Their dialogue explains
   why each part exists before the child puts it into the 3D build. */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var STEPS = [
    { who: 'team', name: 'Aisha & Arjun', action: 'wave',
      text: 'Look closely: the rack and clothes are already on the open terrace. Our job is to build the system that protects them.',
      cam: 'overview' },
    { who: 'aisha', name: 'Aisha', action: 'talk',
      text: 'The hinge and servo make one moving joint. The hinge guides the turn and the servo supplies the force.',
      cam: 'servo' },
    { who: 'arjun', name: 'Arjun', action: 'talk',
      text: 'The pleated roof connects to that joint. One servo turn opens the whole fan over the washing.',
      cam: 'canopy' },
    { who: 'aisha', name: 'Aisha', action: 'think',
      text: 'The rain sensor belongs on the highest roof, facing the sky. It becomes the eyes of our automatic system.',
      cam: 'sensor' },
    { who: 'arjun', name: 'Arjun', action: 'point',
      text: 'The Arduino, battery and clipped wires form the brain, power and nerves. Now experiment with the two code values; after three misses, the coach will reveal them.',
      cam: 'electronics' },
    { who: 'team', name: 'Aisha & Arjun', action: 'celebrate',
      text: 'Upload a trial and watch the real roof. Use coverage and reaction time as evidence until your design protects every shirt.',
      openCode: true },
  ];

  function StoryGuide(opts) {
    this.cam = opts.cameraManager;
    this.c = opts.controller;
    this.codePanel = opts.codePanel;
    this.i = 0;
    this.active = false;
    this._bind();
  }

  StoryGuide.prototype._bind = function () {
    var self = this;
    $('btnStory').addEventListener('click', function () {
      if (self.active) { self.exit(); } else { self.enter(); }
    });
    $('storyNext').addEventListener('click', function () { self.next(); });
    $('storySkip').addEventListener('click', function () { self.exit(); });
  };

  StoryGuide.prototype.enter = function () {
    this.active = true;
    this.i = 0;
    document.body.classList.add('dialogue-active');
    $('story').classList.remove('hidden');
    $('storyVeil').classList.remove('hidden');
    $('btnStory').classList.add('on');
    $('btnStory').setAttribute('aria-pressed', 'true');
    this._show();
  };

  StoryGuide.prototype.exit = function () {
    this.active = false;
    document.body.classList.remove('dialogue-active');
    $('story').classList.add('hidden');
    $('storyVeil').classList.add('hidden');
    $('btnStory').classList.remove('on');
    $('btnStory').setAttribute('aria-pressed', 'false');
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
    if (this.c.weather.isRaining) { this.c.stopRain(); }
  };

  StoryGuide.prototype.next = function () {
    if (this.i >= STEPS.length - 1) { this.exit(); return; }
    this.i++;
    this._show();
  };

  StoryGuide.prototype._show = function () {
    var s = STEPS[this.i];

    // Both full bodies remain in their own lower corners.  The active speaker
    // gets the talking loop; this keeps the dialogue spatially easy to follow.
    $('story').className = 'speaker-' + s.who + ' action-' + s.action;
    $('storyName').textContent = s.name;
    $('storyText').textContent = s.text;
    $('storyStep').textContent = (this.i + 1) + ' / ' + STEPS.length;
    $('storyNext').textContent =
      this.i >= STEPS.length - 1 ? 'Start tuning!' : 'Next';
    if (SRR.readAloud) { SRR.readAloud(s.text); }

    if (s.cam) { this.cam.goTo(s.cam); }
    if (s.rain === true && !this.c.weather.isRaining) { this.c.startRain(); }
    if (s.rain === false && this.c.weather.isRaining) { this.c.stopRain(); }
    if (s.openCode) {
      this.exit();
      this.codePanel.open();
    }
  };

  SRR.StoryGuide = StoryGuide;
}(window.SRR));
