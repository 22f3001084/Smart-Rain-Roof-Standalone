/* The plot and a modern two-storey house with an open sun court.
 *
 * Massing: the ground floor covers the whole footprint. The first floor covers
 * only the left part of it, so the rest of the ground-floor roof becomes an
 * open court at first-floor level — walled, open to the sky, and the place the
 * laundry dries. The folding awning is hinged on the first-floor wall beside it.
 *
 * Every window is a real opening: each wall is built as piers with a sill band
 * and a head band around the hole, and the glazing fills that hole inside the
 * wall thickness. Nothing is a pane floating in front of a solid wall.
 */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  var L = SRR.LAYOUT;
  var box = SRR.box, cyl = SRR.cyl, std = SRR.std;

  /* Facade set-out, so the elevations stay composed if the width changes. */
  var DOOR_X = -2.70, DOOR_W = 1.10, DOOR_H = 2.15;

  function palette() {
    return {
      render: std(0xffffff, 0.85, 0, { map: SRR.texPlaster('#eceae4') }),
      accent: std(0xffffff, 0.80, 0, { map: SRR.texPlaster('#3f4349') }),
      timber: std(0xffffff, 0.70, 0, { map: SRR.texWood() }),
      deck: std(0xffffff, 0.72, 0, { map: SRR.texConcrete() }),
      paving: std(0xffffff, 0.80, 0, { map: SRR.texConcrete() }),
      lawn: std(0xffffff, 0.95, 0, { map: SRR.texLawn() }),
      glass: std(0x9fc6dd, 0.06, 0.10, { transparent: true, opacity: 0.40 }),
      frame: std(0x23252a, 0.45, 0.30),
      steel: std(0xb9bcc2, 0.32, 0.75),
      trim: std(0xdcdad4, 0.75)
    };
  }

  /* ================= ground ================= */

  function Ground(scene) {
    var P = palette();

    var lawn = new THREE.Mesh(new THREE.CircleGeometry(L.PLOT_R, 64), P.lawn);
    lawn.rotation.x = -Math.PI / 2;
    lawn.receiveShadow = true;
    lawn.name = 'Lawn';
    scene.add(lawn);

    var apron = box(L.HX * 2 + 1.6, 0.04, (L.Z1 - L.Z0) + 1.6, P.paving, 'Paving');
    apron.position.set(0, 0.02, (L.Z0 + L.Z1) / 2);
    scene.add(apron);

    var path = box(1.8, 0.05, 4.4, P.paving, 'Entry_Path');
    path.position.set(DOOR_X, 0.025, L.Z1 + 2.6);
    scene.add(path);

    [[-4.6, L.Z1 + 1.9], [-0.6, L.Z1 + 2.2], [3.2, L.Z1 + 1.7]].forEach(function (p, i) {
      var bed = box(1.8, 0.24, 2.2, P.trim, 'Planting_Bed_' + (i + 1));
      bed.position.set(p[0], 0.12, p[1]);
      scene.add(bed);
      var soil = box(1.62, 0.06, 2.02, std(0x3a2f26, 0.95));
      soil.position.set(p[0], 0.26, p[1]);
      scene.add(soil);
      for (var s = 0; s < 9; s++) {
        var shrub = new THREE.Mesh(
          new THREE.SphereGeometry(0.14 + Math.random() * 0.08, 10, 8),
          std(0x3f6b2c, 0.9));
        shrub.position.set(p[0] + (Math.random() - 0.5) * 1.2,
                           0.33 + Math.random() * 0.05,
                           p[1] + (Math.random() - 0.5) * 1.6);
        shrub.castShadow = true;
        scene.add(shrub);
      }
    });
  }

  /* ================= house ================= */

  function House(scene) {
    this.group = new THREE.Group();
    this.group.name = 'House';
    scene.add(this.group);

    this.P = palette();
    this._plinth();
    this._groundFloor();
    this._firstFloor();
    this._court();
  }

  House.prototype._add = function (m) { this.group.add(m); return m; };

  /* ---- wall builder with real openings ---- *
   * axis 'x': wall spans x, faces +/-z, sits at z = at
   * axis 'z': wall spans z, faces +/-x, sits at x = at
   * openings: [{u0,u1,y0,y1}] in wall coordinates, ordered along u
   * ------------------------------------------------------------------ */
  House.prototype._wall = function (opts) {
    var self = this;
    var axis = opts.axis, at = opts.at, t = opts.t || L.WALL_T;
    var u0 = opts.u0, u1 = opts.u1, y0 = opts.y0, y1 = opts.y1;
    var mat = opts.mat || this.P.render;
    var name = opts.name || 'Wall';
    var openings = opts.openings || [];

    function panel(pu0, pu1, py0, py1, nm) {
      if (pu1 - pu0 < 0.002 || py1 - py0 < 0.002) { return; }
      var w = pu1 - pu0, h = py1 - py0;
      var cu = (pu0 + pu1) / 2, cy = (py0 + py1) / 2;
      var mesh = axis === 'x' ? box(w, h, t, mat, nm) : box(t, h, w, mat, nm);
      mesh.position.set(axis === 'x' ? cu : at, cy, axis === 'x' ? at : cu);
      self._add(mesh);
    }

    var cursor = u0;
    for (var i = 0; i < openings.length; i++) {
      var o = openings[i];
      panel(cursor, o.u0, y0, y1, name + '_Pier_' + (i + 1));
      panel(o.u0, o.u1, y0, o.y0, name + '_Sill_' + (i + 1));
      panel(o.u0, o.u1, o.y1, y1, name + '_Head_' + (i + 1));
      this._fillOpening(axis, at, t, o, name + '_Opening_' + (i + 1));
      cursor = o.u1;
    }
    panel(cursor, u1, y0, y1, name + '_Pier_end');
  };

  /** Glazing + frame that exactly fill an opening, inside the wall thickness. */
  House.prototype._fillOpening = function (axis, at, t, o, name) {
    var P = this.P;
    var w = o.u1 - o.u0, h = o.y1 - o.y0;
    var cu = (o.u0 + o.u1) / 2, cy = (o.y0 + o.y1) / 2;
    var fr = 0.07, fd = t * 0.9, self = this;

    function place(mesh, u, y) {
      mesh.position.set(axis === 'x' ? u : at, y, axis === 'x' ? at : u);
      self._add(mesh);
    }

    if (o.solid) {
      place(axis === 'x' ? box(w, h, t, o.mat || P.timber, name)
                         : box(t, h, w, o.mat || P.timber, name), cu, cy);
      return;
    }

    var pane = axis === 'x' ? box(w - fr, h - fr, 0.03, P.glass, name + '_Glass')
                            : box(0.03, h - fr, w - fr, P.glass, name + '_Glass');
    pane.castShadow = false;
    place(pane, cu, cy);

    [[cu, o.y0 + fr / 2, w, fr],
     [cu, o.y1 - fr / 2, w, fr],
     [o.u0 + fr / 2, cy, fr, h - fr * 2],
     [o.u1 - fr / 2, cy, fr, h - fr * 2]
    ].forEach(function (q) {
      place(axis === 'x' ? box(q[2], q[3], fd, P.frame)
                         : box(fd, q[3], q[2], P.frame), q[0], q[1]);
    });

    var bays = Math.max(1, Math.round(w / 1.15));
    for (var b = 1; b < bays; b++) {
      place(axis === 'x' ? box(0.06, h - fr * 2, fd, P.frame)
                         : box(fd, h - fr * 2, 0.06, P.frame),
            o.u0 + (w / bays) * b, cy);
    }
  };

  /* ---- plinth ---- */
  House.prototype._plinth = function () {
    var P = this.P;
    var p = box(L.HX * 2 + 0.30, L.PLINTH_H, (L.Z1 - L.Z0) + 0.30, P.accent, 'Plinth');
    p.position.set(0, L.PLINTH_H / 2, (L.Z0 + L.Z1) / 2);
    this._add(p);

    for (var i = 0; i < 3; i++) {
      var h = L.PLINTH_H / 3;
      var st = box(DOOR_W + 1.1, h, 0.34, P.paving, 'Entry_Step_' + (i + 1));
      st.position.set(DOOR_X, h / 2 + h * i, L.Z1 + 0.17 + (2 - i) * 0.34);
      this._add(st);
    }
  };

  /* ---- ground floor: full footprint ---- */
  House.prototype._groundFloor = function () {
    var P = this.P;
    var y0 = L.FLOOR1_Y, y1 = L.FLOOR2_Y - L.SLAB_T;
    var zF = L.Z1 - L.WALL_T / 2, zB = L.Z0 + L.WALL_T / 2;
    var xL = -L.HX + L.WALL_T / 2, xR = L.HX - L.WALL_T / 2;

    this._wall({
      axis: 'x', at: zF, u0: -L.HX, u1: L.HX, y0: y0, y1: y1,
      mat: P.render, name: 'Wall_G_Front',
      openings: [
        { u0: DOOR_X - DOOR_W / 2, u1: DOOR_X + DOOR_W / 2,
          y0: y0, y1: y0 + DOOR_H, solid: true, mat: P.timber },
        { u0: -0.90, u1: 3.30, y0: y0 + 0.50, y1: y1 - 0.35 }
      ]
    });
    this._doorFurniture(zF);

    this._wall({
      axis: 'x', at: zB, u0: -L.HX, u1: L.HX, y0: y0, y1: y1,
      mat: P.render, name: 'Wall_G_Back',
      openings: [
        { u0: -3.40, u1: -2.00, y0: y0 + 0.95, y1: y1 - 0.50 },
        { u0: 1.30, u1: 2.70, y0: y0 + 0.95, y1: y1 - 0.50 }
      ]
    });

    this._wall({
      axis: 'z', at: xL, u0: L.Z0, u1: L.Z1, y0: y0, y1: y1,
      mat: P.render, name: 'Wall_G_Left',
      openings: [{ u0: -0.70, u1: 0.70, y0: y0 + 0.60, y1: y1 - 0.35 }]
    });

    this._wall({
      axis: 'z', at: xR, u0: L.Z0, u1: L.Z1, y0: y0, y1: y1,
      mat: P.accent, name: 'Wall_G_Right',
      openings: [{ u0: -1.10, u1: 0.60, y0: y0 + 0.95, y1: y1 - 0.50 }]
    });

    var plate = box(L.HX * 2, 0.06, L.Z1 - L.Z0, P.deck, 'Floor_G');
    plate.position.set(0, y0 + 0.03, (L.Z0 + L.Z1) / 2);
    this._add(plate);

    var slab = box(L.HX * 2 + 0.14, L.SLAB_T, (L.Z1 - L.Z0) + 0.14, P.trim, 'Slab_L1');
    slab.position.set(0, L.FLOOR2_Y - L.SLAB_T / 2, (L.Z0 + L.Z1) / 2);
    this._add(slab);
  };

  /* ---- first floor: left part of the footprint only ---- */
  House.prototype._firstFloor = function () {
    var P = this.P;
    var y0 = L.FLOOR2_Y, y1 = L.ROOF_SLAB_Y;
    var zF = L.Z1 - L.WALL_T / 2, zB = L.Z0 + L.WALL_T / 2;
    var xL = -L.HX + L.WALL_T / 2;
    var xC = L.UPPER_X1 - L.WALL_T / 2;
    var openTop = y0 + 0.55, openBot = y1 - 0.45;

    this._wall({
      axis: 'x', at: zF, u0: -L.HX, u1: L.UPPER_X1, y0: y0, y1: y1,
      mat: P.render, name: 'Wall_1_Front',
      openings: [
        { u0: -4.00, u1: -1.20, y0: openTop, y1: openBot },
        { u0: -0.85, u1: 0.30, y0: openTop, y1: openBot, solid: true, mat: P.timber }
      ]
    });
    this._timberScreen(-0.85, 1.15, openTop, openBot - openTop, zF - L.WALL_T / 2 - 0.03);

    this._wall({
      axis: 'x', at: zB, u0: -L.HX, u1: L.UPPER_X1, y0: y0, y1: y1,
      mat: P.render, name: 'Wall_1_Back',
      openings: [{ u0: -2.90, u1: -1.50, y0: y0 + 0.85, y1: y1 - 0.50 }]
    });

    this._wall({
      axis: 'z', at: xL, u0: L.Z0, u1: L.Z1, y0: y0, y1: y1,
      mat: P.render, name: 'Wall_1_Left',
      openings: [{ u0: -1.30, u1: 0.90, y0: y0 + 0.75, y1: y1 - 0.50 }]
    });

    // the wall the awning hangs on: sliding door out to the court
    this._wall({
      axis: 'z', at: xC, u0: L.Z0, u1: L.Z1, y0: y0, y1: y1,
      mat: P.render, name: 'Wall_1_Court',
      openings: [{ u0: -0.70, u1: 1.50, y0: y0 + 0.06, y1: y0 + 2.20 }]
    });

    var w1 = L.UPPER_X1 + L.HX;
    var cx1 = (-L.HX + L.UPPER_X1) / 2;

    var plate = box(w1, 0.06, L.Z1 - L.Z0, P.deck, 'Floor_1');
    plate.position.set(cx1, y0 + 0.03, (L.Z0 + L.Z1) / 2);
    this._add(plate);

    var roof = box(w1 + 0.16, L.SLAB_T, (L.Z1 - L.Z0) + 0.16, P.trim, 'Roof_Slab');
    roof.position.set(cx1, y1 - L.SLAB_T / 2, (L.Z0 + L.Z1) / 2);
    this._add(roof);

    var cap = box(w1 + 0.08, 0.16, (L.Z1 - L.Z0) + 0.08, P.deck, 'Roof_Upstand');
    cap.position.set(cx1, y1 + 0.08, (L.Z0 + L.Z1) / 2);
    this._add(cap);
  };

  /* ---- the open sun court at first-floor level ---- */
  House.prototype._court = function () {
    var P = this.P;
    var x0 = L.COURT_X0, x1 = L.HX;
    var cx = (x0 + x1) / 2, w = x1 - x0;
    var cz = (L.Z0 + L.Z1) / 2, d = L.Z1 - L.Z0;

    var deck = box(w, 0.06, d, P.deck, 'Court_Deck');
    deck.position.set(cx, L.COURT_Y - 0.03, cz);
    this._add(deck);

    var t = L.PARAPET_T, h = L.PARAPET_H, py = L.COURT_Y + h / 2;

    var pr = box(t, h, d, P.render, 'Court_Parapet_Right');
    pr.position.set(x1 - t / 2, py, cz);
    this._add(pr);

    var pb = box(w, h, t, P.render, 'Court_Parapet_Back');
    pb.position.set(cx, py, L.Z0 + t / 2);
    this._add(pb);

    // front side: low upstand carrying a glass balustrade
    var pf = box(w, 0.34, t, P.render, 'Court_Parapet_Front');
    pf.position.set(cx, L.COURT_Y + 0.17, L.Z1 - t / 2);
    this._add(pf);

    var gh = 0.72;
    var pane = box(w - 0.26, gh, 0.03, P.glass, 'Court_Balustrade_Glass');
    pane.position.set(cx, L.COURT_Y + 0.34 + gh / 2, L.Z1 - t / 2);
    pane.castShadow = false;
    this._add(pane);

    var rail = cyl(0.032, w - 0.14, P.steel, 'Court_Balustrade_Rail', 12);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(cx, L.COURT_Y + 0.34 + gh + 0.04, L.Z1 - t / 2);
    this._add(rail);

    [[x1 - t / 2, py + h / 2 + 0.03, cz, t + 0.08, 0.06, d + 0.08],
     [cx, py + h / 2 + 0.03, L.Z0 + t / 2, w + 0.08, 0.06, t + 0.08]
    ].forEach(function (c, i) {
      var cap = box(c[3], c[4], c[5], P.trim, 'Court_Coping_' + (i + 1));
      cap.position.set(c[0], c[1], c[2]);
      this._add(cap);
    }, this);

    // planter and bench, so the court reads as somewhere you'd actually stand
    var pot = box(0.52, 0.48, 0.52, P.timber, 'Court_Planter');
    pot.position.set(x1 - 0.75, L.COURT_Y + 0.24, L.Z0 + 0.95);
    this._add(pot);
    var shrub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), std(0x44743a, 0.9));
    shrub.position.set(x1 - 0.75, L.COURT_Y + 0.70, L.Z0 + 0.95);
    shrub.castShadow = true;
    this._add(shrub);

    var bench = box(0.44, 0.08, 1.4, P.timber, 'Court_Bench');
    bench.position.set(x0 + 0.55, L.COURT_Y + 0.44, L.Z0 + 1.05);
    this._add(bench);
    [-0.55, 0.55].forEach(function (dz, i) {
      var lg = box(0.34, 0.40, 0.07, P.steel, 'Bench_Leg_' + (i + 1));
      lg.position.set(x0 + 0.55, L.COURT_Y + 0.20, L.Z0 + 1.05 + dz);
      this._add(lg);
    }, this);
  };

  /* ---- details ---- */

  House.prototype._timberScreen = function (x0, w, y0, h, plane) {
    var gap = 0.115, slatH = 0.075;
    var n = Math.floor(h / gap);
    for (var i = 0; i < n; i++) {
      var s = box(w, slatH, 0.045, this.P.timber, 'Screen_Slat_' + (i + 1));
      s.position.set(x0 + w / 2, y0 + 0.06 + i * gap, plane);
      this._add(s);
    }
  };

  House.prototype._doorFurniture = function (plane) {
    var P = this.P;
    var face = plane - L.WALL_T / 2;

    var handle = cyl(0.024, 0.62, P.steel, 'Door_Handle', 10);
    handle.position.set(DOOR_X + DOOR_W / 2 - 0.16, L.FLOOR1_Y + 1.10, face - 0.03);
    this._add(handle);

    var lite = box(0.14, DOOR_H - 0.70, 0.02, P.glass, 'Door_Lite');
    lite.position.set(DOOR_X - 0.30, L.FLOOR1_Y + DOOR_H / 2, face - 0.02);
    this._add(lite);

    var num = box(0.13, 0.20, 0.02, P.steel, 'House_Number');
    num.position.set(DOOR_X + DOOR_W / 2 + 0.34, L.FLOOR1_Y + 1.70, face - 0.02);
    this._add(num);

    var hood = box(DOOR_W + 1.0, 0.10, 0.85, P.trim, 'Entrance_Hood');
    hood.position.set(DOOR_X, L.FLOOR1_Y + DOOR_H + 0.32, face - 0.40);
    this._add(hood);
  };

  /**
   * Height at which the building stops falling rain at (x, z), or 0 for open
   * ground. The awning is handled separately by the roof system.
   */
  House.prototype.blockHeightAt = function (x, z) {
    if (x < -L.HX || x > L.HX || z < L.Z0 || z > L.Z1) { return 0; }
    if (x <= L.UPPER_X1) { return L.ROOF_SLAB_Y + 0.16; }   // first-floor roof
    return L.COURT_Y;                                        // open court deck
  };

  SRR.Ground = Ground;
  SRR.House = House;
}(window.SRR));
