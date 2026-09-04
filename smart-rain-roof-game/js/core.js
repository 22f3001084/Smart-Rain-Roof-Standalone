/* Renderer, scene, lighting and camera management. */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Shared layout constants — one source of truth for the whole model.
   * Units are metres. A modern two-storey house with a roof terrace;
   * the rain-protection rig lives on that terrace.
   * ------------------------------------------------------------------ */
  var L = {
    PLOT_R: 24,             // radius of the ground plane

    // Ground floor covers the whole footprint. The first floor covers only the
    // left part of it; the rest of the ground-floor roof is an open sun court
    // at first-floor level, and that is where the drying rig lives.
    HX: 4.50,               // half width in x  (9.0 m frontage)
    Z0: -3.20, Z1: 3.00,    // footprint depth (6.2 m)

    UPPER_X1: 0.60,         // first floor runs from -HX to here
    COURT_X0: 0.60,         // open court runs from here to +HX

    PLINTH_H: 0.18,
    STOREY_H: 2.55,
    SLAB_T: 0.18,
    WALL_T: 0.20,

    PARAPET_H: 1.02,
    PARAPET_T: 0.16,

    // folding awning hinge: on the first-floor wall, at the court's front end
    HINGE_X: 0.83,
    HINGE_Z: 2.80,
    HINGE_H: 2.15,          // above the court deck

    // drying rack centre, out in the sun away from the folded awning
    RACK_X: 2.60, RACK_Z: 1.10,

    // Rooftop sensor and controller enclosure. The sensor sits at the terrace-
    // side corner beside the folding roof, directly above the control station.
    SENSOR_X: 0.40, SENSOR_Z: -2.20,
    SENSOR_MOUNT_H: 0.17,   // 17 cm shaped stand above the finished roof
    BOX_Z: -2.20
  };

  L.FLOOR1_Y = L.PLINTH_H;                       // 0.18  ground floor
  L.FLOOR2_Y = L.FLOOR1_Y + L.STOREY_H;          // 2.73  first floor structural
  L.COURT_Y = L.FLOOR2_Y + 0.06;                 // 2.79  open court deck
  L.PARAPET_TOP = L.COURT_Y + L.PARAPET_H;       // 3.81
  L.ROOF_SLAB_Y = L.FLOOR2_Y + L.STOREY_H;       // 5.28  first-floor roof
  L.PIVOT_Y = L.COURT_Y + L.HINGE_H;             // 4.94  awning hinge
  L.RACK_TOP = L.COURT_Y + 1.02;                 // 3.81  rail height

  SRR.LAYOUT = L;

  /* ------------------------------------------------------------------ */

  function RendererManager(canvas, readablePixels) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      preserveDrawingBuffer: !!readablePixels
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  RendererManager.prototype.resize = function (camera) {
    var w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  RendererManager.prototype.render = function (scene, camera) {
    this.renderer.render(scene, camera);
  };

  /* ------------------------------------------------------------------ */

  function SceneManager() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fb4d6);
    this.scene.fog = new THREE.Fog(0x8fb4d6, 52, 130);
    this._sunny = new THREE.Color(0x8fb4d6);
    this._rain = new THREE.Color(0x4a5560);
  }

  /** t: 0 = sunny, 1 = raining. */
  SceneManager.prototype.setWeatherTone = function (t) {
    this.scene.background.copy(this._sunny).lerp(this._rain, t);
    this.scene.fog.color.copy(this.scene.background);
  };

  /* ------------------------------------------------------------------ */

  function LightingManager(scene) {
    this.hemi = new THREE.HemisphereLight(0xbcd6f0, 0x9a9382, 0.85);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff3e0, 2.5);
    this.sun.position.set(16, 24, 16);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -20;
    this.sun.shadow.camera.right = 20;
    this.sun.shadow.camera.top = 22;
    this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.camera.near = 8;
    this.sun.shadow.camera.far = 76;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun);

    this.fill = new THREE.DirectionalLight(0x9fb6d4, 0.42);
    this.fill.position.set(-16, 11, -10);
    scene.add(this.fill);

    this.baseSun = 2.5;
  }

  /** t: 0 = sunny, 1 = raining. Overcast, but never so dark it stops reading. */
  LightingManager.prototype.setWeather = function (t) {
    this.sun.intensity = SRR.lerp(this.baseSun, this.baseSun * 0.42, t);
    this.sun.color.setHex(t > 0.5 ? 0xdde6f2 : 0xfff3e0);
    this.hemi.intensity = SRR.lerp(0.85, 0.72, t);
    this.fill.intensity = SRR.lerp(0.42, 0.58, t);
  };

  /* ------------------------------------------------------------------ */

  var VIEWS = {
    overview:    { pos: [14.0, 9.5, 17.5], target: [0.00, 2.60, 0.30] },
    house:       { pos: [9.5, 3.4, 15.5],  target: [0.00, 2.50, 2.20] },
    court:       { pos: [10.5, 8.6, 9.0],  target: [2.40, 3.40, 0.20] },
    canopy:      { pos: [8.0, 8.2, 7.4],   target: [2.40, 4.70, 0.90] },
    servo:       { pos: [3.9, 6.0, 5.6],   target: [0.95, 4.80, 2.80] },
    sensor:      { pos: [5.6, 7.45, -0.20], target: [L.SENSOR_X, L.ROOF_SLAB_Y + 0.34, L.SENSOR_Z] },
    clothes:     { pos: [6.4, 5.4, 4.8],   target: [2.60, 3.55, 1.10] },
    electronics: { pos: [5.8, 6.2, 0.25],  target: [0.72, 4.15, L.BOX_Z] },
    // Full-house composition shifted left to leave a safe workspace for the
    // Arduino editor on the right without cropping the roof or terrace.
    codeWorkspace:{ pos: [17.0, 11.2, 21.0], target: [4.80, 2.65, 0.25] },
    exploded:    { pos: [10.6, 9.2, 10.8], target: [2.30, 4.70, 0.50] }
  };

  function CameraManager(canvas) {
    this.camera = new THREE.PerspectiveCamera(
      42, window.innerWidth / window.innerHeight, 0.1, 200);
    this.controls = new SRR.OrbitControls(this.camera, canvas, {
      minDistance: 4.5, maxDistance: 62
    });
    this.transition = null;
    this.activeView = 'overview';
    this.goTo('overview', true);
  }

  CameraManager.prototype.goTo = function (name, instant) {
    var v = VIEWS[name];
    if (!v) { return; }
    this.activeView = name;
    var pos = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
    var tgt = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);

    if (instant) {
      this.controls.snapTo(pos, tgt);
      this.transition = null;
      return;
    }
    this.transition = {
      t: 0,
      dur: 1.2,
      fromPos: this.camera.position.clone(),
      toPos: pos,
      fromTgt: this.controls.target.clone(),
      toTgt: tgt
    };
    this.controls.setEnabled(false);
  };

  CameraManager.prototype.reset = function () { this.goTo(this.activeView); };

  CameraManager.prototype.update = function (dt) {
    if (this.transition) {
      var tr = this.transition;
      tr.t += dt / tr.dur;
      var k = SRR.easeInOutCubic(Math.min(tr.t, 1));
      this.camera.position.lerpVectors(tr.fromPos, tr.toPos, k);
      this.controls.target.lerpVectors(tr.fromTgt, tr.toTgt, k);
      this.camera.lookAt(this.controls.target);
      if (tr.t >= 1) {
        this.transition = null;
        this.controls.setFromCamera();
        this.controls.setEnabled(true);
      }
      return;
    }
    this.controls.update();
  };

  SRR.RendererManager = RendererManager;
  SRR.SceneManager = SceneManager;
  SRR.LightingManager = LightingManager;
  SRR.CameraManager = CameraManager;
}(window.SRR));
