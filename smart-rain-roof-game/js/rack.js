/* Metal drying rack with laundry draped over its rails.
   Rails run along z, so each cloth folds over its rail and sways about z. */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  var L = SRR.LAYOUT;
  var box = SRR.box, cyl = SRR.cyl, std = SRR.std, D2R = SRR.D2R;

  var RAIL_X = [-0.50, -0.25, 0.00, 0.25, 0.50];
  var RAIL_HALF_Z = 0.85;
  var TOP_Y = SRR.LAYOUT.RACK_TOP;           // rail height above the court deck

  var LAUNDRY = [
    { name: 'Shirt_Red',    color: 0xd8281c, rail: 0, z:  0.34 },
    { name: 'Shirt_Green',  color: 0x0f7a37, rail: 1, z: -0.30 },
    { name: 'Cloth_Beige',  color: 0xdbb684, rail: 2, z:  0.30 },
    { name: 'Shirt_Blue',   color: 0x2b90e0, rail: 3, z: -0.34 },
    { name: 'Shirt_Yellow', color: 0xf0d31f, rail: 4, z:  0.28 },
    { name: 'Shirt_Lime',   color: 0x59cc26, rail: 1, z:  0.52 }
  ];

  function ClothesRack(scene) {
    this.group = new THREE.Group();
    this.group.name = 'DryingRack';
    scene.add(this.group);

    var metal = std(0xd7d9dd, 0.35, 0.7);
    var frame = new THREE.Group();
    frame.name = 'Rack_Frame';
    this.group.add(frame);
    this.frame = frame;

    var deck = L.COURT_Y;                  // stands on the court deck
    var legH = TOP_Y - deck;
    var legX = [RAIL_X[0], RAIL_X[RAIL_X.length - 1]];
    var legZ = [-0.46, 0.46];
    var n = 0;

    legX.forEach(function (x) {
      legZ.forEach(function (z) {
        var leg = cyl(0.018, legH, metal, 'Rack_Leg_' + (++n), 12);
        // splay outward slightly; keep the foot on the deck
        var tilt = (z > 0 ? -5 : 5) * D2R;
        leg.position.set(L.RACK_X + x, deck + legH / 2,
                         L.RACK_Z + z - Math.sin(tilt) * legH / 2);
        leg.rotation.x = tilt;
        frame.add(leg);
      });
    });

    RAIL_X.forEach(function (x, i) {
      var rail = cyl(0.014, RAIL_HALF_Z * 2, metal, 'Rack_Rail_0' + (i + 1), 10);
      rail.position.set(L.RACK_X + x, TOP_Y, L.RACK_Z);
      rail.rotation.x = Math.PI / 2;
      frame.add(rail);
    });

    var span = RAIL_X[RAIL_X.length - 1] - RAIL_X[0];
    var midX = (RAIL_X[0] + RAIL_X[RAIL_X.length - 1]) / 2;
    [-RAIL_HALF_Z, RAIL_HALF_Z].forEach(function (z, i) {
      var bar = cyl(0.014, span, metal, 'Rack_End_' + (i + 1), 10);
      bar.position.set(L.RACK_X + midX, TOP_Y, L.RACK_Z + z);
      bar.rotation.z = Math.PI / 2;
      frame.add(bar);
    });

    // lower stiffener so the legs read as a real frame
    [-0.46, 0.46].forEach(function (z, i) {
      var brace = cyl(0.012, span, metal, 'Rack_Brace_' + (i + 1), 8);
      brace.position.set(L.RACK_X + midX, deck + legH * 0.35, L.RACK_Z + z);
      brace.rotation.z = Math.PI / 2;
      frame.add(brace);
    });

    this.washing = new THREE.Group();
    this.washing.name = 'Laundry';
    this.group.add(this.washing);

    this.cloths = LAUNDRY.map(function (def) {
      var mat = std(def.color, 0.85);
      var g = new THREE.Group();
      g.name = def.name;
      g.position.set(L.RACK_X + RAIL_X[def.rail], TOP_Y, L.RACK_Z + def.z);
      this.washing.add(g);

      // fold sits on the rail, panels hang either side of it
      var fold = cyl(0.048, 0.38, mat, '', 10);
      fold.rotation.x = Math.PI / 2;
      g.add(fold);

      var front = box(0.028, 0.42, 0.37, mat);
      front.position.set(0.046, -0.21, 0);
      front.rotation.z = -3 * D2R;
      g.add(front);

      var back = box(0.028, 0.34, 0.37, mat);
      back.position.set(-0.046, -0.17, 0);
      back.rotation.z = 3 * D2R;
      g.add(back);
      return g;
    }, this);
  }

  /** Light breeze; the air goes still once the canopy is over the rack. */
  ClothesRack.prototype.update = function (t, rainT) {
    var amp = (1 - rainT * 0.75) * 2.4 * D2R;
    for (var i = 0; i < this.cloths.length; i++) {
      this.cloths[i].rotation.z = Math.sin(t * 1.4 + i * 1.7) * amp;
    }
  };

  SRR.ClothesRack = ClothesRack;
  SRR.RACK_TOP_Y = TOP_Y;
}(window.SRR));
