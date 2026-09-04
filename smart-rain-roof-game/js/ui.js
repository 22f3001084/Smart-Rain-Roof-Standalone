/* Panels, labels, component picking and the flow diagram. */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  /* Browser speech is deliberately tied to the user's Start/Next clicks.
     It can be switched off without changing the visual lesson. */
  SRR.voiceOn = true;
  SRR.readAloud = function (text, done) {
    if (!SRR.voiceOn || !window.speechSynthesis || !text) { return; }
    window.speechSynthesis.cancel();
    var line = new SpeechSynthesisUtterance(text);
    line.rate = 1.02;
    line.pitch = 1.08;
    if (done) { line.onend = done; }
    window.speechSynthesis.speak(line);
  };

  var S = SRR.SystemState;

  /* Build highlight = a transparent accent outline drawn around the part that
     was just installed. The part's own material is never cloned or edited, so
     the servo stays blue, the brackets stay grey, and the learner sees the real
     component instead of an orange repaint. */
  var OUTLINE_COLOR = 0xf7941d;
  var OUTLINE_OPACITY = 0.7;
  var OUTLINE_MIN = 0.006;      // world units — keeps tiny parts readable
  var OUTLINE_MAX = 0.035;      // world units — stops big panels looking bloated
  var OUTLINE_RATIO = 0.045;    // rim thickness as a share of the part's size

  /* Every step shows its parts beside the house first, named, before they fly
     into position — the learner should know what a piece IS before watching
     where it goes. Names are the words a child would hear in the kit. */
  var PART_LABELS = {
    Awning_Hinge_Assembly: 'Hinge plate',
    Servo_SG90: 'SG90 servo',
    Awning: 'Folding roof',
    Servo_Linkage_Rod: 'Linkage rod',
    Rain_Sensor_Module: 'Rain sensor',
    Backboard_Assembly: 'Backboard',
    Arduino_Assembly: 'Arduino Uno',
    Breadboard_Assembly: 'Breadboard',
    Power_Supply: '9V battery',
    Cable_Sensor_Run: 'Sensor cable',
    Cable_Servo_Run: 'Servo cable'
  };

  function partLabel(obj) {
    if (!obj) { return 'Part'; }
    return PART_LABELS[obj.name] || (obj.name || 'Part').replace(/_/g, ' ');
  }

  var STAGE_DWELL = 1600;       // ms the named part is held beside the house
  var STAGE_TRAVEL = 780;       // ms of flight into position

  /* Staging is measured as a share of what the camera can actually see at the
     focus depth, not in world units. Every build step frames a different part
     from a different distance, and fixed world offsets put the pieces off screen
     in the close-up views. */
  var STAGE_SIDE_FRAC = -0.58;  // to the camera's left: the build card owns the right
  var STAGE_LIFT_FRAC = 0.06;   // nudge up so a chip clears the dialogue card
  var STAGE_STEP_FRAC = 0.30;   // vertical gap when a step brings several parts
  var STAGE_SPAN_FRAC = 0.24;   // on-screen size of the biggest staged part

  /* Short, speakable game lines. The detailed how-to remains in the build card
     for learners who want it; dialogue should never feel like a textbook. */
  var BUILD_LINES = [
    'The clothes are already drying on the terrace. Now let’s build the system that protects them.',
    'Fix the hinge and blue servo together. This becomes the moving joint.',
    'Fit the folding roof and connect its linkage rod to the servo.',
    'Stand the rain sensor a foot above the roof on its round rod. Keep its copper tracks facing the sky.',
    'Build the control station with the Arduino, breadboard and battery.',
    'Clip in both signal cables. Hardware complete — now discover the correct code.'
  ];

  var INFO = {
    sensor: {
      title: 'Rain Sensor (FC-37)',
      body: 'Exposed traces on the green board bridge when water lands on them, '
          + 'pulling the output low. The Arduino reads that as "rain detected". '
          + 'It stands one foot above the terrace-side roof corner on a bare round '
          + 'rod directly above the Arduino, with nothing underneath it to catch '
          + 'splash. The green cable follows the rod down before lying flat '
          + 'against the roof and wall.'
    },
    arduino: {
      title: 'Arduino Uno R3',
      body: 'An Arduino Uno screwed to a backboard on the court wall, with a mini '
          + 'breadboard and a 9V battery beside it. It reads the rain sensor, waits '
          + 'a short debounce delay, then drives the servo signal pin. The two '
          + 'cable runs are clipped to the wall and cross the doorway above its '
          + 'head, so nothing blocks the way out onto the court.'
    },
    servo: {
      title: 'SG90 Servo Motor',
      body: 'Converts the Arduino control signal into rotation, 0 to 90 degrees. '
          + 'It is clamped to the canopy mast just below the hinge, and its '
          + 'output shaft runs up the hinge axis, so turning the horn sweeps '
          + 'the canopy across the terrace.'
    },
    roof: {
      title: 'Retractable Fan Roof',
      body: 'Five triangular slats share one hinge on a mast at the terrace '
          + 'edge. Folded, they stack into a single triangle; driven, the '
          + 'outermost slat sweeps a full 90 degrees and the fan spreads flat '
          + 'over the drying area. The blue rod is the servo linkage on the '
          + 'moving frame.'
    },
    house: {
      title: 'Two-Storey House',
      body: 'Modern flat-roofed house: two staggered volumes in smooth white '
          + 'render, the upper floor cantilevered over the entrance, one timber '
          + 'screen for warmth, and a roof terrace behind a glass balustrade. '
          + 'The terrace is where the laundry dries, which is what the rain '
          + 'system protects.'
    },
    rack: {
      title: 'Clothes Drying Rack',
      body: 'Tubular metal rack with laundry draped over its rails, standing on '
          + 'the roof terrace - the thing the system exists to protect. Once the '
          + 'canopy is out, raindrops stop at the fabric instead of reaching the '
          + 'washing.'
    }
  };

  var L = SRR.LAYOUT;
  var LABELS = [
    { key: 'sensor',  text: 'Rain Sensor',        pos: [L.SENSOR_X, L.ROOF_SLAB_Y + 0.62, L.SENSOR_Z] },
    { key: 'arduino', text: 'Arduino Controller', pos: [L.UPPER_X1 + 0.35, L.COURT_Y + 1.45, L.BOX_Z] },
    { key: 'servo',   text: 'SG90 Servo Motor',   pos: [L.UPPER_X1 + 0.45, L.PIVOT_Y - 0.60, L.HINGE_Z - 0.42] },
    { key: 'roof',    text: 'Folding Awning',     pos: [2.30, L.PIVOT_Y + 0.40, 1.60] },
    { key: 'rack',    text: 'Clothes Rack',       pos: [L.RACK_X, L.RACK_TOP + 0.38, L.RACK_Z] },
    { key: 'house',   text: 'Two-Storey House',   pos: [-2.20, L.FLOOR2_Y + 0.45, L.Z1 + 0.25] }
  ];

  var FLOW_FOR_STATE = {};
  FLOW_FOR_STATE[S.SUNNY] = null;
  FLOW_FOR_STATE[S.RAIN_STARTING] = 'rain';
  FLOW_FOR_STATE[S.RAIN_DETECTED] = 'sensor';
  FLOW_FOR_STATE[S.ROOF_CLOSING] = 'servo';
  FLOW_FOR_STATE[S.ROOF_CLOSED] = 'done';
  FLOW_FOR_STATE[S.RAIN_STOPPING] = 'sensor';
  FLOW_FOR_STATE[S.ROOF_OPENING] = 'roof';
  FLOW_FOR_STATE[S.ROOF_OPEN] = null;

  function $(id) { return document.getElementById(id); }

  function UIController(opts) {
    this.c = opts.controller;
    this.weather = opts.weather;
    this.cam = opts.cameraManager;
    this.sensor = opts.sensor;
    this.roof = opts.roof;
    this.servo = opts.servo;
    this.lighting = opts.lighting;
    this.pickTargets = opts.pickTargets;
    this.build = opts.build;
    this.exploded = opts.exploded;
    this.scene = opts.scene;

    this.labelsOn = false;
    this._toastTimer = null;
    this._placementTimer = null;
    this._placementToken = 0;
    this._activePlacements = [];
    this._highlightBindings = [];
    this._stageProxies = [];
    this.codePanel = null;
    this.gameState = {
      phase: 'START',
      buildStep: -1,
      dialogueOpen: false,
      partPlaced: false,
      testRunning: false,
      completed: false
    };
    this._v = new THREE.Vector3();

    this._bindStart();
    this._bindControls();
    this._bindInfoHub();
    this._bindDebug();
    this._bindPicking();
    this._buildLabels();
    this._buildCallouts();
    this._bindModes();

    var self = this;
    this.c.on('toast', function (m) { self.toast(m); });
    this.c.on('state', function (s) { self._onState(s); });

    // A deliberately small, namespaced diagnostic makes the real scene state
    // inspectable during QA without creating a second source of truth.
    SRR.activityDiagnostic = function () { return self.getDiagnostic(); };
  }

  UIController.prototype.attachCodePanel = function (panel) {
    this.codePanel = panel;
  };

  UIController.prototype._setPhase = function (phase) {
    this.gameState.phase = phase;
    document.body.setAttribute('data-phase', phase);
  };

  UIController.prototype._cancelPlacement = function () {
    this._placementToken++;
    window.clearTimeout(this._placementTimer);
    this._activePlacements.forEach(function (item) {
      item.obj.scale.copy(item.target);
    });
    this._activePlacements = [];
    this._clearPartStage();
    this._clearBuildHighlight();
  };

  /** Drop every staged stand-in and its name chip. */
  UIController.prototype._clearPartStage = function () {
    this._stageProxies.forEach(function (item) {
      if (item.proxy.parent) { item.proxy.parent.remove(item.proxy); }
      if (item.chip && item.chip.parentNode) { item.chip.parentNode.removeChild(item.chip); }
    });
    this._stageProxies = [];
  };

  /**
   * Park a named stand-in for each part just off the side of the house.
   *
   * The stand-in is a clone that shares the real geometry and materials, parked
   * in the scene root so it can travel in plain world space. Its resting spot is
   * measured along the camera's own right/up axes, so the parts always wait
   * beside the house on screen no matter which way the learner has orbited.
   */
  UIController.prototype._buildPartStage = function (objects) {
    this._clearPartStage();
    var camera = this.cam && this.cam.camera;
    if (!camera || !this.scene) { return []; }

    // Own the overlay rather than depend on the markup: a skin that drops the
    // container must not silently cost the learner the whole staging step.
    var host = $('partStage');
    if (!host) {
      host = document.createElement('div');
      host.id = 'partStage';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }

    var focus = (this.cam.controls && this.cam.controls.target)
      ? this.cam.controls.target.clone()
      : new THREE.Vector3();
    camera.updateMatrixWorld();
    var right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    var up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();

    // What the camera can see at the depth the parts will wait at.
    var depth = camera.position.distanceTo(focus);
    var halfH = Math.tan((camera.fov * Math.PI / 180) / 2) * depth;
    var halfW = halfH * camera.aspect;

    var self = this;
    var staged = [];
    var live = objects.filter(function (obj) { return !!obj; });
    var spread = (live.length - 1) / 2;

    live.forEach(function (obj, index) {
      obj.updateWorldMatrix(true, true);
      var endPos = new THREE.Vector3();
      var endQuat = new THREE.Quaternion();
      var endScale = new THREE.Vector3();
      obj.matrixWorld.decompose(endPos, endQuat, endScale);

      // Measure the real part where it stands: its world matrices are current,
      // and a freshly cloned proxy's are not.
      var box = new THREE.Box3().setFromObject(obj);
      var size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
      var span = Math.max(size.x, size.y, size.z);
      var wanted = halfH * STAGE_SPAN_FRAC;
      var boost = (span > 1e-4) ? Math.min(6, Math.max(1, wanted / span)) : 1;

      var proxy = obj.clone(true);
      proxy.name = (obj.name || 'Part') + '_StagedPreview';
      proxy.visible = true;
      proxy.traverse(function (node) {
        node.visible = true;
        node.castShadow = false;         // nothing should cast from mid-air
        node.receiveShadow = false;
        node.raycast = function () {};   // the real part owns every click
      });

      // These assemblies keep their origin at the scene origin and carry every
      // offset on their children, so the origin is nowhere near the part you
      // can see. Everything below is therefore aimed at the geometric centre
      // and converted back to an origin position at the end.
      var centre = box.isEmpty()
        ? new THREE.Vector3()
        : box.getCenter(new THREE.Vector3()).sub(endPos);

      var stagePoint = focus.clone()
        .add(right.clone().multiplyScalar(halfW * STAGE_SIDE_FRAC))
        .add(up.clone().multiplyScalar(halfH * (STAGE_LIFT_FRAC + (spread - index) * STAGE_STEP_FRAC)));
      var startPos = stagePoint.clone().sub(centre.clone().multiplyScalar(boost));

      proxy.position.copy(startPos);
      proxy.quaternion.copy(endQuat);
      proxy.scale.copy(endScale).multiplyScalar(boost);
      self.scene.add(proxy);
      proxy.updateMatrixWorld(true);

      var chip = document.createElement('div');
      chip.className = 'part-chip';
      chip.textContent = partLabel(obj);
      host.appendChild(chip);

      staged.push({
        obj: obj,
        proxy: proxy,
        chip: chip,
        startPos: startPos,
        endPos: endPos,
        startScale: endScale.clone().multiplyScalar(boost),
        endScale: endScale.clone(),
        centre: centre,
        halfY: size.y / 2,
        trueScale: Math.max(1e-6, endScale.x)
      });
    });

    this._stageProxies = staged;
    return staged;
  };

  /** Pin each name chip directly under its staged part, in screen space. */
  UIController.prototype._updatePartStage = function () {
    var camera = this.cam && this.cam.camera;
    if (!camera) { return; }
    var self = this;
    this._stageProxies.forEach(function (item) {
      // Follow the underside of the part as the stand-in shrinks back to its
      // real size: both the centre offset and the height scale with it.
      var factor = item.proxy.scale.x / item.trueScale;
      self._v.copy(item.centre).multiplyScalar(factor).add(item.proxy.position);
      self._v.y -= item.halfY * factor;
      self._v.project(camera);
      if (self._v.z > 1) { item.chip.style.opacity = '0'; return; }
      item.chip.style.left = ((self._v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      item.chip.style.top = ((-self._v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    });
  };

  /** Remove the outline shells added by the previous build-step highlight. */
  UIController.prototype._clearBuildHighlight = function () {
    this._highlightBindings.forEach(function (binding) {
      var outline = binding.outline;
      if (outline.parent) { outline.parent.remove(outline); }
      // The geometry is shared with the real mesh, so only the shell's own
      // material is ours to dispose.
      if (outline.material && typeof outline.material.dispose === 'function') {
        outline.material.dispose();
      }
    });
    this._highlightBindings = [];
  };

  /**
   * Give only the newly installed part a steady accent outline. Each mesh gets
   * a back-face shell of its own geometry, scaled out by a near-constant world
   * thickness, so the accent reads as a rim around the silhouette rather than a
   * tint across the surface. Nothing on the part's material is read or written,
   * which is what keeps every original colour intact.
   * The outline deliberately stays still until the learner chooses the next step.
   */
  UIController.prototype._setBuildHighlight = function (objects) {
    this._clearBuildHighlight();
    var self = this;
    var seen = [];
    var worldScale = new THREE.Vector3();
    objects.forEach(function (root) {
      if (!root || typeof root.traverse !== 'function') { return; }
      root.traverse(function (mesh) {
        if (!mesh || !mesh.isMesh || !mesh.geometry) { return; }
        if (mesh.userData.buildOutline || seen.indexOf(mesh) >= 0) { return; }
        seen.push(mesh);

        var geometry = mesh.geometry;
        if (!geometry.boundingBox) { geometry.computeBoundingBox(); }
        var box = geometry.boundingBox;
        if (!box) { return; }

        var size = box.getSize(new THREE.Vector3());
        var centre = box.getCenter(new THREE.Vector3());
        var span = Math.max(size.x, size.y, size.z);
        if (!(span > 0)) { return; }

        // Placement animates the part's scale from 0.02 up to 1, so read the
        // world scale from the parent chain and cancel it out. Otherwise the rim
        // would grow with the part instead of holding a constant thickness.
        mesh.updateWorldMatrix(true, false);
        mesh.getWorldScale(worldScale);
        var thickness = Math.min(OUTLINE_MAX, Math.max(OUTLINE_MIN, span * OUTLINE_RATIO));

        var scale = new THREE.Vector3(1, 1, 1);
        ['x', 'y', 'z'].forEach(function (axis) {
          var extent = size[axis];
          if (!(extent > 1e-6)) { return; }   // flat face: leave that axis alone
          var local = thickness / Math.max(1e-6, Math.abs(worldScale[axis]));
          scale[axis] = (extent + local * 2) / extent;
        });

        var material = new THREE.MeshBasicMaterial({
          color: OUTLINE_COLOR,
          side: THREE.BackSide,
          transparent: true,
          opacity: OUTLINE_OPACITY,
          depthWrite: false          // never occlude the part it surrounds
        });
        if ('toneMapped' in material) { material.toneMapped = false; }

        var outline = new THREE.Mesh(geometry, material);
        outline.name = (mesh.name || 'Part') + '_BuildOutline';
        outline.userData.buildOutline = true;
        outline.castShadow = false;
        outline.receiveShadow = false;
        outline.renderOrder = (mesh.renderOrder || 0) - 1;
        outline.raycast = function () {};   // component picking must ignore it
        outline.scale.copy(scale);
        // Scaling happens about the mesh origin, so shift the shell back to keep
        // it concentric with the geometry it traces.
        outline.position.set(
          centre.x - centre.x * scale.x,
          centre.y - centre.y * scale.y,
          centre.z - centre.z * scale.z
        );

        mesh.add(outline);
        self._highlightBindings.push({ mesh: mesh, outline: outline });
      });
    });
  };

  UIController.prototype._bindStart = function () {
    var self = this;
    var introStep = 0;
    $('startBtn').addEventListener('click', function () {
      if (self.gameState.phase !== 'START') { return; }

      // The first click advances the opening conversation; the second begins
      // construction. Nothing auto-proceeds while the learner is reading.
      if (introStep === 0) {
        introStep = 1;
        $('startScreen').classList.add('intro-arjun');
        $('landingSpeaker').textContent = 'Arjun';
        $('landingBeat').textContent = 'The idea · 2 / 2';
        $('landingDialogue').textContent = 'Let’s raise a rain sensor above the roof. The Arduino can detect water and turn a servo to spread the folding cover.';
        $('startLabel').textContent = 'Start building';
        SRR.readAloud($('landingDialogue').textContent);
        return;
      }

      this.disabled = true;
      $('startScreen').classList.add('fade');
      window.setTimeout(function () {
        var el = $('startScreen');
        if (el && el.parentNode) { el.parentNode.removeChild(el); }
      }, 700);
      self.setBuildMode(true);
    });
  };

  UIController.prototype._bindControls = function () {
    var self = this, c = this.c;

    $('btnRain').addEventListener('click', function () {
      if (self.weather.isRaining) { c.stopRain(); } else { c.startRain(); }
    });
    $('btnOpen').addEventListener('click', function () { c.openRoof(true); });
    $('btnClose').addEventListener('click', function () { c.closeRoof(true); });
    $('btnReset').addEventListener('click', function () { self.restartMission(); });
    $('btnDemo').addEventListener('click', function () { c.playDemo(); });

    $('btnAuto').addEventListener('click', function () {
      c.setAutoMode(!c.autoMode);
      this.textContent = 'Auto mode: ' + (c.autoMode ? 'on' : 'off');
      this.classList.toggle('toggled', c.autoMode);
      this.setAttribute('aria-pressed', String(c.autoMode));
    });
    $('btnAuto').classList.add('toggled');

    var camBtns = document.querySelectorAll('button.cam');
    Array.prototype.forEach.call(camBtns, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(camBtns, function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        self.cam.goTo(btn.getAttribute('data-cam'));
      });
    });
    $('btnCamReset').addEventListener('click', function () { self.cam.reset(); });

    $('btnLabels').addEventListener('click', function () {
      self.labelsOn = !self.labelsOn;
      this.textContent = 'Labels: ' + (self.labelsOn ? 'on' : 'off');
      this.classList.toggle('toggled', self.labelsOn);
      this.setAttribute('aria-pressed', String(self.labelsOn));
      $('labels').style.display = self.labelsOn ? 'block' : 'none';
    });
    $('labels').style.display = 'none';

    $('btnDebug').addEventListener('click', function () {
      var hidden = $('debug').classList.toggle('hidden');
      this.classList.toggle('toggled', !hidden);
      this.setAttribute('aria-pressed', String(!hidden));
    });

    $('infoClose').addEventListener('click', function () {
      $('info').classList.add('hidden');
    });

    $('dialogueNext').addEventListener('click', function () {
      self.revealBuildStep();
    });

    var voiceToggle = $('voiceToggle');
    if (voiceToggle) {
      voiceToggle.addEventListener('click', function () {
        SRR.voiceOn = !SRR.voiceOn;
        this.textContent = SRR.voiceOn ? 'Voice on' : 'Voice off';
        this.setAttribute('aria-pressed', String(SRR.voiceOn));
        if (!SRR.voiceOn && window.speechSynthesis) { window.speechSynthesis.cancel(); }
        else if (SRR.voiceOn && self.gameState.dialogueOpen) { SRR.readAloud(self._lastNarration); }
      });
    }

    $('buildContinue').addEventListener('click', function () {
      if (self.gameState.phase !== 'BUILD_REVEAL' || !self.gameState.partPlaced) { return; }
      this.disabled = true;
      this.classList.add('hidden');
      if (self.build.atEnd()) { self.completeBuild(); return; }
      self._prepareBuildStep(self.build.index + 1);
    });
  };

  UIController.prototype._bindDebug = function () {
    var c = this.c, rain = this.weather.rain, lighting = this.lighting;

    function slider(id, fn) {
      var el = $(id);
      el.addEventListener('input', function () { fn(parseFloat(el.value)); });
      return el;
    }

    slider('dbgIntensity', function (v) { rain.intensity = v; });
    slider('dbgSpeed', function (v) { rain.speed = v; });
    slider('dbgWind', function (v) { rain.wind = v; });
    slider('dbgSun', function (v) { lighting.baseSun = v; });
    slider('dbgDetect', function (v) {
      c.detectDelayMs = v;
      $('dbgDetectOut').textContent = v + ' ms';
    });
    slider('dbgReopen', function (v) {
      c.reopenDelayMs = v;
      $('dbgReopenOut').textContent = v + ' ms';
    });

    var servoEl = slider('dbgServo', function (v) { c.debugSetServo(v); });
    var roofEl = slider('dbgRoof', function (v) { c.debugSetRoof(v); });

    [servoEl, roofEl].forEach(function (el) {
      ['change', 'pointerup', 'pointercancel'].forEach(function (evt) {
        el.addEventListener(evt, function () { c.debugRelease(); });
      });
    });
  };

  UIController.prototype._bindPicking = function () {
    var self = this;
    var ray = new THREE.Raycaster();
    var ptr = new THREE.Vector2();
    var down = null;
    var canvas = $('stage');

    canvas.addEventListener('pointerdown', function (e) {
      down = [e.clientX, e.clientY];
    });

    canvas.addEventListener('pointerup', function (e) {
      if (!down) { return; }
      var moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
      down = null;
      if (moved > 6) { return; }   // that was an orbit drag, not a click

      ptr.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      ray.setFromCamera(ptr, self.cam.camera);

      for (var i = 0; i < self.pickTargets.length; i++) {
        var t = self.pickTargets[i];
        if (ray.intersectObjects(t.objects, true).length) {
          self.showInfo(t.key);
          return;
        }
      }
      $('info').classList.add('hidden');
    });
  };

  UIController.prototype.showInfo = function (key) {
    var info = INFO[key];
    if (!info) { return; }
    $('infoTitle').textContent = info.title;
    $('infoBody').textContent = info.body;
    $('info').classList.remove('hidden');
  };

  UIController.prototype._buildLabels = function () {
    var host = $('labels');
    this.labelEls = LABELS.map(function (l) {
      var el = document.createElement('div');
      el.className = 'lbl';
      el.textContent = l.text;
      host.appendChild(el);
      return { el: el, pos: new THREE.Vector3(l.pos[0], l.pos[1], l.pos[2]) };
    });
  };

  /* ---------------- teaching modes ---------------- */

  UIController.prototype._bindModes = function () {
    var self = this;

    $('btnBuild').addEventListener('click', function () {
      self.restartMission();
    });

    $('btnExplode').addEventListener('click', function () {
      self.setExploded(!self.exploded.isOpen());
    });

    // The old back/next/finish controls remain in the markup for compatibility
    // with older lesson skins, but this game intentionally has one progression
    // action per state. They are hidden and receive no event handlers here.
  };

  UIController.prototype._setInfoHub = function (open) {
    $('infoHubModal').classList.toggle('hidden', !open);
    $('infoHubButton').setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('info-hub-open', open);
  };

  UIController.prototype._bindInfoHub = function () {
    var self = this;
    $('infoHubButton').addEventListener('click', function () {
      self._setInfoHub(true);
    });
    $('infoHubClose').addEventListener('click', function () {
      self._setInfoHub(false);
    });
    $('infoHubModal').addEventListener('click', function (event) {
      if (event.target === this) { self._setInfoHub(false); }
    });
    $('hubRain').addEventListener('click', function () {
      if (self.weather.isRaining) { self.c.stopRain(); }
      else { self.c.startRain(); }
    });
    $('hubCode').addEventListener('click', function () {
      self._setInfoHub(false);
      if (self.codePanel) { self.codePanel.open(); }
    });
    $('hubRestart').addEventListener('click', function () {
      self._setInfoHub(false);
      self.restartMission();
    });
  };

  /** Enter or leave the step-by-step assembly walkthrough. */
  UIController.prototype.setBuildMode = function (on) {
    var c = this.c;
    if (on) {
      this._cancelPlacement();
      this.setExploded(false);
      c.resetSimulation();
      this.build.enter();
      this.gameState.buildStep = 0;
      this.gameState.partPlaced = false;
      this.gameState.completed = false;
      this.gameState.testRunning = false;
      this._setPhase('BUILD_DIALOGUE');
      $('buildPanel').classList.remove('hidden');
      $('controls').classList.add('hidden');
      $('status').classList.add('hidden');
      $('proof').classList.add('hidden');
      $('postBuildControls').classList.add('hidden');
      $('infoHubButton').classList.add('hidden');
      $('hubProof').classList.add('hidden');
      $('infoHubTitle').textContent = 'System ready';
      $('infoHubSummary').textContent = 'Rain → sensor → Arduino → servo → roof.';
      this._setInfoHub(false);
      $('hint').classList.add('hidden');
      Array.prototype.forEach.call(document.querySelectorAll('#flow span'), function (el) {
        el.classList.remove('active', 'passed', 'done');
      });
      $('buildContinue').classList.add('hidden');
      this._prepareBuildStep(0);
    } else {
      this._clearBuildHighlight();
      this.build.exit();
      $('buildPanel').classList.add('hidden');
      $('buildContinue').classList.add('hidden');
      $('narratorDock').classList.add('hidden');
      $('storyVeil').classList.add('hidden');
      document.body.classList.remove('dialogue-active');
      if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
    }
    $('btnBuild').classList.toggle('on', on);
    $('btnBuild').setAttribute('aria-pressed', String(on));
    $('btnBuild').textContent = on ? 'Building…' : 'Rebuild from start';
  };

  /* Dialogue explains the action; this state then clears the stage so the
     learner can actually inspect the newly placed object before continuing. */
  UIController.prototype.revealBuildStep = function () {
    if (this.gameState.phase !== 'BUILD_DIALOGUE') { return; }
    this._setPhase('BUILD_REVEAL');
    this.gameState.dialogueOpen = false;
    this.gameState.partPlaced = false;
    $('dialogueNext').disabled = true;
    $('narratorDock').classList.add('hidden');
    $('narratorDock').classList.remove('show-aisha', 'show-arjun');
    $('storyVeil').classList.add('hidden');
    document.body.classList.remove('dialogue-active');
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }

    var step = this.build.step();
    var added = this.build.placeCurrent();
    this._animatePlacement(added, function () {
      var button = $('buildContinue');
      this.gameState.partPlaced = true;
      $('stepFill').style.width = ((this.build.placedThrough + 1) / this.build.count() * 100) + '%';
      button.disabled = false;
      button.textContent = this.build.atEnd()
        ? 'Open the Arduino code'
        : (this.build.index === 0 ? 'Start building' : 'Next part');
      button.classList.remove('hidden');
      if (typeof button.focus === 'function') { button.focus({ preventScroll: true }); }
      this.toast(added.length
        ? 'Installed: ' + step.title + '.'
        : 'Starting setup ready.');
    }.bind(this));
  };

  /* Build is the gate: these controls only exist after the last physical part
     is placed.  The code lesson opens immediately afterwards. */
  UIController.prototype.completeBuild = function () {
    if (this.gameState.phase !== 'BUILD_REVEAL' || !this.build.atEnd()) { return; }
    if (this.build.visibleCount() !== this.build.managed.length) {
      this.toast('One part is still missing — returning to the build.');
      return;
    }
    this._clearBuildHighlight();
    this.build.exit();
    this._setPhase('CODE');
    this.gameState.buildStep = this.build.index;
    this.gameState.partPlaced = true;
    Array.prototype.forEach.call(document.querySelectorAll('[data-unlock="after-build"]'), function (el) {
      el.classList.remove('hidden');
    });
    $('controls').classList.remove('hidden');
    $('status').classList.remove('hidden');
    $('infoHubButton').classList.remove('hidden');
    $('buildPanel').classList.add('hidden');
    $('hint').classList.add('hidden');
    $('narratorDock').classList.add('hidden');
    $('buildContinue').classList.add('hidden');
    $('storyVeil').classList.add('hidden');
    document.body.classList.remove('dialogue-active');
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
    $('btnBuild').classList.remove('on');
    $('btnBuild').setAttribute('aria-pressed', 'false');
    $('btnBuild').textContent = 'Rebuild from start';
    this.toast('Build complete — now program the rain reflex.');
    if (this.codePanel) { this.codePanel.open(); }
  };

  UIController.prototype._prepareBuildStep = function (index) {
    this._clearBuildHighlight();
    var step = this.build.prepare(index);
    this._setPhase('BUILD_DIALOGUE');
    this.gameState.buildStep = this.build.index;
    this.gameState.dialogueOpen = true;
    this.gameState.partPlaced = false;
    $('dialogueNext').disabled = false;
    $('buildContinue').disabled = true;
    $('buildContinue').classList.add('hidden');
    this._showStep(step);
  };

  UIController.prototype._animatePlacement = function (objects, done) {
    var token = ++this._placementToken;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dwell = reduced ? 10 : STAGE_DWELL;
    var travel = reduced ? 10 : STAGE_TRAVEL;
    var stagger = reduced ? 0 : 190;

    // Outline first, while the parts still sit at their final scale: the shells
    // are sized from the world scale they will end at, then ride the same
    // grow-in animation as the parts they trace.
    this._setBuildHighlight(objects);

    var staged = this._buildPartStage(objects);
    var starts = [];
    staged.forEach(function (item, index) {
      var target = item.obj.scale.clone();
      starts.push({ obj: item.obj, target: target, delay: index * stagger, staged: item });
      // Collapsed to a speck, not hidden: `visible` stays true so the build's
      // own completeness check keeps counting this part.
      item.obj.scale.set(target.x * 0.001, target.y * 0.001, target.z * 0.001);
    });
    this._activePlacements = starts;
    var started = performance.now();
    var self = this;
    var total = dwell + travel + Math.max(0, starts.length - 1) * stagger;
    var settled = false;

    // The "Next part" button only unlocks when placement finishes, and rAF is
    // throttled to a standstill in a hidden tab. A learner who switches away
    // mid-placement must not come back to a build that cannot continue, so a
    // timer force-settles the step if the frame loop never gets there.
    function finish() {
      if (settled || token !== self._placementToken) { return; }
      settled = true;
      window.clearTimeout(self._placementTimer);
      starts.forEach(function (item) { item.obj.scale.copy(item.target); });
      self._clearPartStage();
      self._activePlacements = [];
      done();
    }

    function frame(now) {
      if (token !== self._placementToken) { return; }
      var elapsed = now - started;
      starts.forEach(function (item) {
        var s = item.staged;
        var p = Math.max(0, Math.min(1, (elapsed - dwell - item.delay) / travel));
        var eased = 1 - Math.pow(1 - p, 3);
        s.proxy.position.lerpVectors(s.startPos, s.endPos, eased);
        s.proxy.scale.lerpVectors(s.startScale, s.endScale, eased);
        // The chip names the waiting part; it fades as soon as the part moves.
        s.chip.style.opacity = String(Math.max(0, 1 - p * 2.6));
        item.obj.scale.set(
          item.target.x * Math.max(0.001, eased),
          item.target.y * Math.max(0.001, eased),
          item.target.z * Math.max(0.001, eased)
        );
      });
      self._updatePartStage();
      if (elapsed < total) { window.requestAnimationFrame(frame); }
      else { finish(); }
    }
    if (!starts.length) {
      this._placementTimer = window.setTimeout(done, 260);
    } else {
      this._updatePartStage();
      this._placementTimer = window.setTimeout(finish, total + 600);
      window.requestAnimationFrame(frame);
    }
  };

  UIController.prototype.enterCodePhase = function () {
    if (this.gameState.phase !== 'TESTING') { this._setPhase('CODE'); }
  };

  UIController.prototype.enterTesting = function () {
    this._setPhase('TESTING');
    this.gameState.testRunning = true;
    this._setInfoHub(false);
    $('postBuildControls').classList.remove('hidden');
    $('controls').classList.add('testing');
  };

  UIController.prototype.finishTest = function (passed) {
    this.gameState.testRunning = false;
    $('controls').classList.remove('testing');
    if (passed) {
      this._setPhase('PROOF');
      this.gameState.completed = true;
      $('proof').classList.remove('hidden');
      $('hubProof').classList.remove('hidden');
      $('infoHubTitle').textContent = 'Washing protected';
      $('infoHubSummary').textContent = 'The sensor detected rain and the roof closed automatically.';
      this.cam.goTo('court');
      Array.prototype.forEach.call(document.querySelectorAll('#flow span'), function (el) {
        el.classList.remove('active');
        el.classList.add('passed');
      });
    } else {
      this._setPhase('CODE');
      $('infoHubTitle').textContent = 'Adjust the code';
      $('infoHubSummary').textContent = 'Change the angle or delay, then test the roof again.';
    }
  };

  UIController.prototype.restartMission = function () {
    this._cancelPlacement();
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
    if (this.codePanel) { this.codePanel.reset(); this.codePanel.close(); }
    $('story').classList.add('hidden');
    $('codeReport').innerHTML = '';
    this.setBuildMode(true);
  };

  UIController.prototype.getDiagnostic = function () {
    var visible = [];
    this.build.managed.forEach(function (obj) {
      if (obj.visible) { visible.push(obj.name || '(unnamed object)'); }
    });
    var expected = 0;
    for (var i = 0; i <= this.build.placedThrough; i++) {
      expected += this.build.steps[i].show.length;
    }
    return {
      phase: this.gameState.phase,
      buildStep: this.gameState.buildStep,
      visibleManagedObjects: visible,
      visibleManagedObjectCount: visible.length,
      expectedVisibleObjects: expected,
      highlightedMeshCount: this._highlightBindings.length,
      dialogueOpen: this.gameState.dialogueOpen,
      partPlaced: this.gameState.partPlaced,
      codeDegree: this.c.codeDeg,
      codeDelay: this.c.codeDel,
      simulationState: this.c.state,
      testRunning: this.gameState.testRunning,
      completed: this.gameState.completed
    };
  };

  UIController.prototype._showStep = function (step) {
    var b = this.build;
    $('stepNo').textContent = b.index + 1;
    $('stepTotal').textContent = b.count();
    $('stepFill').style.width = (Math.max(0, b.placedThrough + 1) / b.count() * 100) + '%';
    $('stepTitle').textContent = step.title;
    $('needLabel').textContent = b.index === 0 ? 'Starting setup' : 'Part for this step';
    $('stepSay').textContent = step.say;

    var need = $('stepNeed');
    need.innerHTML = '';
    step.need.forEach(function (n) {
      var li = document.createElement('li');
      li.textContent = n;
      need.appendChild(li);
    });

    if (step.view) { this.cam.goTo(step.view); }
    this._narrateBuild(step);
  };

  UIController.prototype._narrateBuild = function (step) {
    var aisha = this.build.index % 2 === 0;
    var dock = $('narratorDock');
    var line = BUILD_LINES[this.build.index] || step.say;

    window.clearTimeout(this._narrationTimer);
    dock.classList.remove('hidden', 'show-aisha', 'show-arjun');
    $('buildContinue').classList.add('hidden');
    dock.classList.add(aisha ? 'show-aisha' : 'show-arjun');
    $('storyVeil').classList.remove('hidden');
    document.body.classList.add('dialogue-active');
    $('narratorName').textContent = aisha ? 'Aisha' : 'Arjun';
    $('narratorStage').textContent = 'Build · ' + (this.build.index + 1) + ' / ' + this.build.count();
    $('narratorText').textContent = line;
    this._lastNarration = line;
    $('dialogueNext').disabled = false;
    $('dialogueNext').textContent = this.build.index === 0
      ? 'See the starting setup'
      : (this.build.atEnd() ? 'Check the finished build' : 'Build this part');
    SRR.readAloud(this._lastNarration);
    window.requestAnimationFrame(function () {
      var next = $('dialogueNext');
      if (typeof next.focus === 'function') { next.focus({ preventScroll: true }); }
    });
  };

  /** Pull everything apart in the air, with a label on each piece. */
  UIController.prototype.setExploded = function (on) {
    if (on && this.build.active) { this.setBuildMode(false); }
    this.exploded.setOpen(on);
    $('callouts').classList.toggle('on', on);
    $('btnExplode').classList.toggle('on', on);
    $('btnExplode').setAttribute('aria-pressed', String(on));
    $('btnExplode').textContent = on ? 'Put it back together' : 'Exploded view';
    if (on) {
      this.cam.goTo('exploded');
      this.toast('Exploded view — every part explained');
    }
  };

  UIController.prototype._buildCallouts = function () {
    var host = $('callouts');
    this.calloutEls = this.exploded.callouts().map(function (c) {
      var el = document.createElement('div');
      el.className = 'callout';
      var b = document.createElement('b');
      b.textContent = c.label;
      var sp = document.createElement('span');
      sp.textContent = c.note;
      el.appendChild(b);
      el.appendChild(sp);
      host.appendChild(el);
      return el;
    });
  };

  UIController.prototype.updateCallouts = function () {
    if (this.exploded.amount < 0.02) {
      for (var j = 0; j < this.calloutEls.length; j++) {
        this.calloutEls[j].style.display = 'none';
      }
      return;
    }
    var list = this.exploded.callouts();
    for (var i = 0; i < list.length; i++) {
      var el = this.calloutEls[i];
      this._v.copy(list[i].at).project(this.cam.camera);
      var behind = this._v.z > 1;
      el.style.display = behind ? 'none' : 'block';
      if (!behind) {
        el.style.left = ((this._v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        el.style.top = ((-this._v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      }
    }
  };

  UIController.prototype.updateLabels = function () {
    if (!this.labelsOn) { return; }
    for (var i = 0; i < this.labelEls.length; i++) {
      var L = this.labelEls[i];
      this._v.copy(L.pos).project(this.cam.camera);
      var behind = this._v.z > 1;
      L.el.style.display = behind ? 'none' : 'block';
      if (!behind) {
        L.el.style.left = ((this._v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        L.el.style.top = ((-this._v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      }
    }
  };

  UIController.prototype._onState = function (s) {
    var spans = document.querySelectorAll('#flow span');
    var order = ['rain', 'sensor', 'arduino', 'servo', 'roof', 'done'];
    var activeIndex = -1;
    if (s === S.RAIN_STARTING) { activeIndex = 0; }
    else if (s === S.RAIN_DETECTED) { activeIndex = 1; }
    else if (s === S.ROOF_CLOSING) { activeIndex = 3; }
    else if (s === S.ROOF_CLOSED) { activeIndex = 5; }
    else if (s === S.RAIN_STOPPING) { activeIndex = 4; }
    else if (s === S.ROOF_OPENING) { activeIndex = 4; }
    Array.prototype.forEach.call(spans, function (el) {
      el.classList.remove('active', 'passed', 'done');
      var i = order.indexOf(el.getAttribute('data-stage'));
      if (i >= 0 && i < activeIndex) { el.classList.add('passed'); }
      if (i === activeIndex) { el.classList.add('active'); }
    });
    if (activeIndex === 5 && spans.length) { spans[spans.length - 1].classList.add('done'); }
  };

  UIController.prototype.updateStatus = function () {
    var c = this.c;
    var raining = this.weather.isRaining;

    var w = $('stWeather');
    w.textContent = raining ? 'Raining' : 'Sunny';
    w.className = raining ? 'on' : '';

    var sn = $('stSensor');
    sn.textContent = this.sensor.detected ? 'Rain detected' : 'Dry';
    sn.className = this.sensor.detected ? 'on' : '';

    var ct = $('stController');
    if (ct) {
      ct.textContent = c.arduino.active ? 'Active' : 'Standby';
      ct.className = c.arduino.active ? 'on' : '';
    }

    var servoReadout = $('stServo');
    if (servoReadout) { servoReadout.textContent = this.servo.angle.toFixed(0) + '°'; }

    var p = this.roof.progress;
    var txt = 'Open', cls = '';
    if (p >= 0.98) {
      txt = 'Closed';
      cls = 'closed';
    } else if (p > 0.02 && c.roofTarget > 0.02 && p >= c.roofTarget - 0.01) {
      txt = 'Partial (' + Math.round(p * 100) + '%)';
      cls = 'moving';
    } else if (p > 0.02) {
      txt = p < c.roofTarget ? 'Closing' : 'Opening';
      cls = 'moving';
    }
    $('stRoof').textContent = txt;
    $('stRoof').className = cls;
    var autoReadout = $('stAuto');
    if (autoReadout) { autoReadout.textContent = c.autoMode ? 'On' : 'Off'; }

    var code = $('stCode');
    code.textContent = c.codeDeg + '° / ' + c.codeDel + ' ms'
      + (c.codeTuned ? ' ✓' : '');
    code.className = c.codeTuned ? 'tuned' : '';

    var btn = $('btnRain');
    var label = raining ? 'Stop rain' : 'Start rain';
    if (btn.textContent !== label) {
      btn.textContent = label;
      btn.classList.toggle('raining', raining);
    }
    $('hubWeather').textContent = raining ? 'Raining' : 'Sunny';
    $('hubSensor').textContent = this.sensor.detected ? 'Rain detected' : 'Dry';
    $('hubRoof').textContent = txt;
    $('hubCodeState').textContent = c.codeDeg + '° · ' + c.codeDel + ' ms'
      + (c.codeTuned ? ' ✓' : '');
    $('hubRain').textContent = label;

    // keep debug sliders in step while the simulation drives itself
    if (!c.debugHold) {
      $('dbgServo').value = this.servo.angle.toFixed(0);
      $('dbgRoof').value = c.roofProgress.toFixed(2);
    }
  };

  UIController.prototype.toast = function (msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(function () {
      el.classList.add('hidden');
    }, 2400);
  };

  SRR.UIController = UIController;
}(window.SRR));
