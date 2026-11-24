import * as THREE from 'three';
import type { ColliderBox } from './types';

export type BotArchetype = 'standard' | 'skirmisher' | 'heavy';

interface BotSpec {
  type: BotArchetype;
  name: string;
  maxHp: number;
  speed: number;
  score: number;
  damage: number;
  fireCooldown: number;
  scale: number;
  armorHex: number;
  accentHex: number;
}

const BOT_SPECS: Record<BotArchetype, BotSpec> = {
  standard: {
    type: 'standard',
    name: '标准训练靶机',
    maxHp: 100,
    speed: 3.4,
    score: 100,
    damage: 9,
    fireCooldown: 2.2,
    scale: 1.0,
    armorHex: 0x3b4452,
    accentHex: 0xf59e0b,
  },
  skirmisher: {
    type: 'skirmisher',
    name: '机动突击靶机',
    maxHp: 75,
    speed: 4.9,
    score: 140,
    damage: 7,
    fireCooldown: 1.85,
    scale: 0.94,
    armorHex: 0x263140,
    accentHex: 0x22d3ee,
  },
  heavy: {
    type: 'heavy',
    name: '重装防爆靶机',
    maxHp: 185,
    speed: 2.35,
    score: 220,
    damage: 14,
    fireCooldown: 2.6,
    scale: 1.15,
    armorHex: 0x454d40,
    accentHex: 0xf97316,
  },
};

export interface BotInstance {
  id: number;
  spec: BotSpec;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  armGroup: THREE.Group;
  muzzlePoint: THREE.Object3D;
  muzzleGlow: THREE.Mesh;
  hpBarGroup: THREE.Group;
  hpFillMesh: THREE.Mesh;
  hpFillMat: THREE.MeshBasicMaterial;
  armorMat: THREE.MeshStandardMaterial;
  visorMat: THREE.MeshStandardMaterial;
  hitMeshes: THREE.Object3D[];
  hp: number;
  alive: boolean;
  respawnTimer: number;
  waypoint: THREE.Vector3;
  strafeDir: number;
  strafeTimer: number;
  fireTimer: number;
  chargeTimer: number;
  charging: boolean;
  hitFlashTimer: number;
  knockbackPitch: number;
  stridePhase: number;
}

export interface BotShotEvent {
  origin: THREE.Vector3;
  targetPos: THREE.Vector3;
  hitPlayer: boolean;
  damage: number;
}

export interface BotDamageResult {
  hit: boolean;
  killed: boolean;
  headshot: boolean;
  botName: string;
  baseScore: number;
  worldCenter: THREE.Vector3;
}

/**
 * Manages composite articulated tactical training bots with lane patrol,
 * strafing, line-of-sight awareness, attack telegraphs, headshot hitboxes,
 * and wave-based archetype scaling.
 */
export class BotManager {
  public readonly group = new THREE.Group();
  public readonly bots: BotInstance[] = [];
  public readonly allHitMeshes: THREE.Object3D[] = [];

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly sharedMaterials: THREE.Material[] = [];
  private readonly darkMetalMat: THREE.MeshStandardMaterial;
  private readonly gunMetalMat: THREE.MeshStandardMaterial;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly hpBgMat: THREE.MeshBasicMaterial;

  private readonly spawns: THREE.Vector3[];
  private readonly waypoints: THREE.Vector3[];
  private readonly colliders: ColliderBox[];
  private readonly arenaHalf: number;

  // Reusable scratch math objects (zero per-frame allocations)
  private readonly _toPlayer = new THREE.Vector3();
  private readonly _toWaypoint = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _rayOrigin = new THREE.Vector3();
  private readonly _rayDir = new THREE.Vector3();
  private readonly _raycaster = new THREE.Raycaster();
  private readonly _muzzlePos = new THREE.Vector3();
  private readonly _shotTarget = new THREE.Vector3();

  private nextBotId = 1;

  constructor(
    spawns: THREE.Vector3[],
    waypoints: THREE.Vector3[],
    colliders: ColliderBox[],
    arenaHalf: number,
    contactShadowTex: THREE.CanvasTexture,
  ) {
    this.spawns = spawns;
    this.waypoints = waypoints;
    this.colliders = colliders;
    this.arenaHalf = arenaHalf;

    this.darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1d232c,
      metalness: 0.72,
      roughness: 0.34,
    });
    this.gunMetalMat = new THREE.MeshStandardMaterial({
      color: 0x2c3440,
      metalness: 0.82,
      roughness: 0.25,
    });
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    });
    this.hpBgMat = new THREE.MeshBasicMaterial({
      color: 0x0f141c,
      side: THREE.DoubleSide,
    });
    this.sharedMaterials.push(this.darkMetalMat, this.gunMetalMat, this.shadowMat, this.hpBgMat);

    // Pre-build 6 reusable bot slots
    for (let i = 0; i < 6; i++) {
      const bot = this.createBot(i === 5 ? 'heavy' : i >= 3 ? 'skirmisher' : 'standard');
      this.bots.push(bot);
      this.group.add(bot.root);
      this.allHitMeshes.push(...bot.hitMeshes);
    }
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private createBot(type: BotArchetype): BotInstance {
    const id = this.nextBotId++;
    const spec = BOT_SPECS[type];
    const root = new THREE.Group();
    const bodyPivot = new THREE.Group();
    root.add(bodyPivot);

    const armorMat = new THREE.MeshStandardMaterial({
      color: spec.armorHex,
      metalness: 0.35,
      roughness: 0.58,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: spec.accentHex,
      emissive: spec.accentHex,
      emissiveIntensity: 0.85,
      metalness: 0.2,
      roughness: 0.22,
    });
    const muzzleGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff5252,
      transparent: true,
      opacity: 0.9,
    });
    const hpFillMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
    });

    const hitMeshes: THREE.Object3D[] = [];
    const tagHitbox = (mesh: THREE.Mesh, part: 'body' | 'head') => {
      mesh.userData.botId = id;
      mesh.userData.hitbox = part;
      hitMeshes.push(mesh);
    };

    // 1. Contact shadow disc grounded at y = 0.02
    const shadow = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(1.15, 1.15)), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    root.add(shadow);

    // 2. Articulated Left & Right Legs (pivoted near hip)
    const legGeo = this.trackGeo(new THREE.BoxGeometry(0.22, 0.78, 0.24));
    legGeo.translate(0, -0.39, 0);
    const leftLeg = new THREE.Mesh(legGeo, this.darkMetalMat);
    leftLeg.position.set(-0.18, 0.8, 0);
    leftLeg.castShadow = true;
    tagHitbox(leftLeg, 'body');

    const rightLeg = new THREE.Mesh(legGeo, this.darkMetalMat);
    rightLeg.position.set(0.18, 0.8, 0);
    rightLeg.castShadow = true;
    tagHitbox(rightLeg, 'body');
    bodyPivot.add(leftLeg, rightLeg);

    // 3. Pelvis & Armored Torso Chest Hull
    const pelvis = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.56, 0.2, 0.32)), this.darkMetalMat);
    pelvis.position.set(0, 0.86, 0);
    pelvis.castShadow = true;
    tagHitbox(pelvis, 'body');

    const torso = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.66, 0.62, 0.38)), armorMat);
    torso.position.set(0, 1.24, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    tagHitbox(torso, 'body');

    // 4. Chest Tactical Armor Plate + Emissive Core Strip
    const chestPlate = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.54, 0.36, 0.1)), this.darkMetalMat);
    chestPlate.position.set(0, 1.3, 0.2);
    tagHitbox(chestPlate, 'body');

    const coreStrip = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.26, 0.09, 0.06)), visorMat);
    coreStrip.position.set(0, 1.32, 0.25);

    // 5. Shoulder Pauldrons (wider tactical silhouette)
    const pauldronGeo = this.trackGeo(new THREE.BoxGeometry(0.24, 0.24, 0.34));
    const leftPauldron = new THREE.Mesh(pauldronGeo, armorMat);
    leftPauldron.position.set(-0.44, 1.44, 0);
    leftPauldron.castShadow = true;
    tagHitbox(leftPauldron, 'body');

    const rightPauldron = new THREE.Mesh(pauldronGeo, armorMat);
    rightPauldron.position.set(0.44, 1.44, 0);
    rightPauldron.castShadow = true;
    tagHitbox(rightPauldron, 'body');

    // Left support arm
    const leftArm = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.18, 0.5, 0.18)), this.darkMetalMat);
    leftArm.position.set(-0.43, 1.12, 0.12);
    leftArm.rotation.x = -0.45;
    leftArm.castShadow = true;
    tagHitbox(leftArm, 'body');

    // 6. Right Weapon Arm + Procedural Training Carbine + Telegraph Muzzle Glow
    const armGroup = new THREE.Group();
    armGroup.position.set(0.42, 1.34, 0.06);

    const rightArm = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.18, 0.2, 0.46)), this.darkMetalMat);
    rightArm.position.set(0, -0.04, 0.22);
    rightArm.castShadow = true;
    tagHitbox(rightArm, 'body');

    const carbineBody = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.11, 0.16, 0.62)), this.gunMetalMat);
    carbineBody.position.set(-0.04, -0.02, 0.52);
    carbineBody.castShadow = true;

    const carbineBarrel = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.025, 0.028, 0.32, 8)),
      this.darkMetalMat,
    );
    carbineBarrel.rotation.x = Math.PI / 2;
    carbineBarrel.position.set(-0.04, 0.01, 0.92);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(-0.04, 0.01, 1.1);

    const muzzleGlow = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.095, 8, 8)), muzzleGlowMat);
    muzzleGlow.position.copy(muzzlePoint.position);
    muzzleGlow.visible = false;

    armGroup.add(rightArm, carbineBody, carbineBarrel, muzzlePoint, muzzleGlow);

    // 7. Distinct Armored Tactical Helmet + Glowing Visor (Headshot Critical Hitbox!)
    const neck = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 8)), this.darkMetalMat);
    neck.position.set(0, 1.6, 0);

    const head = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.36, 0.36, 0.38)), armorMat);
    head.position.set(0, 1.82, 0);
    head.castShadow = true;
    tagHitbox(head, 'head');

    const visor = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.32, 0.12, 0.06)), visorMat);
    visor.position.set(0, 1.84, 0.18);
    tagHitbox(visor, 'head');

    const antenna = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.014, 0.018, 0.24, 6)), this.darkMetalMat);
    antenna.position.set(-0.16, 2.06, -0.08);

    bodyPivot.add(pelvis, torso, chestPlate, coreStrip, leftPauldron, rightPauldron, leftArm, armGroup, neck, head, visor, antenna);

    // 8. Floating Diegetic Health Bar (visible once damaged)
    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.set(0, 2.34, 0);
    const hpBg = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(0.84, 0.1)), this.hpBgMat);
    const hpFillGeo = this.trackGeo(new THREE.PlaneGeometry(0.78, 0.06));
    hpFillGeo.translate(0.39, 0, 0); // Anchor left edge for clean horizontal scaling
    const hpFillMesh = new THREE.Mesh(hpFillGeo, hpFillMat);
    hpFillMesh.position.set(-0.39, 0, 0.005);
    hpBarGroup.add(hpBg, hpFillMesh);
    hpBarGroup.visible = false;
    root.add(hpBarGroup);

    root.scale.setScalar(spec.scale);
    root.visible = false;

    return {
      id,
      spec,
      root,
      bodyPivot,
      leftLeg,
      rightLeg,
      armGroup,
      muzzlePoint,
      muzzleGlow,
      hpBarGroup,
      hpFillMesh,
      hpFillMat,
      armorMat,
      visorMat,
      hitMeshes,
      hp: spec.maxHp,
      alive: false,
      respawnTimer: 0,
      waypoint: new THREE.Vector3(),
      strafeDir: 1,
      strafeTimer: 1.5,
      fireTimer: 1.4,
      chargeTimer: 0,
      charging: false,
      hitFlashTimer: 0,
      knockbackPitch: 0,
      stridePhase: Math.random() * Math.PI * 2,
    };
  }

  private configureBotType(bot: BotInstance, type: BotArchetype): void {
    const spec = BOT_SPECS[type];
    bot.spec = spec;
    bot.hp = spec.maxHp;
    bot.root.scale.setScalar(spec.scale);
    bot.armorMat.color.setHex(spec.armorHex);
    bot.visorMat.color.setHex(spec.accentHex);
    bot.visorMat.emissive.setHex(spec.accentHex);
    bot.visorMat.emissiveIntensity = 0.85;
  }

  private pickArchetypeForWave(wave: number, slotIndex: number): BotArchetype {
    if (wave <= 1) {
      return slotIndex === 3 ? 'skirmisher' : 'standard';
    }
    if (wave === 2) {
      if (slotIndex % 3 === 0) return 'skirmisher';
      if (slotIndex === 4) return 'heavy';
      return 'standard';
    }
    if (slotIndex % 3 === 0) return 'skirmisher';
    if (slotIndex % 3 === 2) return 'heavy';
    return 'standard';
  }

  public resetForSession(playerPos: THREE.Vector3, wave = 1): void {
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      bot.alive = false;
      bot.root.visible = false;
      bot.charging = false;
      bot.muzzleGlow.visible = false;
      bot.hpBarGroup.visible = false;
      bot.hitFlashTimer = 0;
      bot.knockbackPitch = 0;

      // Wave 1 starts with 4 active bots; Wave 2+ scales up to 5-6 active bots
      const activeCount = Math.min(this.bots.length, 3 + wave);
      if (i < activeCount) {
        this.spawnBot(bot, i, playerPos, wave);
      } else {
        bot.respawnTimer = 9999; // Dormant until wave increases
      }
    }
  }

  public activateWaveSlots(wave: number, playerPos: THREE.Vector3): void {
    const activeCount = Math.min(this.bots.length, 3 + wave);
    for (let i = 0; i < activeCount; i++) {
      const bot = this.bots[i];
      if (!bot.alive && bot.respawnTimer > 10) {
        this.spawnBot(bot, i, playerPos, wave);
      }
    }
  }

  private spawnBot(bot: BotInstance, slotIndex: number, playerPos: THREE.Vector3, wave: number): void {
    this.configureBotType(bot, this.pickArchetypeForWave(wave, slotIndex));

    // Pick a spawn point comfortably far from the player & other bots
    let bestSpawn = this.spawns[slotIndex % this.spawns.length];
    let bestScore = -Infinity;
    for (const candidate of this.spawns) {
      const distPlayer = candidate.distanceTo(playerPos);
      if (distPlayer < 13) continue;
      let minOther = 99;
      for (const other of this.bots) {
        if (other !== bot && other.alive) {
          minOther = Math.min(minOther, candidate.distanceTo(other.root.position));
        }
      }
      const score = Math.min(distPlayer, 30) + Math.min(minOther, 12) * 1.4 + Math.random() * 6;
      if (score > bestScore) {
        bestScore = score;
        bestSpawn = candidate;
      }
    }

    bot.root.position.copy(bestSpawn);
    bot.root.position.y = 0;
    bot.alive = true;
    bot.root.visible = true;
    bot.hp = bot.spec.maxHp;
    bot.charging = false;
    bot.chargeTimer = 0;
    bot.muzzleGlow.visible = false;
    bot.hpBarGroup.visible = false;
    bot.fireTimer = 1.1 + Math.random() * 1.2;
    bot.strafeDir = Math.random() > 0.5 ? 1 : -1;
    bot.strafeTimer = 1.2 + Math.random() * 1.5;
    this.pickNextWaypoint(bot);
  }

  private pickNextWaypoint(bot: BotInstance): void {
    const idx = Math.floor(Math.random() * this.waypoints.length);
    bot.waypoint.copy(this.waypoints[idx]);
  }

  public applyDamage(botId: number, damage: number, headshot: boolean): BotDamageResult {
    const bot = this.bots.find((b) => b.id === botId);
    const worldCenter = new THREE.Vector3();
    if (!bot || !bot.alive) {
      return { hit: false, killed: false, headshot: false, botName: '', baseScore: 0, worldCenter };
    }

    const finalDmg = headshot ? Math.round(damage * 2.15) : damage;
    bot.hp = Math.max(0, bot.hp - finalDmg);
    bot.hitFlashTimer = 0.085;
    bot.knockbackPitch = -0.22;

    // Update diegetic HP bar
    const ratio = bot.hp / bot.spec.maxHp;
    bot.hpBarGroup.visible = bot.hp > 0;
    bot.hpFillMesh.scale.x = Math.max(0.01, ratio);
    bot.hpFillMat.color.setHex(ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444);

    worldCenter.copy(bot.root.position);
    worldCenter.y += 1.25 * bot.spec.scale;

    if (bot.hp <= 0) {
      bot.alive = false;
      bot.root.visible = false;
      bot.charging = false;
      bot.muzzleGlow.visible = false;
      bot.respawnTimer = 2.0 + Math.random() * 1.1;
      return {
        hit: true,
        killed: true,
        headshot,
        botName: bot.spec.name,
        baseScore: bot.spec.score,
        worldCenter,
      };
    }

    return {
      hit: true,
      killed: false,
      headshot,
      botName: bot.spec.name,
      baseScore: 0,
      worldCenter,
    };
  }

  private canMoveTo(nx: number, nz: number, radius = 0.55): boolean {
    const limit = this.arenaHalf - radius - 0.3;
    if (nx < -limit || nx > limit || nz < -limit || nz > limit) return false;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (c.minY > 1.7) continue; // Overhead obstacle
      if (
        nx + radius > c.minX &&
        nx - radius < c.maxX &&
        nz + radius > c.minZ &&
        nz - radius < c.maxZ
      ) {
        return false;
      }
    }
    return true;
  }

  private hasLineOfSight(botPos: THREE.Vector3, playerEye: THREE.Vector3, worldMeshes: THREE.Object3D[]): boolean {
    this._rayOrigin.set(botPos.x, botPos.y + 1.55, botPos.z);
    this._rayDir.subVectors(playerEye, this._rayOrigin);
    const dist = this._rayDir.length();
    if (dist < 0.5) return true;
    this._rayDir.divideScalar(dist);

    this._raycaster.set(this._rayOrigin, this._rayDir);
    this._raycaster.near = 0.2;
    this._raycaster.far = dist - 0.35;
    const hits = this._raycaster.intersectObjects(worldMeshes, false);
    return hits.length === 0;
  }

  public update(
    dt: number,
    playerEye: THREE.Vector3,
    cameraPos: THREE.Vector3,
    worldMeshes: THREE.Object3D[],
    wave: number,
    combatEnabled: boolean,
    onBotCharge: () => void,
    onBotShot: (ev: BotShotEvent) => void,
  ): void {
    const activeCount = Math.min(this.bots.length, 3 + wave);

    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];

      if (!bot.alive) {
        if (i < activeCount) {
          bot.respawnTimer -= dt;
          if (bot.respawnTimer <= 0) {
            this.spawnBot(bot, i, playerEye, wave);
          }
        }
        continue;
      }

      // Hit flash decay
      if (bot.hitFlashTimer > 0) {
        bot.hitFlashTimer -= dt;
        bot.armorMat.emissive.setHex(bot.hitFlashTimer > 0 ? 0x6b7280 : 0x000000);
      }

      // Knockback tilt recovery
      bot.knockbackPitch = THREE.MathUtils.damp(bot.knockbackPitch, 0, 14, dt);
      bot.bodyPivot.rotation.x = bot.knockbackPitch;

      // Face HP bar toward camera
      if (bot.hpBarGroup.visible) {
        bot.hpBarGroup.lookAt(cameraPos);
      }

      // Distance & LOS to player
      this._toPlayer.set(playerEye.x - bot.root.position.x, 0, playerEye.z - bot.root.position.z);
      const distToPlayer = this._toPlayer.length();
      const los = combatEnabled && distToPlayer < 36 && this.hasLineOfSight(bot.root.position, playerEye, worldMeshes);

      // Desired movement vector
      this._moveDir.set(0, 0, 0);

      if (los) {
        // Face player smoothly while strafing & maintaining mid-range spacing
        const targetYaw = Math.atan2(this._toPlayer.x, this._toPlayer.z);
        let diff = targetYaw - bot.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        bot.root.rotation.y += diff * Math.min(1, dt * 8);

        bot.strafeTimer -= dt;
        if (bot.strafeTimer <= 0) {
          bot.strafeDir *= -1;
          bot.strafeTimer = 1.0 + Math.random() * 1.4;
        }

        const nx = this._toPlayer.x / Math.max(distToPlayer, 0.01);
        const nz = this._toPlayer.z / Math.max(distToPlayer, 0.01);
        this._right.set(-nz, 0, nx);

        // Strafe laterally + gently close or open range
        this._moveDir.addScaledVector(this._right, bot.strafeDir * 0.85);
        if (distToPlayer > 17) {
          this._moveDir.x += nx * 0.55;
          this._moveDir.z += nz * 0.55;
        } else if (distToPlayer < 7.5) {
          this._moveDir.x -= nx * 0.55;
          this._moveDir.z -= nz * 0.55;
        }
      } else {
        // Patrol along lane waypoints
        this._toWaypoint.set(
          bot.waypoint.x - bot.root.position.x,
          0,
          bot.waypoint.z - bot.root.position.z,
        );
        const wpDist = this._toWaypoint.length();
        if (wpDist < 1.35) {
          this.pickNextWaypoint(bot);
        } else {
          this._moveDir.copy(this._toWaypoint).divideScalar(wpDist);
          const targetYaw = Math.atan2(this._moveDir.x, this._moveDir.z);
          let diff = targetYaw - bot.root.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          bot.root.rotation.y += diff * Math.min(1, dt * 6);
        }
      }

      // Apply sliding collision movement
      let moved = false;
      if (this._moveDir.lengthSq() > 0.001) {
        this._moveDir.normalize();
        const step = bot.spec.speed * (bot.charging ? 0.35 : 1.0) * dt;
        const candX = bot.root.position.x + this._moveDir.x * step;
        const candZ = bot.root.position.z + this._moveDir.z * step;

        if (this.canMoveTo(candX, bot.root.position.z)) {
          bot.root.position.x = candX;
          moved = true;
        } else {
          bot.strafeDir *= -1;
          if (!los) this.pickNextWaypoint(bot);
        }

        if (this.canMoveTo(bot.root.position.x, candZ)) {
          bot.root.position.z = candZ;
          moved = true;
        } else {
          bot.strafeDir *= -1;
          if (!los) this.pickNextWaypoint(bot);
        }
      }

      // Stride leg animation
      if (moved) {
        bot.stridePhase += dt * bot.spec.speed * 2.5;
        const swing = Math.sin(bot.stridePhase) * 0.52;
        bot.leftLeg.rotation.x = swing;
        bot.rightLeg.rotation.x = -swing;
      } else {
        bot.leftLeg.rotation.x = THREE.MathUtils.damp(bot.leftLeg.rotation.x, 0, 10, dt);
        bot.rightLeg.rotation.x = THREE.MathUtils.damp(bot.rightLeg.rotation.x, 0, 10, dt);
      }

      // Combat Telegraph & Firing AI
      if (combatEnabled && los) {
        if (bot.charging) {
          bot.chargeTimer -= dt;
          // Bright crimson charge telegraph on visor & muzzle
          bot.visorMat.emissive.setHex(0xff2a2a);
          bot.visorMat.emissiveIntensity = 2.2;
          bot.muzzleGlow.visible = true;
          const pulse = 0.8 + (1 - Math.max(0, bot.chargeTimer / 0.45)) * 0.9;
          bot.muzzleGlow.scale.setScalar(pulse);

          if (bot.chargeTimer <= 0) {
            bot.charging = false;
            bot.muzzleGlow.visible = false;
            bot.visorMat.emissive.setHex(bot.spec.accentHex);
            bot.visorMat.emissiveIntensity = 0.85;
            bot.fireTimer = Math.max(1.05, bot.spec.fireCooldown - (wave - 1) * 0.14) + Math.random() * 0.55;

            bot.muzzlePoint.getWorldPosition(this._muzzlePos);

            // Fair arcade hit probability based on distance (encourages strafing & cover)
            const accuracy = THREE.MathUtils.clamp(0.58 - distToPlayer * 0.011, 0.22, 0.52);
            const hitPlayer = Math.random() < accuracy;

            this._shotTarget.copy(playerEye);
            if (!hitPlayer) {
              this._shotTarget.x += (Math.random() > 0.5 ? 1 : -1) * (0.65 + Math.random() * 0.9);
              this._shotTarget.y += (Math.random() - 0.5) * 0.7;
              this._shotTarget.z += (Math.random() > 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.8);
            } else {
              this._shotTarget.y -= 0.25;
            }

            onBotShot({
              origin: this._muzzlePos.clone(),
              targetPos: this._shotTarget.clone(),
              hitPlayer,
              damage: bot.spec.damage,
            });
          }
        } else {
          bot.fireTimer -= dt;
          if (bot.fireTimer <= 0) {
            bot.charging = true;
            bot.chargeTimer = 0.45;
            onBotCharge();
          }
        }
      } else if (bot.charging) {
        // Lost LOS during charge: cancel cleanly
        bot.charging = false;
        bot.muzzleGlow.visible = false;
        bot.visorMat.emissive.setHex(bot.spec.accentHex);
        bot.visorMat.emissiveIntensity = 0.85;
      }
    }
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.sharedMaterials) m.dispose();
    for (const b of this.bots) {
      b.armorMat.dispose();
      b.visorMat.dispose();
      b.hpFillMat.dispose();
      (b.muzzleGlow.material as THREE.Material).dispose();
    }
  }
}
