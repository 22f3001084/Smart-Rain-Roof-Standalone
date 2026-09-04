/* Central state machine: rain -> sensor -> controller -> servo -> roof.
   Every UI readout and every 3D reaction is driven from here. */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  var SystemState = {
    SUNNY: 'SUNNY',
    RAIN_STARTING: 'RAIN_STARTING',
    RAIN_DETECTED: 'RAIN_DETECTED',
    ROOF_CLOSING: 'ROOF_CLOSING',
    ROOF_CLOSED: 'ROOF_CLOSED',
    RAIN_STOPPING: 'RAIN_STOPPING',
    ROOF_OPENING: 'ROOF_OPENING',
    ROOF_OPEN: 'ROOF_OPEN'
  };

  function SimulationController(parts) {
    this.weather = parts.weather;
    this.sensor = parts.sensor;
    this.arduino = parts.arduino;
    this.servo = parts.servo;
    this.roof = parts.roof;

    this.state = SystemState.SUNNY;
    this.autoMode = true;
    this.suppressAuto = false;      // set by manual open/close, cleared on reset

    this.detectDelayMs = 800;       // rain falling before the plate conducts
    this.reopenDelayMs = 3000;      // dry confirmation before reopening
    this.roofSpeed = 0.25;          // progress per second (~4 s full travel)

    // The Arduino ships with guessed numbers in its sketch. The child has to
    // tune them (angle 90, delay 500) in the code panel before the roof can
    // cover the whole line. See setCode().
    this.codeDeg = 30;
    this.codeDel = 1500;
    this.codeTuned = false;
    this.controllerDelayMs = this.codeDel;
    this._closeCap = this._capFor(this.codeDeg);

    this.roofProgress = 0;
    this.roofTarget = 0;
    this.debugHold = false;

    this._stateTimer = 0;
    this._demo = null;
    this._listeners = {};
  }

  SimulationController.prototype.on = function (evt, cb) {
    (this._listeners[evt] = this._listeners[evt] || []).push(cb);
  };

  SimulationController.prototype.emit = function (evt, data) {
    var list = this._listeners[evt];
    if (!list) { return; }
    for (var i = 0; i < list.length; i++) { list[i](data); }
  };

  SimulationController.prototype._setState = function (s) {
    if (this.state === s) { return; }
    this.state = s;
    this._stateTimer = 0;
    this.emit('state', s);
  };

  /* ---------------- Arduino code tuning ---------------- */

  // Fraction of the line the awning covers for a servo command of `deg`.
  // 90 lies flat across the rope; under-rotation stops short, over-rotation
  // strains past the end stop and swings the fan off the line again.
  SimulationController.prototype._capFor = function (deg) {
    return Math.max(0, 1 - Math.abs(deg - 90) / 90);
  };

  SimulationController.prototype.setCode = function (deg, del) {
    this.codeDeg = deg;
    this.codeDel = del;
    this.controllerDelayMs = del;
    this._closeCap = this._capFor(deg);
    var tuned = (deg === 90 && del === 500);
    if (tuned && !this.codeTuned) { this.emit('tuned'); }
    this.codeTuned = tuned;
  };

  SimulationController.prototype.coveragePct = function () {
    return Math.round(this._closeCap * 100);
  };

  /* ---------------- public API ---------------- */

  SimulationController.prototype.startRain = function () {
    if (this.weather.isRaining) { return; }
    this.weather.startRain();
    this._setState(SystemState.RAIN_STARTING);
    this.emit('toast', 'Rain started');
  };

  SimulationController.prototype.stopRain = function () {
    if (!this.weather.isRaining) { return; }
    this.weather.stopRain();
    this.sensor.setDetected(false);
    if (this.roofTarget > 0 && this.autoMode && !this.suppressAuto) {
      this._setState(SystemState.RAIN_STOPPING);
      this.emit('toast', 'Rain stopping - confirming dry');
    } else if (this.roofProgress > 0.98) {
      this._setState(SystemState.ROOF_CLOSED);
    } else if (this.roofProgress < 0.02) {
      this._setState(SystemState.SUNNY);
    }
  };

  SimulationController.prototype.openRoof = function (manual) {
    if (manual !== false) { this.suppressAuto = true; }
    this.roofTarget = 0;
    if (this.roofProgress > 0.02) { this._setState(SystemState.ROOF_OPENING); }
  };

  SimulationController.prototype.closeRoof = function (manual) {
    if (manual !== false) { this.suppressAuto = true; }
    this.roofTarget = this._closeCap;
    if (this.roofProgress < this.roofTarget - 0.02) {
      this.arduino.setActive(true);
      this._setState(SystemState.ROOF_CLOSING);
    }
  };

  SimulationController.prototype.setAutoMode = function (v) {
    this.autoMode = v;
    this.suppressAuto = false;
  };

  SimulationController.prototype.resetSimulation = function () {
    this.weather.stopRain();
    this.sensor.setDetected(false);
    this.arduino.setActive(false);
    this.roofTarget = 0;
    this.suppressAuto = false;
    this._demo = null;
    this._setState(this.roofProgress < 0.02
      ? SystemState.SUNNY : SystemState.ROOF_OPENING);
    this.emit('toast', 'Simulation reset');
  };

  SimulationController.prototype.playDemo = function () {
    this.resetSimulation();
    this.autoMode = true;
    this._demo = { t: 0, fired: {} };
    this.emit('toast', 'Demo started');
  };

  SimulationController.prototype.isDemoRunning = function () {
    return !!this._demo;
  };

  /* ---------------- per-frame ---------------- */

  SimulationController.prototype.update = function (dt) {
    this._stateTimer += dt * 1000;
    var S = SystemState;

    if (this._demo) {
      var d = this._demo;
      d.t += dt;
      if (d.t >= 2.5 && !d.fired.rain) { d.fired.rain = 1; this.startRain(); }
      if (d.t >= 14 && !d.fired.stop) { d.fired.stop = 1; this.stopRain(); }
      if (d.t >= 21 && !d.fired.end) {
        d.fired.end = 1;
        this._demo = null;
        this.emit('toast', 'Demo complete - replay any time');
      }
    }

    if (!this.debugHold) {
      switch (this.state) {
        case S.RAIN_STARTING:
          if (this._stateTimer >= this.detectDelayMs) {
            this.sensor.setDetected(true);
            this._setState(S.RAIN_DETECTED);
            this.emit('toast', 'RAIN DETECTED');
          }
          break;

        case S.RAIN_DETECTED:
          if (this._stateTimer >= this.controllerDelayMs
              && this.autoMode && !this.suppressAuto) {
            this.arduino.setActive(true);
            this.roofTarget = this._closeCap;
            this._setState(S.ROOF_CLOSING);
            this.emit('toast', 'Activating protection system');
          }
          break;

        case S.ROOF_CLOSING:
          if (this.roofTarget === 0) {
            this._setState(S.ROOF_OPENING);          // reversed mid-travel
          } else if (this.roofProgress >= this.roofTarget - 0.001) {
            this.arduino.setActive(false);
            this._setState(S.ROOF_CLOSED);
            this.emit('toast', this._closeCap >= 0.999
              ? 'CLOTHES PROTECTED'
              : 'Roof stopped at ' + this.coveragePct()
                + '% - tune the Arduino code!');
          }
          break;

        case S.RAIN_STOPPING:
          if (this._stateTimer >= this.reopenDelayMs) {
            this.arduino.setActive(true);
            this.roofTarget = 0;
            this._setState(S.ROOF_OPENING);
            this.emit('toast', 'Dry confirmed - opening roof');
          }
          break;

        case S.ROOF_OPENING:
          if (this.roofTarget > 0) {
            this._setState(S.ROOF_CLOSING);          // reversed mid-travel
          } else if (this.roofProgress <= 0) {
            this.arduino.setActive(false);
            if (this.weather.isRaining) {
              this._setState(S.RAIN_STARTING);
            } else {
              this._setState(S.SUNNY);
              this.emit('toast', 'Roof open');
            }
          }
          break;
      }

      var step = this.roofSpeed * dt;
      var gap = this.roofTarget - this.roofProgress;
      if (Math.abs(gap) <= step) {
        this.roofProgress = this.roofTarget;   // land exactly on target
      } else {
        this.roofProgress = SRR.clamp(
          this.roofProgress + Math.sign(gap) * step, 0, 1);
      }
    }

    // A servo travels at a constant rate, so roof progress is linear; the
    // driven slat tracks it exactly and the horn reads the true angle.
    this.roof.setProgress(this.roofProgress);
    this.servo.setAngle(this.roof.drivenProgress() * SRR.ROOF.SWEEP);

    this.sensor.update(dt);
    this.arduino.update(dt);
  };

  /* ---------------- debug hooks ---------------- */

  SimulationController.prototype.debugSetRoof = function (p) {
    this.debugHold = true;
    this.roofProgress = p;
    this.roofTarget = p;
  };

  SimulationController.prototype.debugSetServo = function (deg) {
    this.debugSetRoof(deg / SRR.ROOF.SWEEP);
  };

  SimulationController.prototype.debugRelease = function () {
    this.debugHold = false;
  };

  SRR.SystemState = SystemState;
  SRR.SimulationController = SimulationController;
}(window.SRR));
