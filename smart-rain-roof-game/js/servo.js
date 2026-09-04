/* SG90 micro servo: mounted on a plate on the outside face of the back wall,
   near the corner, with a bracket reaching over the corner to the canopy hinge.
   Only Servo_Output_Shaft and Servo_Horn rotate; the body stays put.
   setAngle(deg): 0 = roof open, ROOF.SWEEP (90) = roof closed. */
window.SRR = window.SRR || {};

(function (SRR) {
  'use strict';

  var L = SRR.LAYOUT;
  var ROOF = SRR.ROOF;
  var box = SRR.box, cyl = SRR.cyl, std = SRR.std, D2R = SRR.D2R;

  function ServoMotor(scene) {
    this.angle = 0;

    this.group = new THREE.Group();
    this.group.name = 'Servo_SG90';
    scene.add(this.group);

    var blue = std(0x2f6fed, 0.5);
    var darkBlue = std(0x2050c0, 0.5);
    var white = std(0xf2f2ef, 0.55);

    // bolted to the first-floor wall, just below and along from the hinge
    var wallFace = L.UPPER_X1;
    var bodyH = 0.30;
    var bodyTop = ROOF.PIVOT.y - 0.34;
    var bodyCY = bodyTop - bodyH / 2;
    var bodyX = wallFace + 0.20;
    var bodyZ = ROOF.PIVOT.z - 0.42;

    var plate = box(0.06, 0.42, 0.40, std(0xb0b4ba, 0.5, 0.3), 'Servo_Mount_Plate');
    plate.position.set(wallFace + 0.03, bodyCY, bodyZ);
    this.group.add(plate);

    var body = box(0.32, bodyH, 0.30, blue, 'Servo_Body');
    body.position.set(bodyX, bodyCY, bodyZ);
    this.group.add(body);

    var tab = box(0.50, 0.05, 0.10, blue, 'Servo_Tab');
    tab.position.set(bodyX, bodyTop - 0.06, bodyZ);
    this.group.add(tab);

    [-0.21, 0.21].forEach(function (dx) {
      var screw = cyl(0.017, 0.02, std(0x30343c, 0.4, 0.6), '', 8);
      screw.position.set(bodyX + dx, bodyTop - 0.03, bodyZ);
      this.group.add(screw);
    }, this);

    // gearbox cap
    var cap = box(0.30, 0.07, 0.28, darkBlue);
    cap.position.set(bodyX, bodyTop + 0.02, bodyZ);
    this.group.add(cap);

    // drive cover from the body across to the hinge axis
    var hingeX = ROOF.PIVOT.x, hingeZ = ROOF.PIVOT.z;
    var dx = hingeX - bodyX, dz = hingeZ - bodyZ;
    var armLen = Math.hypot(dx, dz) + 0.12;
    var arm = box(armLen, 0.05, 0.07, blue, 'Servo_Bracket');
    arm.position.set((bodyX + hingeX) / 2, bodyTop + 0.06, (bodyZ + hingeZ) / 2);
    arm.rotation.y = Math.atan2(-dz, dx);
    this.group.add(arm);

    // output shaft: runs up the hinge axis to the canopy hub
    var shaftTop = ROOF.PIVOT.y + 0.10;
    var shaftBottom = bodyTop + 0.02;
    var shaftH = shaftTop - shaftBottom;
    this.shaft = cyl(0.035, shaftH, white, 'Servo_Output_Shaft', 16);
    this.shaft.position.set(hingeX, (shaftTop + shaftBottom) / 2, hingeZ);
    this.group.add(this.shaft);

    // horn caps the slat stack so the rotation is readable
    this.horn = cyl(0.075, 0.03, white, 'Servo_Horn', 20);
    this.horn.position.set(hingeX, ROOF.PIVOT.y + 0.13, hingeZ);
    this.group.add(this.horn);

    var hornArm = box(0.24, 0.025, 0.045, white);
    hornArm.position.set(0.09, 0, 0);
    this.horn.add(hornArm);

    this.wireAnchor = new THREE.Vector3(bodyX, bodyCY - 0.10, bodyZ - 0.16);
  }

  ServoMotor.prototype.setAngle = function (deg) {
    this.angle = deg;
    var rot = -deg * D2R;
    this.shaft.rotation.y = rot;
    this.horn.rotation.y = rot;
  };

  SRR.ServoMotor = ServoMotor;
}(window.SRR));
