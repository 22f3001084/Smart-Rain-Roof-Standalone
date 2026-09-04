/* Minimal orbit controls: spherical camera with damping, sensible limits,
   mouse + touch, no external dependency (three's OrbitControls is ESM-only). */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  function OrbitControls(camera, dom, opts) {
    opts = opts || {};
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 1, 0);

    this.minDistance = opts.minDistance || 3.5;
    this.maxDistance = opts.maxDistance || 18;
    this.minPolar = opts.minPolar === undefined ? 0.12 : opts.minPolar;
    this.maxPolar = opts.maxPolar === undefined ? Math.PI * 0.485 : opts.maxPolar;
    this.damping = opts.damping === undefined ? 0.12 : opts.damping;

    this.azimuth = 0;
    this.polar = 1.0;
    this.distance = 9;
    this._azimuth = 0;
    this._polar = 1.0;
    this._distance = 9;

    this._pointers = {};
    this._pointerOrder = [];
    this._lastPinch = 0;
    this._enabled = true;

    this._bind();
    this.setFromCamera();
  }

  /** Adopt whatever the camera currently is, so presets and orbiting agree. */
  OrbitControls.prototype.setFromCamera = function () {
    var off = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.distance = this._distance = off.length();
    this.polar = this._polar = Math.acos(SRR.clamp(off.y / this.distance, -1, 1));
    this.azimuth = this._azimuth = Math.atan2(off.x, off.z);
  };

  OrbitControls.prototype.setEnabled = function (v) { this._enabled = v; };

  OrbitControls.prototype._bind = function () {
    var self = this;

    this.dom.addEventListener('pointerdown', function (e) {
      if (!self._enabled) { return; }
      self._pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      self._pointerOrder.push(e.pointerId);
      if (self.dom.setPointerCapture) { self.dom.setPointerCapture(e.pointerId); }
    });

    this.dom.addEventListener('pointermove', function (e) {
      var p = self._pointers[e.pointerId];
      if (!p || !self._enabled) { return; }
      var ids = self._pointerOrder;

      if (ids.length >= 2) {
        // two fingers: pinch to zoom
        p.x = e.clientX;
        p.y = e.clientY;
        var a = self._pointers[ids[0]];
        var b = self._pointers[ids[1]];
        if (a && b) {
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          if (self._lastPinch > 0 && d > 0) {
            self._distance *= self._lastPinch / d;
            self._clampDistance();
          }
          self._lastPinch = d;
        }
        return;
      }

      self._azimuth -= (e.clientX - p.x) * 0.006;
      self._polar -= (e.clientY - p.y) * 0.006;
      self._polar = SRR.clamp(self._polar, self.minPolar, self.maxPolar);
      p.x = e.clientX;
      p.y = e.clientY;
    });

    function release(e) {
      delete self._pointers[e.pointerId];
      var i = self._pointerOrder.indexOf(e.pointerId);
      if (i >= 0) { self._pointerOrder.splice(i, 1); }
      if (self._pointerOrder.length < 2) { self._lastPinch = 0; }
    }
    this.dom.addEventListener('pointerup', release);
    this.dom.addEventListener('pointercancel', release);
    window.addEventListener('blur', function () {
      self._pointers = {};
      self._pointerOrder = [];
      self._lastPinch = 0;
    });

    this.dom.addEventListener('wheel', function (e) {
      if (!self._enabled) { return; }
      e.preventDefault();
      self._distance *= 1 + Math.sign(e.deltaY) * 0.09;
      self._clampDistance();
    }, { passive: false });
  };

  OrbitControls.prototype._clampDistance = function () {
    this._distance = SRR.clamp(this._distance, this.minDistance, this.maxDistance);
  };

  /** Jump straight to a camera position/target pair (used by presets). */
  OrbitControls.prototype.snapTo = function (pos, target) {
    this.target.copy(target);
    this.camera.position.copy(pos);
    this.setFromCamera();
  };

  OrbitControls.prototype.update = function () {
    var k = this.damping;
    this.azimuth += (this._azimuth - this.azimuth) * k;
    this.polar += (this._polar - this.polar) * k;
    this.distance += (this._distance - this.distance) * k;

    var sinP = Math.sin(this.polar);
    this.camera.position.set(
      this.target.x + this.distance * sinP * Math.sin(this.azimuth),
      this.target.y + this.distance * Math.cos(this.polar),
      this.target.z + this.distance * sinP * Math.cos(this.azimuth)
    );
    this.camera.lookAt(this.target);
  };

  SRR.OrbitControls = OrbitControls;
}(window.SRR));
