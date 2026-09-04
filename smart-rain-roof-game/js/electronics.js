/* The electronics, kept deliberately simple and recognisable — the parts a
 * school project actually uses: a rooftop rain sensor board, an Arduino Uno,
 * a small breadboard and a 9V battery on a backboard by the court wall.
 *
 * Wiring rule: cable runs are clipped to the wall and the parapet, and they
 * cross the doorway ABOVE its head, never through the opening and never across
 * the deck where somebody would walk.
 */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  var L = SRR.LAYOUT;
  var box = SRR.box, cyl = SRR.cyl, std = SRR.std;

  var WALL = L.UPPER_X1;                 // court face of the first-floor wall

  /* ---------------- rain sensor ---------------- *
   * FC-37 style plate held 17 cm above the terrace-side roof corner on a
   * compact tapered mount. Its outer edge remains directly above the controller.
   * ------------------------------------------- */
  function RainSensor(scene) {
    this.detected = false;
    this._blinkT = 0;

    this.group = new THREE.Group();
    this.group.name = 'Rain_Sensor_Module';
    scene.add(this.group);

    var px = L.SENSOR_X, pz = L.SENSOR_Z;
    var roofTop = L.ROOF_SLAB_Y + 0.16;
    var mountH = L.SENSOR_MOUNT_H;

    // Broad foot + tapered weatherproof riser: the sensor is raised enough to
    // catch the first drops, without becoming an unstable pole.
    var foot = box(0.36, 0.035, 0.36, std(0x263b4d, 0.62), 'Sensor_Foot');
    foot.position.set(px, roofTop + 0.0175, pz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    this.group.add(foot);

    var riser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.24, mountH - 0.035, 4, 1, false),
      std(0x536d7d, 0.58)
    );
    riser.name = 'Sensor_Tapered_Mount_17cm';
    riser.position.set(px, roofTop + 0.035 + (mountH - 0.035) * 0.5, pz);
    riser.rotation.y = Math.PI / 4;
    riser.castShadow = true;
    riser.receiveShadow = true;
    this.group.add(riser);

    this.plate = new THREE.Group();
    this.plate.name = 'Rain_Sensor_Plate';
    this.plate.position.set(px, roofTop + mountH + 0.012, pz);
    this.plate.rotation.set(0, 0, 0);
    this.group.add(this.plate);

    var pcb = box(0.40, 0.024, 0.27, std(0x14803a, 0.5), 'Sensor_PCB');
    this.plate.add(pcb);

    var traceM = std(0xd8c27a, 0.32, 0.8);
    for (var i = 0; i < 6; i++) {
      var t = box(0.30, 0.010, 0.018, traceM);
      t.position.set(0, 0.017, -0.088 + i * 0.035);
      this.plate.add(t);
    }

    this.ledMat = new THREE.MeshStandardMaterial({
      color: 0x550000, emissive: 0x000000, roughness: 0.4
    });
    var led = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.028, 0.038), this.ledMat);
    led.name = 'Sensor_LED';
    led.position.set(0.14, 0.024, 0.098);
    this.plate.add(led);

    // The cable leaves the board, follows the shaped mount down and only then
    // turns across the roof. Every segment touches a physical support.
    this.wireAnchor = new THREE.Vector3(px + 0.18, roofTop + mountH + 0.012, pz);
  }

  RainSensor.prototype.setDetected = function (v) { this.detected = v; };

  RainSensor.prototype.update = function (dt) {
    this._blinkT += dt;
    var on = this.detected && (this._blinkT % 0.5 < 0.3);
    this.ledMat.emissive.setHex(on ? 0xff2222 : 0x000000);
    this.ledMat.color.setHex(on ? 0xff4444 : 0x550000);
  };

  /* ---------------- Arduino, breadboard and battery ---------------- *
   * Screwed to a plain backboard on the wall, well away from the doorway, so
   * every part is visible and nothing is hidden inside a box.
   * -------------------------------------------------------------- */
  function Arduino(scene) {
    this.active = false;
    this._pulseT = 0;

    this.group = new THREE.Group();
    this.group.name = 'Arduino_UNO_R3';
    scene.add(this.group);

    var bx = WALL + 0.02;           // backboard face
    var fx = WALL + 0.05;           // component face
    var bz = L.BOX_Z;               // along the wall, clear of the door
    var by = L.COURT_Y + 0.95;      // comfortable working height

    this.mount = new THREE.Group();
    this.mount.name = 'Backboard_Assembly';
    this.group.add(this.mount);

    var backboard = box(0.03, 0.60, 0.82, std(0xf0eee8, 0.85), 'Backboard');
    backboard.position.set(bx, by, bz);
    this.mount.add(backboard);

    [[-0.24, -0.34], [-0.24, 0.34], [0.24, -0.34], [0.24, 0.34]].forEach(function (s, i) {
      var screw = cyl(0.014, 0.02, std(0x8f939a, 0.4, 0.6), 'Backboard_Screw_' + (i + 1), 8);
      screw.rotation.z = Math.PI / 2;
      screw.position.set(bx + 0.02, by + s[0], bz + s[1]);
      this.mount.add(screw);
    }, this);

    /* --- Arduino Uno --- */
    this.board = new THREE.Group();
    this.board.name = 'Arduino_Assembly';
    this.group.add(this.board);

    var board = box(0.022, 0.27, 0.36, std(0x0f6f8f, 0.55), 'Arduino_Board');
    board.position.set(fx, by + 0.10, bz - 0.12);
    this.board.add(board);

    var mcu = box(0.018, 0.055, 0.14, std(0x17181c, 0.5), 'Arduino_MCU');
    mcu.position.set(fx + 0.02, by + 0.08, bz - 0.13);
    this.board.add(mcu);

    var usb = box(0.030, 0.070, 0.090, std(0xa8adb5, 0.35, 0.8), 'Arduino_USB');
    usb.position.set(fx + 0.02, by + 0.19, bz - 0.24);
    this.board.add(usb);

    var jack = cyl(0.030, 0.075, std(0x17181c, 0.5), 'Arduino_Jack', 10);
    jack.rotation.z = Math.PI / 2;
    jack.position.set(fx + 0.02, by + 0.02, bz - 0.24);
    this.board.add(jack);

    // the two black header strips you plug the jumper wires into
    [-0.10, 0.10].forEach(function (dy, i) {
      var header = box(0.020, 0.032, 0.30, std(0x17181c, 0.5), 'Arduino_Header_' + (i + 1));
      header.position.set(fx + 0.02, by + 0.10 + dy, bz - 0.11);
      this.board.add(header);
    }, this);

    this.ledMat = new THREE.MeshStandardMaterial({
      color: 0x224422, emissive: 0x000000, roughness: 0.4
    });
    var led = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, 0.026), this.ledMat);
    led.name = 'Arduino_LED';
    led.position.set(fx + 0.03, by + 0.21, bz + 0.01);
    this.board.add(led);

    /* --- mini breadboard --- */
    this.bread = new THREE.Group();
    this.bread.name = 'Breadboard_Assembly';
    this.group.add(this.bread);

    var bb = box(0.024, 0.16, 0.30, std(0xf4f3ef, 0.7), 'Breadboard');
    bb.position.set(fx, by - 0.16, bz - 0.12);
    this.bread.add(bb);
    var groove = box(0.006, 0.02, 0.28, std(0xd7d5cf, 0.7));
    groove.position.set(fx + 0.014, by - 0.16, bz - 0.12);
    this.bread.add(groove);

    /* --- 9V battery --- */
    this.battery = new THREE.Group();
    this.battery.name = 'Power_Supply';
    scene.add(this.battery);

    var cell = box(0.048, 0.115, 0.062, std(0x24262c, 0.6), 'Battery_9V');
    cell.position.set(fx + 0.01, by - 0.02, bz + 0.28);
    this.battery.add(cell);

    var studs = box(0.030, 0.022, 0.045, std(0xcfb53b, 0.4, 0.6), 'Battery_Terminals');
    studs.position.set(fx + 0.01, by + 0.05, bz + 0.28);
    this.battery.add(studs);

    // battery leads back to the board
    this._lead(this.battery, new THREE.Vector3(fx + 0.01, by + 0.07, bz + 0.27),
               new THREE.Vector3(fx + 0.02, by + 0.12, bz + 0.03), 0xd8281c);
    this._lead(this.battery, new THREE.Vector3(fx + 0.01, by + 0.07, bz + 0.29),
               new THREE.Vector3(fx + 0.02, by + 0.08, bz + 0.03), 0x22242a);

    /* terminals the field cables land on */
    this.anchorSensor = new THREE.Vector3(fx, by + 0.20, bz - 0.02);
    this.anchorServo = new THREE.Vector3(fx, by + 0.14, bz + 0.02);
  }

  Arduino.prototype._lead = function (parent, a, b, color) {
    var mid = a.clone().lerp(b, 0.5);
    mid.x += 0.05;
    var curve = new THREE.CatmullRomCurve3([a, mid, b]);
    var mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 16, 0.008, 5, false), std(color, 0.6));
    parent.add(mesh);
  };

  Arduino.prototype.setActive = function (v) { this.active = v; };

  Arduino.prototype.update = function (dt) {
    this._pulseT += dt;
    var on = this.active && (this._pulseT % 0.34 < 0.18);
    this.ledMat.emissive.setHex(on ? 0x33ff55 : 0x000000);
  };

  /* ---------------- wiring ---------------- *
   * Two runs, both clipped to solid surfaces:
   *   sensor  -> Arduino : across the roof, over its edge, down the wall
   *   Arduino -> servo   : up the wall, ACROSS ABOVE THE DOOR HEAD, then down
   * Nothing crosses an opening and nothing lies on the deck.
   * -------------------------------------- */
  function Wiring(scene, parts) {
    this.group = new THREE.Group();
    this.group.name = 'Wiring';
    scene.add(this.group);

    var lane = WALL + 0.06;                       // conduit line on the wall face
    var roofSurfaceY = L.ROOF_SLAB_Y + 0.16;
    var roofCableY = roofSurfaceY + 0.016;         // cable radius touches the roof

    // clear band between the door head and the roof slab
    var doorHead = L.FLOOR2_Y + 2.20;
    var slabSoffit = L.ROOF_SLAB_Y - L.SLAB_T;
    // Sit the crossing in the band between the door head (4.93) and the roof
    // slab soffit (5.10): high enough to clear every bit of awning hardware,
    // low enough that it never pushes up into the soffit.
    var overDoorY = doorHead + (slabSoffit - doorHead) * 0.70;

    /* --- rooftop sensor -> Arduino, a short clipped run directly above the
       control station at the terrace-side roof corner --- */
    var runA = [
      parts.sensor.wireAnchor,
      new THREE.Vector3(L.SENSOR_X + 0.12, roofSurfaceY + L.SENSOR_MOUNT_H - 0.008, L.BOX_Z),
      new THREE.Vector3(L.SENSOR_X + 0.17, roofSurfaceY + 0.035, L.BOX_Z),
      new THREE.Vector3(L.SENSOR_X + 0.17, roofCableY, L.BOX_Z),
      new THREE.Vector3(L.UPPER_X1 - 0.02, roofCableY, L.BOX_Z),
      new THREE.Vector3(lane, roofCableY, L.BOX_Z),
      new THREE.Vector3(lane, parts.arduino.anchorSensor.y + 0.16, L.BOX_Z),
      parts.arduino.anchorSensor
    ];
    this.sensorRun = new THREE.Group();
    this.sensorRun.name = 'Cable_Sensor_Run';
    this.group.add(this.sensorRun);
    // Straight segments prevent a spline from bowing above the roof at the edge.
    this._wireSegments(this.sensorRun, runA, 0xaacf3a, 0.014);
    this._clips(this.sensorRun, [
      [L.SENSOR_X + 0.145, roofSurfaceY + 0.10, L.BOX_Z],
      [L.UPPER_X1 - 0.03, roofCableY, L.BOX_Z],
      [lane, parts.arduino.anchorSensor.y + 0.35, L.BOX_Z]
    ], 'Sensor');

    /* --- Arduino -> servo, up and over the door head --- */
    var sa = parts.servo.wireAnchor;
    var runB = [
      parts.arduino.anchorServo,
      new THREE.Vector3(lane, L.COURT_Y + 1.70, L.BOX_Z + 0.20),
      new THREE.Vector3(lane, overDoorY, L.BOX_Z + 0.45),   // rise clear of the door
      new THREE.Vector3(lane, overDoorY, -0.95),            // start of the crossing
      new THREE.Vector3(lane, overDoorY, 1.75),             // end of the crossing
      new THREE.Vector3(lane + 0.06, sa.y + 0.22, 2.05),
      sa
    ];
    this.servoRun = new THREE.Group();
    this.servoRun.name = 'Cable_Servo_Run';
    this.group.add(this.servoRun);
    this._wire(this.servoRun, runB, 0xe08a3c, 0.014);
    this._clips(this.servoRun, [
      [lane, overDoorY, -0.95], [lane, overDoorY, 0.40],
      [lane, overDoorY, 1.75], [lane, L.COURT_Y + 1.70, L.BOX_Z + 0.20]
    ], 'Servo');

    this.overDoorY = overDoorY;
  }

  Wiring.prototype._wire = function (parent, points, color, r) {
    // low tension: the spline hugs its waypoints instead of bowing past them,
    // which is what keeps the run inside the band above the door head
    var curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.15);
    var geo = new THREE.TubeGeometry(curve, 90, r, 6, false);
    var mesh = new THREE.Mesh(geo, std(color, 0.6));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  };

  Wiring.prototype._wireSegments = function (parent, points, color, r) {
    var material = std(color, 0.6);
    for (var i = 0; i < points.length - 1; i++) {
      var curve = new THREE.LineCurve3(points[i], points[i + 1]);
      var mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 16, r, 6, false), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  };

  /** Little saddle clips, so the runs read as properly installed. */
  Wiring.prototype._clips = function (parent, points, tag) {
    var mat = std(0xe8e6e0, 0.7);
    points.forEach(function (p, i) {
      var clip = box(0.05, 0.035, 0.035, mat, 'Cable_Clip_' + tag + '_' + (i + 1));
      clip.position.set(p[0], p[1], p[2]);
      parent.add(clip);
    }, this);
  };

  SRR.RainSensor = RainSensor;
  SRR.Arduino = Arduino;
  SRR.Wiring = Wiring;
}(window.SRR));
