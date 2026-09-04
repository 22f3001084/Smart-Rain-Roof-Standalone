/* Folding fan awning over the open court.
 *
 * Twelve pleats share one hinge bolted to the first-floor wall at the front end
 * of the court. Retracted, every pleat swings back onto the same line and the
 * whole awning collapses into a single narrow bundle lying flat along that wall
 * — so in sunshine it casts no shadow across the drying rack. Deployed, the
 * outermost pleat sweeps a full 90 degrees and the fan opens out flat over the
 * court, stopping the rain before it reaches the washing.
 *
 * progress: 0 = RETRACTED (folded to the wall, court open to the sun)
 *           1 = DEPLOYED  (fanned out, washing covered)
 */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  var L = SRR.LAYOUT;
  var box = SRR.box, cyl = SRR.cyl, std = SRR.std, D2R = SRR.D2R;

  var ROOF = {
    R: 3.60,              // pleat length, hinge to hem
    N: 12,                // pleats — enough that the fold reads as one bundle
    PITCH: 0,             // flat: the awning plane stays level
    GAP: 0.007,           // vertical spacing between stacked pleats
    LAG: 0.10,            // how far the innermost pleat trails the driven one
    PIVOT: new THREE.Vector3(L.HINGE_X, L.PIVOT_Y, L.HINGE_Z)
  };
  ROOF.SWEEP = 90;                            // the servo's full travel
  ROOF.SECTOR = ROOF.SWEEP / (ROOF.N - 1);    // 8.18 deg per pleat
  ROOF.FOLD = 90;                             // retracted: bundle along the wall
  ROOF.DROP = ROOF.R * Math.tan(ROOF.PITCH * D2R);
  ROOF.EAVE_Y = ROOF.PIVOT.y - ROOF.DROP;

  /** One pleat: apex at the hinge, outer arc dropped by the cone pitch. */
  function pleatGeometry(radius, sectorDeg, pitchDeg) {
    var segs = 8;
    var drop = radius * Math.tan(pitchDeg * D2R);
    var pos = [0, 0, 0], uv = [0.5, 0.5], idx = [];
    var a = sectorDeg * D2R;

    for (var i = 0; i <= segs; i++) {
      var t = a * i / segs, cx = Math.cos(t), cz = Math.sin(t);
      pos.push(radius * cx, -drop, radius * cz);
      uv.push(0.5 + cx * 0.5, 0.5 + cz * 0.5);
    }
    for (var k = 1; k <= segs; k++) { idx.push(0, k, k + 1); }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /** Stitched hem running along a pleat's outer arc. */
  function hemGeometry(radius, sectorDeg, pitchDeg) {
    var drop = radius * Math.tan(pitchDeg * D2R);
    var pts = [], a = sectorDeg * D2R;
    for (var i = 0; i <= 6; i++) {
      var t = a * i / 6;
      pts.push(new THREE.Vector3(radius * Math.cos(t), -drop, radius * Math.sin(t)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.017, 6, false);
  }

  function RoofSystem(scene) {
    this.progress = 0;
    this.slatProgress = [];

    this.root = new THREE.Group();
    this.root.name = 'Awning';
    this.root.position.copy(ROOF.PIVOT);
    scene.add(this.root);

    var weave = SRR.texFabric();
    var fabricA = std(0xffffff, 0.68, 0, {
      side: THREE.DoubleSide, map: weave, bumpMap: weave, bumpScale: 0.012
    });
    var fabricB = std(0xe4dcc6, 0.68, 0, {
      side: THREE.DoubleSide, map: weave, bumpMap: weave, bumpScale: 0.012
    });
    var timber = std(0xffffff, 0.7, 0, { map: SRR.texWood() });
    var steel = std(0xb4b8be, 0.34, 0.7);
    var hemMat = std(0xc9a52a, 0.6);

    /* --- wall mounting: back plate, two brackets and the hinge pin --- */
    this.hinge = new THREE.Group();
    this.hinge.name = 'Awning_Hinge_Assembly';
    scene.add(this.hinge);

    var wallFace = L.UPPER_X1;
    var plate = box(0.10, 0.46, 0.52, steel, 'Awning_Wall_Plate');
    plate.position.set(wallFace + 0.05, ROOF.PIVOT.y - 0.04, ROOF.PIVOT.z);
    this.hinge.add(plate);

    [-0.16, 0.16].forEach(function (dz, i) {
      var arm = box(ROOF.PIVOT.x - wallFace, 0.07, 0.09, steel,
                    'Awning_Bracket_' + (i + 1));
      arm.position.set((wallFace + ROOF.PIVOT.x) / 2, ROOF.PIVOT.y - 0.04,
                       ROOF.PIVOT.z + dz);
      this.hinge.add(arm);
    }, this);

    var pin = cyl(0.05, 0.34, steel, 'Awning_Hinge_Pin', 16);
    pin.position.set(ROOF.PIVOT.x, ROOF.PIVOT.y - 0.02, ROOF.PIVOT.z);
    this.hinge.add(pin);

    var hub = cyl(0.075, 0.12, steel, 'Awning_Hub', 16);
    hub.position.y = 0.05;
    this.root.add(hub);

    /* --- the pleats --- */
    this.slats = [];
    this.ribs = [];

    for (var i = 0; i < ROOF.N; i++) {
      var pleat = new THREE.Mesh(
        pleatGeometry(ROOF.R, ROOF.SECTOR, ROOF.PITCH),
        i % 2 ? fabricB : fabricA
      );
      pleat.name = 'Awning_Pleat_' + (i < 9 ? '0' : '') + (i + 1);
      pleat.castShadow = true;
      pleat.receiveShadow = true;
      pleat.position.y = -ROOF.GAP * i;
      pleat.rotation.y = ROOF.FOLD * D2R;
      this.root.add(pleat);
      this.slats.push(pleat);
      this.slatProgress.push(0);

      // rib along the pleat's leading edge, full awning length
      var ribName = i === 0 ? 'Awning_Fixed_Rib'
                  : (i === ROOF.N - 1 ? 'Awning_Moving_Rib'
                                      : 'Awning_Rib_' + (i + 1));
      var rib = box(ROOF.R, 0.032, 0.05, timber, ribName);
      rib.position.set(ROOF.R / 2, 0.022, 0);
      pleat.add(rib);
      this.ribs.push(rib);

      // stitched hem along the outer arc
      var hem = new THREE.Mesh(hemGeometry(ROOF.R, ROOF.SECTOR, ROOF.PITCH), hemMat);
      hem.name = 'Awning_Hem_' + (i + 1);
      hem.castShadow = true;
      pleat.add(hem);
    }

    /* --- front bar and linkage on the driven pleat --- */
    var driven = this.slats[ROOF.N - 1];

    var frontBar = box(ROOF.R, 0.055, 0.08, timber, 'Awning_Front_Bar');
    frontBar.position.set(ROOF.R / 2, 0.055, 0);
    driven.add(frontBar);

    [0.10, ROOF.R - 0.08].forEach(function (at, i) {
      var capEnd = box(0.07, 0.085, 0.11, steel, 'Front_Bar_Cap_' + (i + 1));
      capEnd.position.set(at, 0.055, 0);
      driven.add(capEnd);
    });

    var rod = box(ROOF.R * 0.98, 0.04, 0.045, std(0x2f6fed, 0.5), 'Servo_Linkage_Rod');
    rod.position.set(ROOF.R * 0.49, 0.105, 0);
    driven.add(rod);
    this.rod = rod;

    this.canopyFabric = this.slats[Math.floor(ROOF.N / 2)];
  }

  /**
   * The servo drives the outermost pleat; the fabric drags the inner pleats
   * behind it, so the driven pleat tracks progress exactly and each inner pleat
   * starts fractionally later, all arriving together at full spread.
   */
  RoofSystem.prototype.setProgress = function (p) {
    this.progress = SRR.clamp(p, 0, 1);
    var last = ROOF.N - 1;

    for (var i = 0; i < ROOF.N; i++) {
      var lag = ROOF.LAG * (last - i) / last;
      var pi = SRR.clamp((this.progress - lag) / (1 - lag), 0, 1);
      this.slatProgress[i] = pi;
      this.slats[i].rotation.y = (ROOF.FOLD - ROOF.SECTOR * i * pi) * D2R;
    }
  };

  /** Progress of the servo-driven pleat, which the horn tracks 1:1. */
  RoofSystem.prototype.drivenProgress = function () {
    return this.slatProgress[ROOF.N - 1];
  };

  /**
   * Height of the awning fabric above a world (x, z) point, or null when that
   * point is not covered. Used by the rain system to stop drops at the cloth,
   * and it is what makes the retracted awning genuinely stop shading the rack.
   */
  RoofSystem.prototype.canopyHeightAt = function (x, z) {
    var dx = x - ROOF.PIVOT.x;
    var dz = z - ROOF.PIVOT.z;
    var r = Math.hypot(dx, dz);
    if (r > ROOF.R || r < 0.02) { return null; }

    // signed angle in (-180, 180]; the awning band lives inside that range
    var ang = Math.atan2(dz, dx) / D2R;
    var lo = -ROOF.FOLD;
    var hi = ROOF.SECTOR - ROOF.FOLD + ROOF.SWEEP * this.progress;
    if (ang < lo || ang > hi) { return null; }

    return ROOF.PIVOT.y - r * Math.tan(ROOF.PITCH * D2R);
  };

  SRR.ROOF = ROOF;
  SRR.RoofSystem = RoofSystem;
}(window.SRR));
