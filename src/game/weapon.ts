import * as THREE from 'three';

/**
 * First-person composite procedural assault rifle: VX-74 战术突击步枪.
 * 12+ distinct PBR parts with varied metalness/roughness, holographic reflex optic,
 * reciprocating bolt carrier, animated detachable magazine, ammo LED bar,
 * and volumetric muzzle flash.
 */
export class FirstPersonRifle {
  public readonly root = new THREE.Group();
  private readonly gunBody = new THREE.Group();
  private readonly magazineGroup = new THREE.Group();
  private readonly boltMesh: THREE.Mesh;
  private readonly muzzleFlashGroup = new THREE.Group();
  private readonly muzzleLight: THREE.PointLight;
  private readonly muzzleTip = new THREE.Object3D();
  private readonly ejectionPort = new THREE.Object3D();
  private readonly ammoLedMat: THREE.MeshBasicMaterial;
  private readonly reticleMat: THREE.MeshBasicMaterial;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  // Kinematics state
  private recoilKick = 0;
  private recoilPitch = 0;
  private recoilRoll = 0;
  private boltOffset = 0;
  private muzzleFlashTimer = 0;
  private adsBlend = 0;
  private sprintBlend = 0;
  private bobPhase = 0;
  private swayX = 0;
  private swayY = 0;

  // Base poses (camera-space coordinates)
  private readonly hipPos = new THREE.Vector3(0.24, -0.22, -0.44);
  private readonly adsPos = new THREE.Vector3(0.0, -0.146, -0.34);

  constructor() {
    this.root.add(this.gunBody);
    this.root.position.copy(this.hipPos);

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      this.materials.push(m);
      return m;
    };

    // High-contrast tactical PBR materials
    const gunmetalMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2a313b,
        metalness: 0.78,
        roughness: 0.28,
      }),
    );
    const polymerMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1b2028,
        metalness: 0.12,
        roughness: 0.74,
      }),
    );
    const rubberGripMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x13161b,
        metalness: 0.05,
        roughness: 0.9,
      }),
    );
    const chromeSteelMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7c8796,
        metalness: 0.92,
        roughness: 0.18,
      }),
    );
    const accentAmberMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xb45309,
        emissiveIntensity: 0.35,
        metalness: 0.35,
        roughness: 0.35,
      }),
    );
    const opticGlassMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.reticleMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.ammoLedMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
      }),
    );

    // 1. Upper & Lower Sculpted Receiver
    const upperReceiver = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.068, 0.086, 0.34)), gunmetalMat);
    upperReceiver.position.set(0, 0.012, -0.02);
    this.gunBody.add(upperReceiver);

    const lowerReceiver = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.058, 0.22)), polymerMat);
    lowerReceiver.position.set(0, -0.044, 0.02);
    this.gunBody.add(lowerReceiver);

    // Tactical amber accent stripe on receiver flank
    const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.072, 0.012, 0.16)), accentAmberMat);
    stripe.position.set(0, 0.018, -0.03);
    this.gunBody.add(stripe);

    // 2. Ventilated Shroud Handguard
    const handguard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.064, 0.074, 0.29)), polymerMat);
    handguard.position.set(0, 0.01, -0.32);
    this.gunBody.add(handguard);

    // Side cooling vents
    const ventGeo = trackGeo(new THREE.BoxGeometry(0.068, 0.012, 0.028));
    for (let i = 0; i < 4; i++) {
      const vent = new THREE.Mesh(ventGeo, chromeSteelMat);
      vent.position.set(0, 0.018, -0.22 - i * 0.055);
      this.gunBody.add(vent);
    }

    // 3. Top Picatinny Rail
    const railBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.038, 0.014, 0.56)), gunmetalMat);
    railBase.position.set(0, 0.06, -0.15);
    this.gunBody.add(railBase);

    // 4. Holographic Reflex Optic Housing + Translucent Glass + Glowing Dot/Ring Reticle
    const opticGroup = new THREE.Group();
    opticGroup.position.set(0, 0.11, -0.04);

    const opticBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.048, 0.022, 0.1)), gunmetalMat);
    opticBase.position.y = -0.036;
    const opticLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.008, 0.056, 0.075)), gunmetalMat);
    opticLeft.position.set(-0.026, 0, 0);
    const opticRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.008, 0.056, 0.075)), gunmetalMat);
    opticRight.position.set(0.026, 0, 0);
    const opticTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.008, 0.075)), gunmetalMat);
    opticTop.position.set(0, 0.028, 0);
    const opticGlass = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.046, 0.048)), opticGlassMat);
    opticGlass.position.set(0, 0.002, 0);
    const reticleDot = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.0028, 12)), this.reticleMat);
    reticleDot.position.set(0, 0.002, 0.002);
    const reticleRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(0.009, 0.011, 20)), this.reticleMat);
    reticleRing.position.set(0, 0.002, 0.002);

    opticGroup.add(opticBase, opticLeft, opticRight, opticTop, opticGlass, reticleDot, reticleRing);
    this.gunBody.add(opticGroup);

    // 5. Fluted Steel Barrel + Tactical Muzzle Brake
    const barrel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.015, 0.017, 0.24, 12)),
      chromeSteelMat,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.018, -0.54);
    this.gunBody.add(barrel);

    const muzzleBrake = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.02, 0.075, 10)),
      gunmetalMat,
    );
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.018, -0.66);
    this.gunBody.add(muzzleBrake);

    // Front iron sight post
    const frontSight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.038, 0.018)), gunmetalMat);
    frontSight.position.set(0, 0.08, -0.44);
    this.gunBody.add(frontSight);

    // 6. Ergonomic Pistol Grip & Angled Foregrip
    const pistolGrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.044, 0.12, 0.056)), rubberGripMat);
    pistolGrip.position.set(0, -0.11, 0.09);
    pistolGrip.rotation.x = 0.26;
    this.gunBody.add(pistolGrip);

    const foregrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.036, 0.085, 0.044)), rubberGripMat);
    foregrip.position.set(0, -0.064, -0.34);
    foregrip.rotation.x = -0.32;
    this.gunBody.add(foregrip);

    // 7. Tactical Stock + Cheek Rest
    const stock = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.054, 0.088, 0.24)), polymerMat);
    stock.position.set(0, -0.008, 0.24);
    this.gunBody.add(stock);

    // 8. Reciprocating Bolt Carrier (right flank)
    this.boltMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.016, 0.024, 0.09)), chromeSteelMat);
    this.boltMesh.position.set(0.034, 0.022, -0.04);
    this.gunBody.add(this.boltMesh);

    // 9. Detachable Curved Magazine (pivots cleanly during reload)
    const magUpper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.038, 0.12, 0.068)), polymerMat);
    magUpper.position.set(0, -0.11, -0.07);
    magUpper.rotation.x = -0.14;
    const magLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.042, 0.03, 0.072)), gunmetalMat);
    magLower.position.set(0, -0.17, -0.08);
    magLower.rotation.x = -0.14;
    this.magazineGroup.add(magUpper, magLower);
    this.gunBody.add(this.magazineGroup);

    // 10. Side Micro LED Ammo Status Bar (left side, clearly visible to player)
    const ledFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.01, 0.022, 0.076)), rubberGripMat);
    ledFrame.position.set(-0.036, 0.032, 0.04);
    const ledStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.011, 0.064)), this.ammoLedMat);
    ledStrip.position.set(-0.037, 0.032, 0.04);
    this.gunBody.add(ledFrame, ledStrip);

    // 11. Tactical Gloved Support Hand Suggestion
    const gloveMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x262c34,
        roughness: 0.85,
        metalness: 0.08,
      }),
    );
    const leftHand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.062, 0.056, 0.078)), gloveMat);
    leftHand.position.set(-0.022, -0.052, -0.34);
    const forearm = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.036, 0.044, 0.24, 8)), gloveMat);
    forearm.rotation.x = Math.PI / 2 - 0.35;
    forearm.rotation.z = -0.35;
    forearm.position.set(-0.1, -0.14, -0.2);
    this.gunBody.add(leftHand, forearm);

    // 12. Muzzle Tip, Ejection Port, & Crossed Volumetric Muzzle Flash
    this.muzzleTip.position.set(0, 0.018, -0.71);
    this.gunBody.add(this.muzzleTip);

    this.ejectionPort.position.set(0.048, 0.026, -0.05);
    this.gunBody.add(this.ejectionPort);

    const flashMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffd27d,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const coreMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );

    const planeGeo = trackGeo(new THREE.PlaneGeometry(0.24, 0.14));
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(planeGeo, flashMat);
      p.rotation.z = (i * Math.PI) / 3;
      this.muzzleFlashGroup.add(p);
    }
    const core = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.042, 8, 8)), coreMat);
    this.muzzleFlashGroup.add(core);
    this.muzzleFlashGroup.position.copy(this.muzzleTip.position);
    this.muzzleFlashGroup.visible = false;
    this.gunBody.add(this.muzzleFlashGroup);

    this.muzzleLight = new THREE.PointLight(0xffb454, 0, 7.5, 2);
    this.muzzleLight.position.set(0, 0.04, -0.75);
    this.gunBody.add(this.muzzleLight);
  }

  public triggerFire(ads: boolean): void {
    const mult = ads ? 0.52 : 1.0;
    this.recoilKick = Math.min(this.recoilKick + 0.058 * mult, 0.12);
    this.recoilPitch = Math.min(this.recoilPitch + 0.085 * mult, 0.22);
    this.recoilRoll = (Math.random() - 0.5) * 0.09 * mult;
    this.boltOffset = 0.068;
    this.muzzleFlashTimer = 0.045;
    this.muzzleFlashGroup.visible = true;
    this.muzzleFlashGroup.rotation.z = Math.random() * Math.PI;
    const s = 0.85 + Math.random() * 0.45;
    this.muzzleFlashGroup.scale.set(s, s, s);
    this.muzzleLight.intensity = 6.0;
  }

  public addLookSway(dx: number, dy: number): void {
    this.swayX = THREE.MathUtils.clamp(this.swayX - dx * 0.00018, -0.026, 0.026);
    this.swayY = THREE.MathUtils.clamp(this.swayY + dy * 0.00018, -0.02, 0.02);
  }

  public getMuzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    this.muzzleTip.getWorldPosition(out);
    return out;
  }

  public getEjectionWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    this.ejectionPort.getWorldPosition(out);
    return out;
  }

  public update(
    dt: number,
    opts: {
      isAds: boolean;
      isSprinting: boolean;
      isGrounded: boolean;
      moveSpeedRatio: number;
      isReloading: boolean;
      reloadProgress: number;
      ammoRatio: number;
    },
  ): void {
    // Smooth exponential damping for ADS & Sprint states
    const targetAds = opts.isAds && !opts.isReloading ? 1 : 0;
    const targetSprint = opts.isSprinting && !opts.isAds && !opts.isReloading && opts.moveSpeedRatio > 0.2 ? 1 : 0;

    this.adsBlend = THREE.MathUtils.damp(this.adsBlend, targetAds, 14, dt);
    this.sprintBlend = THREE.MathUtils.damp(this.sprintBlend, targetSprint, 10, dt);

    // Recoil & bolt recovery
    this.recoilKick = THREE.MathUtils.damp(this.recoilKick, 0, 18, dt);
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 16, dt);
    this.recoilRoll = THREE.MathUtils.damp(this.recoilRoll, 0, 16, dt);
    this.boltOffset = THREE.MathUtils.damp(this.boltOffset, 0, 28, dt);
    this.swayX = THREE.MathUtils.damp(this.swayX, 0, 10, dt);
    this.swayY = THREE.MathUtils.damp(this.swayY, 0, 10, dt);

    this.boltMesh.position.z = -0.04 + this.boltOffset;

    // Muzzle flash decay
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashGroup.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }

    // Update ammo LED color
    if (opts.ammoRatio <= 0.2) {
      this.ammoLedMat.color.setHex(0xef4444);
    } else if (opts.ammoRatio <= 0.45) {
      this.ammoLedMat.color.setHex(0xf59e0b);
    } else {
      this.ammoLedMat.color.setHex(0x22d3ee);
    }
    this.reticleMat.opacity = 0.55 + this.adsBlend * 0.45;

    // Walking / sprinting figure-8 bob
    if (opts.isGrounded && opts.moveSpeedRatio > 0.05) {
      this.bobPhase += dt * (opts.isSprinting ? 12.5 : 8.5) * Math.min(opts.moveSpeedRatio, 1.2);
    }
    const bobAmp = (opts.isGrounded ? opts.moveSpeedRatio : 0.1) * (1 - this.adsBlend * 0.82);
    const bobX = Math.cos(this.bobPhase) * 0.011 * bobAmp;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.012 * bobAmp;

    // Interpolate base position between hip and ADS
    this.root.position.lerpVectors(this.hipPos, this.adsPos, this.adsBlend);
    this.root.position.x += bobX + this.swayX * (1 - this.adsBlend * 0.7) - this.sprintBlend * 0.05;
    this.root.position.y += -bobY + this.swayY * (1 - this.adsBlend * 0.7) - this.sprintBlend * 0.045;
    this.root.position.z += this.recoilKick;

    // Base rotations (sprint cant + recoil)
    let rotX = this.recoilPitch - this.sprintBlend * 0.16;
    let rotY = this.sprintBlend * 0.44 + this.swayX * 1.4;
    let rotZ = this.recoilRoll + this.sprintBlend * 0.14 - this.swayX * 2.2;

    // 3-Stage Reload Animation
    let magDropY = 0;
    if (opts.isReloading) {
      const p = opts.reloadProgress;
      const tilt = Math.sin(Math.min(p * Math.PI, Math.PI));
      rotZ += tilt * 0.52;
      rotX += tilt * 0.18;
      this.root.position.y -= tilt * 0.04;

      if (p < 0.35) {
        // Drop old mag
        magDropY = -(p / 0.35) * 0.28;
      } else if (p < 0.72) {
        // Insert fresh mag
        const t = (p - 0.35) / 0.37;
        magDropY = -(1 - t) * 0.28;
      } else {
        // Bolt rack kick
        const t = (p - 0.72) / 0.28;
        this.boltMesh.position.z = -0.04 + Math.sin(t * Math.PI) * 0.07;
      }
    }

    this.magazineGroup.position.y = magDropY;
    this.gunBody.rotation.set(rotX, rotY, rotZ);
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
