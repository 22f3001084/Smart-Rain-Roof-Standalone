/* The Arduino sketch panel. The child edits the two guessed numbers in
   smart_roof.ino - servo ANGLE and debounce DELAY - uploads, and tests the
   reflex against live rain until it is perfect (90 deg, 500 ms). */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  function $(id) { return document.getElementById(id); }

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
      ? 'Solved in ' + this.tests + (this.tests === 1 ? ' trial' : ' trials')
      : this.tests >= 3
        ? 'Coach unlocked after ' + this.tests + ' trials'
        : 'Trial ' + this.tests + ' of 3 before the coach unlocks';
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

    if (deg === 90 && del === 500) { this._success(); return true; }

    if (this.tests === 1) {
      $('codeReport').innerHTML +=
        '<p class="code-pill coach">Trial 1: change one value at a time. Angle changes coverage; delay changes reaction time.</p>';
      this.ui.toast('Trial 1 logged - use the result to make your next prediction');
    } else if (this.tests === 2) {
      $('codeReport').innerHTML +=
        '<p class="code-pill coach">Trial 2: compare this result with trial 1. Move toward more coverage and a quicker response.</p>';
      this.ui.toast('Trial 2 logged - one more experiment unlocks the coach');
    } else {
      $('codeHint').innerHTML = '<b>Coach answer:</b> select <strong>90°</strong> for the servo angle and <strong>500 ms</strong> for the delay.';
      $('codeReport').innerHTML +=
        '<p class="code-pill coach unlocked">Coach unlocked: set the angle to 90° and the delay to 500 ms, then upload again.</p>';
      this.ui.toast('Coach unlocked - select 90° and 500 ms');
    }
    this._sync();
    return false;
  };

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
