/* Two teaching modes.
 *
 * BuildGuide — walks a child through assembling the whole project one step at a
 * time. The house, drying rack and washing form the starting problem; each step
 * switches on one protection-system part, moves the camera to it, and explains
 * what to do. The last step hands the finished rig to the simulation for testing.
 *
 * ExplodedView — pulls every assembly apart into the air along its own direction,
 * holding each piece in place with a label so it can be pointed at and explained.
 */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  var L = SRR.LAYOUT;

  /* ================= step-by-step assembly ================= */

  /**
   * @param parts   the scene assemblies
   * @param preset  'workshop' (default) walks every fitting one at a time, which
   *                is what the sandbox page uses. 'kit' collapses them into the
   *                eight steps printed on the physical kit, used by the lesson.
   */
  function BuildGuide(parts, preset) {
    this.p = parts;
    this.active = false;
    this.index = 0;
    // `index` is the step currently being explained. `placedThrough` is the
    // last step the learner has actually committed. Keeping these separate is
    // what prevents a new part from appearing behind its own dialogue.
    this.placedThrough = -1;
    this.preset = preset || 'workshop';

    var p = parts;

    /* The eight hands-on steps, in the order the kit is actually assembled. */
    var KIT_STEPS = [
      {
        title: 'Open the House Model',
        need: ['House model with rack and washing ready'],
        say: 'Stand the house model on the table. Upstairs on the right is an open '
           + 'court with no roof — that is where the washing hangs, and where the '
           + 'rain gets in.',
        show: [],
        view: 'court'
      },
      {
        title: 'Place the Servo Motor',
        need: ['SG90 servo', 'Hinge plate', '2 brackets', 'Hinge pin'],
        say: 'Screw the hinge plate high on the court wall, just above the door, and '
           + 'bolt the little blue servo beside it so its shaft lines up with the '
           + 'pin. The servo is the muscle of the whole machine.',
        show: [p.roof.hinge, p.servo.group],
        view: 'servo'
      },
      {
        title: 'Attach the Paper Roof',
        need: ['12 paper pleats', '12 ribs', 'Front bar', 'Linkage rod'],
        say: 'Slide the pleats onto the pin one after another, then join the outside '
           + 'pleat to the servo with the rod. Fold it shut — the whole roof should '
           + 'collapse into a slim bundle against the wall.',
        show: [p.roof.root, p.roof.rod],
        view: 'canopy'
      },
      {
        title: 'Place the Rain Sensor',
        need: ['Rain sensor board', '17 cm tapered mount', 'Mounting screws'],
        say: 'Fix the shaped mount at the roof corner above the Arduino, then place '
           + 'the sensor on top. The short 17 cm rise catches drops early while its '
           + 'wide base stays stable. Keep the copper tracks facing the sky.',
        show: [p.sensor.group],
        view: 'sensor'
      },
      {
        title: 'Mount the Arduino',
        need: ['Backboard', '4 screws', 'Arduino Uno'],
        say: 'Screw the flat backboard to the wall well away from the doorway, then '
           + 'fix the Arduino onto it. This is the brain — it watches the sensor and '
           + 'tells the servo when to move.',
        show: [p.arduino.mount, p.arduino.board],
        view: 'electronics'
      },
      {
        title: 'Connect the Wires',
        need: ['Green cable', 'Orange cable', '7 clips'],
        say: 'Green cable from the sensor to the Arduino, clipped flat along the roof edge. '
           + 'Orange cable from the Arduino to the servo, up the wall and across '
           + 'ABOVE the door — never straight across the doorway.',
        show: [p.wiring.sensorRun, p.wiring.servoRun],
        view: 'electronics'
      },
      {
        title: 'Insert the Battery',
        need: ['Mini breadboard', '9V battery', 'Red and black leads'],
        say: 'Clip the breadboard under the Arduino and stand the 9V battery beside '
           + 'it. Red lead to plus, black lead to minus. Check it twice before you '
           + 'connect the battery.',
        show: [p.arduino.bread, p.arduino.battery],
        view: 'electronics'
      },
      {
        title: "It's Working!",
        need: ['A watering can, or the rain button'],
        say: 'Done! Make it rain and watch the order: the sensor LED goes red, the '
           + 'Arduino LED blinks, the servo turns, and the roof fans out over the '
           + 'washing. Let it dry and it folds itself away again.',
        show: [],
        view: 'court',
        handOver: true
      }
    ];

    /* Six classroom-sized stages. Each stage answers one engineering question
       and reveals a complete functional sub-assembly, so the learner sees a
       clear cause-and-effect story without twelve tiny interruptions. */
    var WORKSHOP_STEPS = [
      {
        title: 'Spot the problem',
        need: ['Rack and clothes already in place'],
        say: 'The rack and clothes are already outside. Sun can reach them, but rain '
           + 'can reach them too. We will keep this setup in place and build one '
           + 'automatic protection system around it.',
        show: [],
        view: 'house'
      },
      {
        title: 'Install the moving joint',
        need: ['Wall hinge', 'SG90 servo', 'Mounting screws'],
        say: 'Fix the hinge above the terrace door, then place the blue servo beside '
           + 'it. The hinge lets the roof turn; the servo supplies the force. Check '
           + 'that both shafts line up before moving on.',
        show: [p.roof.hinge, p.servo.group],
        view: 'servo'
      },
      {
        title: 'Fit the folding roof',
        need: ['12 roof pleats', 'Front bar', 'Linkage rod'],
        say: 'Thread the folding roof onto the hinge and connect its front bar to '
           + 'the servo with the blue linkage rod. When the servo turns, the pleats '
           + 'fan out together over the clothes.',
        show: [p.roof.root, p.roof.rod],
        view: 'canopy'
      },
      {
        title: 'Place the sensor on the roof',
        need: ['Rain sensor board', '17 cm tapered mount', 'Mounting screws'],
        say: 'Raise the rain sensor about 17 cm on the shaped mount at the roof '
           + 'corner, directly above the control station. Its tracks face the open '
           + 'sky and the wide base keeps the short stand stable.',
        show: [p.sensor.group],
        view: 'sensor'
      },
      {
        title: 'Build the control station',
        need: ['Backboard', 'Arduino Uno', 'Breadboard', '9V battery'],
        say: 'Fix the backboard beside the terrace, then mount the Arduino, '
           + 'breadboard and battery on it. The Arduino is the brain; the battery '
           + 'provides power. Check red to positive and black to negative.',
        show: [p.arduino.mount, p.arduino.board, p.arduino.bread, p.arduino.battery],
        view: 'electronics'
      },
      {
        title: 'Connect, code and test',
        need: ['Green sensor cable', 'Orange servo cable', 'Arduino sketch'],
        say: 'Guide the green cable down the mount, then clip it flat to the roof and wall on its way to the Arduino. Then run the '
           + 'orange cable from the Arduino to the servo. The hardware is ready. '
           + 'Next, discover the two code values that make the roof protect every '
           + 'piece of clothing in time.',
        show: [p.wiring.sensorRun, p.wiring.servoRun],
        view: 'court',
        handOver: true
      }
    ];

    this.steps = (this.preset === 'kit') ? KIT_STEPS : WORKSHOP_STEPS;

    // The rack and clothes are the real-life problem, not construction parts.
    // They remain visible from the first frame and are excluded from the guide.
    this.baseVisible = [p.rack.frame, p.rack.washing];

    // Everything the guide can switch on, hidden until its step arrives.
    this.managed = [];
    this.steps.forEach(function (s) {
      s.show.forEach(function (o) { if (o && this.managed.indexOf(o) < 0) { this.managed.push(o); } }, this);
    }, this);
  }

  BuildGuide.prototype.count = function () { return this.steps.length; };
  BuildGuide.prototype.step = function () { return this.steps[this.index]; };
  BuildGuide.prototype.atEnd = function () { return this.index >= this.steps.length - 1; };

  /** Show only what the learner has explicitly fitted. */
  BuildGuide.prototype._applyVisibility = function () {
    var fitted = [];
    for (var i = 0; i <= this.placedThrough; i++) {
      this.steps[i].show.forEach(function (o) { if (o) { fitted.push(o); } });
    }
    this.managed.forEach(function (o) { o.visible = fitted.indexOf(o) >= 0; });
    this.baseVisible.forEach(function (o) { if (o) { o.visible = true; } });
  };

  /** Prime the scene before the start screen leaves: house only, no kit parts. */
  BuildGuide.prototype.reset = function () {
    this.active = false;
    this.index = 0;
    this.placedThrough = -1;
    this._applyVisibility();
  };

  BuildGuide.prototype.enter = function () {
    this.active = true;
    this.index = 0;
    this.placedThrough = -1;
    this._applyVisibility();
    return this.step();
  };

  /** Prepare dialogue/camera for a step without revealing its objects. */
  BuildGuide.prototype.prepare = function (i) {
    this.index = SRR.clamp(i, 0, this.steps.length - 1);
    this._applyVisibility();
    return this.step();
  };

  /** Commit exactly the current step and return the objects that were added. */
  BuildGuide.prototype.placeCurrent = function () {
    if (!this.active) { return []; }
    this.placedThrough = Math.max(this.placedThrough, this.index);
    this._applyVisibility();
    return this.step().show.slice();
  };

  /** Leave build mode: everything on, ready to run. */
  BuildGuide.prototype.exit = function () {
    this.active = false;
    this.placedThrough = this.steps.length - 1;
    this.managed.forEach(function (o) { o.visible = true; });
  };

  /* Legacy helpers retain their original reveal-on-navigation behaviour for
     any external lesson pages, while this game uses prepare/placeCurrent. */
  BuildGuide.prototype.go = function (i) {
    this.index = SRR.clamp(i, 0, this.steps.length - 1);
    this.placedThrough = this.index;
    this._applyVisibility();
    return this.step();
  };

  BuildGuide.prototype.next = function () { return this.go(this.index + 1); };
  BuildGuide.prototype.prev = function () { return this.go(this.index - 1); };

  BuildGuide.prototype.visibleCount = function () {
    var n = 0;
    this.managed.forEach(function (o) { if (o.visible) { n++; } });
    return n;
  };

  /* ================= exploded view ================= */

  /**
   * Each entry: the object to move, the direction to move it, how far, and the
   * words that explain it while it hangs there.
   */
  function ExplodedView(parts) {
    var p = parts;
    this.amount = 0;
    this.target = 0;

    this.items = [
      { obj: p.roof.root, dir: [0.30, 1.00, 0.10], dist: 2.0,
        label: 'Folding awning — 12 pleats',
        note: 'Twelve fabric pleats on one pin. Folds to a bundle, opens to a quarter circle.' },
      { obj: p.roof.hinge, dir: [-0.15, 1.00, 0.00], dist: 1.15,
        label: 'Hinge: plate, brackets, pin',
        note: 'Bolted to the wall. Everything the awning does turns on this pin.' },
      { obj: p.servo.group, dir: [0.55, 0.55, 0.60], dist: 1.45,
        label: 'SG90 servo motor',
        note: 'Turns 0 to 90 degrees when the Arduino tells it to. The muscle.' },
      { obj: p.arduino.mount, dir: [1.00, 0.00, -0.25], dist: 0.95,
        label: 'Backboard',
        note: 'Keeps all the electronics tidy and off the floor.' },
      { obj: p.arduino.board, dir: [1.00, 0.55, -0.25], dist: 1.55,
        label: 'Arduino Uno',
        note: 'The brain. Reads the sensor, waits a moment, then drives the servo.' },
      { obj: p.arduino.bread, dir: [1.00, -0.40, -0.25], dist: 1.55,
        label: 'Mini breadboard',
        note: 'Where the jumper wires join up without any soldering.' },
      { obj: p.arduino.battery, dir: [1.00, 0.10, 0.50], dist: 1.65,
        label: '9V battery',
        note: 'Power for the board and the servo. Red to plus, black to minus.' },
      { obj: p.sensor.group, dir: [0.15, 1.00, -0.10], dist: 1.25,
        label: 'Rain sensor board',
        note: 'Water bridges the metal tracks, so the board tells the Arduino it is wet.' },
      { obj: p.wiring.sensorRun, dir: [0.30, 0.95, -0.35], dist: 1.35,
        label: 'Sensor cable (green)',
        note: 'Clipped flat to the roof and wall — never floating or crossing the floor.' },
      { obj: p.wiring.servoRun, dir: [0.35, 1.00, 0.45], dist: 1.35,
        label: 'Servo cable (orange)',
        note: 'Crosses above the door head, so the doorway stays clear.' },
      { obj: p.rack.frame, dir: [0.45, 0.35, 0.70], dist: 1.30,
        label: 'Drying rack',
        note: 'Metal rails for the washing. Stands in the sun, under the awning sweep.' },
      { obj: p.rack.washing, dir: [0.45, 0.80, 0.85], dist: 1.95,
        label: 'The washing',
        note: 'What the whole project exists to keep dry.' }
    ];

    var box = new THREE.Box3(), centre = new THREE.Vector3();
    this.items.forEach(function (it) {
      it.home = it.obj.position.clone();
      it.vec = new THREE.Vector3(it.dir[0], it.dir[1], it.dir[2]).normalize()
                 .multiplyScalar(it.dist);

      // Anchor the label on the part's visible centre, not its group origin.
      // Several of these groups keep their origin at the world origin and place
      // their children absolutely, so origin-based labels would float off in the
      // garden. Since the parts only ever translate, one offset measured now
      // stays correct for the whole animation.
      box.setFromObject(it.obj).getCenter(centre);
      it.centreOffset = centre.clone().sub(it.obj.position);
      it.anchor = centre.clone();
    });

    // pleats also fan apart vertically, so all twelve can be counted
    this.pleats = p.roof.slats.map(function (s, i) {
      return { obj: s, homeY: s.position.y, lift: i * 0.105 };
    });
  }

  ExplodedView.prototype.setOpen = function (v) { this.target = v ? 1 : 0; };
  ExplodedView.prototype.isOpen = function () { return this.target > 0.5; };

  ExplodedView.prototype.update = function (dt) {
    var d = this.target - this.amount;
    if (Math.abs(d) > 0.0005) {
      this.amount += Math.sign(d) * Math.min(Math.abs(d), dt * 0.9);
    } else {
      this.amount = this.target;
    }
    var t = SRR.easeInOutCubic(this.amount);

    this.items.forEach(function (it) {
      it.obj.position.copy(it.home).addScaledVector(it.vec, t);
      it.anchor.copy(it.obj.position).add(it.centreOffset);
    });
    this.pleats.forEach(function (pl) {
      pl.obj.position.y = pl.homeY + pl.lift * t;
    });
    return t;
  };

  /** World anchor points + text for the floating labels. */
  ExplodedView.prototype.callouts = function () {
    return this.items.map(function (it) {
      return { at: it.anchor, label: it.label, note: it.note };
    });
  };

  SRR.BuildGuide = BuildGuide;
  SRR.ExplodedView = ExplodedView;
}(window.SRR));
