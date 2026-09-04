/* The Arduino sketch panel. The child edits the two guessed numbers in
   smart_roof.ino - servo ANGLE and debounce DELAY - uploads, and tests the
   reflex against live rain until it is perfect (90 deg, 500 ms). */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /* What the makers say after a wrong trial, and it escalates on purpose.
     Trial 1 is a nudge and nothing else. Trial 2 gives the answer away in
     words. Trial 3 stops asking the learner to try: Aisha and Arjun set the
     two values themselves and upload, so nobody can get stuck here — the
     lesson is the reasoning, not the guessing.
     `say` is the spoken line and is voiced from assets/voice/<id>.mp3;
     tools/build_voice.py parses these strings out of this array. */
  var COACH = [
    {
      id: 'coach-1',
      who: 'arjun',
      pill: 'Oops — not that pair. Try again, and change only one number this time.',
      say: 'Oops! Not yet. Try again, and change only one number this time, so you can see what that number really does.'
    },
    {
      id: 'coach-2',
      who: 'aisha',
      pill: 'Hint: 90° is the perfect angle, and the delay needs to be at least 500 ms.',
      say: 'Here is the hint. Ninety degrees is the perfect angle, because that is what swings the roof the whole way across the washing. And the delay needs to be at least five hundred milliseconds, or the roof twitches before it is sure that it is raining.'
    },
    {
      id: 'coach-3',
      who: 'team',
      pill: 'Three tries is plenty — we will set 90° and 500 ms and upload it for you.',
      say: 'That is three tries, so let us do this one together. We are setting the angle to ninety degrees and the delay to five hundred milliseconds. Now watch the roof.'
    }
  ];

  var ANSWER_DEG = 90;
  var ANSWER_DEL = 500;

  function CodePanel(opts) {
    this.c = opts.controller;
    this.weather = opts.weather;
    this.ui = opts.ui;

    this.deg = this.c.codeDeg;
    this.del = this.c.codeDel;
    this.tests = 0;
    this.found = false;
    this._timer = null;
    this._runToken = 0;

    this._bind();
    this._sync();
  }

  CodePanel.prototype._bind = function () {
    var self = this;

    $('btnCode').addEventListener('click', function () {
      if ($('codeModal').classList.contains('hidden')) { self.open(); }
      else { self.close(); }
    });
    $('codeClose').addEventListener('click', function () { self.close(); });
    $('codeModal').addEventListener('click', function (e) {
      if (e.target === this) { self.close(); }   // click on the backdrop
    });

    $('degdn').addEventListener('click', function () { self._nudge('deg', -10); });
    $('degup').addEventListener('click', function () { self._nudge('deg', 10); });
    $('deldn').addEventListener('click', function () { self._nudge('del', -100); });
    $('delup').addEventListener('click', function () { self._nudge('del', 100); });
    $('btnCodeTest').addEventListener('click', function () { self.runTest(); });
  };

  CodePanel.prototype._nudge = function (k, d) {
    if (k === 'deg') { this.deg = Math.min(180, Math.max(0, this.deg + d)); }
    else { this.del = Math.min(2000, Math.max(0, this.del + d)); }
    $('btnCodeTest').disabled = false;
    $('btnCodeTest').textContent = 'Upload & test this trial';
    $('codeReport').innerHTML = '';
    this._sync();
  };

  CodePanel.prototype._sync = function () {
    $('degv').textContent = this.deg + '°';
    $('delv').textContent = this.del;
    $('degdn').disabled = this.deg <= 0;
    $('degup').disabled = this.deg >= 180;
    $('deldn').disabled = this.del <= 0;
    $('delup').disabled = this.del >= 2000;
    $('codeAttempts').textContent = this.found
      ? (this._autoSolved
          ? 'Aisha and Arjun finished it for you'
          : 'Solved in ' + this.tests + (this.tests === 1 ? ' trial' : ' trials'))
      : this.tests >= 3
        ? 'Aisha and Arjun took over on trial 3'
        : 'Trial ' + this.tests + ' of 3 \u2014 then Aisha and Arjun step in';
  };

  CodePanel.prototype.open = function () {
    if (this.ui.gameState.phase === 'START'
        || this.ui.gameState.phase === 'BUILD_DIALOGUE'
        || this.ui.gameState.phase === 'BUILD_REVEAL') { return; }
    this.ui.enterCodePhase();
    this.ui.cam.goTo('codeWorkspace');
    $('codeModal').classList.remove('hidden');
    $('btnCode').classList.add('on');
    $('btnCode').setAttribute('aria-pressed', 'true');
    this.ui.toast('Try a pair of values, upload, then study what the roof does');
  };

  CodePanel.prototype.close = function () {
    $('codeModal').classList.add('hidden');
    $('btnCode').classList.remove('on');
    $('btnCode').setAttribute('aria-pressed', 'false');
  };

  /* Upload the sketch, rain on the house, then read the result. */
  CodePanel.prototype.runTest = function () {
    var self = this, c = this.c;
    if (this._timer || this.ui.gameState.testRunning) { return; }
    var token = ++this._runToken;
    this.tests++;
    this._sync();

    var btn = $('btnCodeTest');
    btn.disabled = true;
    btn.textContent = 'Uploading…';

    c.setCode(this.deg, this.del);
    c.resetSimulation();
    c.setAutoMode(true);
    this.ui.enterTesting();
    $('proof').classList.add('hidden');
    $('codeReport').innerHTML =
      '<p class="code-pill run">Sketch uploaded · raining on the house…</p>';

    // step aside so the child can watch the roof react to their numbers
    window.setTimeout(function () {
      if (token !== self._runToken) { return; }
      $('codeModal').classList.add('hidden');
      btn.textContent = 'Testing…';
      self.ui.cam.goTo('court');
      c.startRain();
      self.ui.toast('Sketch uploaded - watch the roof!');
    }, 600);

    // wait for the state machine to finish the close (or give up)
    var waited = 0;
    this._timer = window.setInterval(function () {
      if (token !== self._runToken) {
        window.clearInterval(self._timer);
        self._timer = null;
        return;
      }
      waited += 250;
      var settled = c.state === 'ROOF_CLOSED'
        || (c.roofTarget > 0 && c.roofProgress >= c.roofTarget - 0.005)
        || (c._closeCap <= 0.001 && waited >= 4000);  // servo never moves
      if (!settled && waited < 14000) { return; }
      window.clearInterval(self._timer);
      self._timer = null;
      // let the result sink in, then bring the report back up
      window.setTimeout(function () {
        if (token !== self._runToken) { return; }
        c.stopRain();
        var passed = self._report();
        self.ui.finishTest(passed);
        if (!passed) {
          self.ui.cam.goTo('codeWorkspace');
          $('codeModal').classList.remove('hidden');
        }
        btn.disabled = passed;
        btn.textContent = passed ? 'System proven ✓' : 'Upload & test this trial';
      }, 1800);
    }, 250);
  };

  CodePanel.prototype._report = function () {
    var cov = this.c.coveragePct();
    var deg = this.deg, del = this.del;

    var covNote = cov >= 100
      ? { c: 'ok', t: 'angle ' + deg + '° → the awning covers 100% of the line ✓' }
      : deg > 90
        ? { c: 'bad', t: 'angle ' + deg + '° → over-rotated past the stop - only ' + cov + '% stayed covered' }
        : { c: 'bad', t: 'angle ' + deg + '° → only ' + cov + '% covered - ' + (cov >= 55 ? 'the far clothes' : 'most clothes') + ' got wet' };

    var delNote = del === 500
      ? { c: 'ok', t: 'delay 500 ms - the roof reacts right on time ✓' }
      : del < 500
        ? { c: 'warn', t: 'delay below 500 ms - it snaps too early: jerky, twitchy motion' }
        : { c: 'bad', t: 'delay ' + del + ' ms - it reacted late; the clothes got wet first' };

    $('codeReport').innerHTML =
      '<p class="code-pill ' + covNote.c + '">' + covNote.t + '</p>'
      + '<p class="code-pill ' + delNote.c + '">' + delNote.t + '</p>';

    if (deg === ANSWER_DEG && del === ANSWER_DEL) { this._success(); return true; }

    var beat = COACH[Math.min(this.tests, COACH.length) - 1];
    var last = this.tests >= COACH.length;
    $('codeReport').innerHTML +=
      '<p class="code-pill coach' + (last ? ' unlocked' : '') + '">'
      + '<b>' + (beat.who === 'team' ? 'Aisha &amp; Arjun' : cap(beat.who)) + ':</b> '
      + beat.pill + '</p>';
    SRR.playVoice(beat.id);

    if (this.tests === 1) {
      this.ui.toast('Trial 1 logged — change one value and try again');
    } else if (this.tests === 2) {
      $('codeHint').innerHTML = '<b>Hint:</b> <strong>90°</strong> is the perfect angle, '
        + 'and the delay must be at least <strong>500 ms</strong>.';
      this.ui.toast('Trial 2 logged — 90° and at least 500 ms');
    } else {
      $('codeHint').innerHTML = '<b>Aisha &amp; Arjun took over:</b> angle '
        + '<strong>90°</strong>, delay <strong>500 ms</strong>.';
      this.ui.toast('Aisha and Arjun are setting it themselves');
      this._autoSolve();
    }
    this._sync();
    return false;
  };

  /**
   * Third wrong trial: set the answer and upload it, rather than leaving the
   * learner to re-enter numbers they have already been told. The values are
   * flashed as they change so the handover is visible, and the wait is the
   * length of the spoken line so the run does not talk over itself.
   */
  CodePanel.prototype._autoSolve = function () {
    if (this._autoSolved) { return; }
    this._autoSolved = true;
    var self = this;

    this.deg = ANSWER_DEG;
    this.del = ANSWER_DEL;
    this._sync();
    ['degv', 'delv'].forEach(function (id) {
      var el = $(id);
      if (!el) { return; }
      el.classList.remove('auto-set');
      // Reflow between removal and re-add, or the animation will not restart.
      void el.offsetWidth;
      el.classList.add('auto-set');
    });

    // runTest() refuses to start while a previous run is still settling, so
    // waiting a fixed delay and calling it once can drop the upload silently —
    // and the learner has just been promised it. Keep asking until it takes.
    var wait = Math.max(2600, (SRR.voiceLength && SRR.voiceLength('coach-3') * 1000) || 0);
    var deadline = Date.now() + 25000;

    function upload() {
      if (self.found) { return; }
      if (self._timer || self.ui.gameState.testRunning) {
        if (Date.now() < deadline) { window.setTimeout(upload, 300); }
        return;
      }
      $('codeReport').innerHTML +=
        '<p class="code-pill run">Uploading 90° and 500 ms…</p>';
      self.runTest();
    }

    window.setTimeout(upload, wait + 400);
  };

  function cap(word) { return word.charAt(0).toUpperCase() + word.slice(1); }

  CodePanel.prototype._success = function () {
    if (this.found) { return true; }
    this.found = true;
    $('codeHint').innerHTML = '<b>Engineering proof:</b> 90° gives full cover and 500 ms reacts in time.';
    this._sync();
    this.ui.toast('PERFECT REFLEX - 90° + 500 ms. Tuned like an engineer!');
    $('codeReport').innerHTML +=
      '<p class="code-pill ok big">★ Brain tuned! Angle = how far · delay = when. '
      + 'The house now protects the clothes all by itself.</p>';
    $('proofResult').textContent = 'PASS — 90° + 500 ms: the reflex protected the washing before it got wet.';
    $('proof').classList.remove('hidden');
    return true;
  };

  CodePanel.prototype.cancelTest = function () {
    this._runToken++;
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
    var btn = $('btnCodeTest');
    btn.disabled = false;
    btn.textContent = 'Upload & test this trial';
    this.ui.gameState.testRunning = false;
  };

  CodePanel.prototype.reset = function () {
    this.cancelTest();
    this.deg = 30;
    this.del = 1500;
    this.tests = 0;
    this.found = false;
    this.c.setCode(this.deg, this.del);
    this._sync();
    $('codeReport').innerHTML = '';
    $('btnCodeTest').disabled = false;
    $('btnCodeTest').textContent = 'Upload & test this trial';
    $('codeHint').innerHTML = '<b>Mission:</b> find an angle that covers every shirt and a delay that reacts before the washing gets wet.';
    this._sync();
  };

  SRR.CodePanel = CodePanel;
}(window.SRR));
