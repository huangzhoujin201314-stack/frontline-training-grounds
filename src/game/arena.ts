import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';
import type { ColliderBox, RampVolume } from './types';

export interface ArenaData {
  group: THREE.Group;
  colliders: ColliderBox[];
  ramps: RampVolume[];
  shootableMeshes: THREE.Object3D[];
  botSpawns: THREE.Vector3[];
  laneWaypoints: THREE.Vector3[];
  playerSpawn: THREE.Vector3;
  arenaHalfSize: number;
  dispose: () => void;
}

/**
 * Compact 48m x 48m industrial 3-lane tactical arena inspired by classic fast-paced
 * arcade arena shooters, built 100% procedurally with grounded multi-part props,
 * playable ramps & elevated platforms, overhead steel trusses, and distant industrial perimeter.
 */
export function buildIndustrialArena(textures: ProceduralTextureSet): ArenaData {
  const group = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const ramps: RampVolume[] = [];
  const shootableMeshes: THREE.Object3D[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const HALF = 24; // 48m x 48m playable arena

  // Materials library with calibrated PBR roughness/metalness contrast
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.concreteFloor,
      roughness: 0.88,
      metalness: 0.06,
    }),
  );

  const outerGroundMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b424c,
      roughness: 0.95,
      metalness: 0.04,
    }),
  );

  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.concreteWall,
      roughness: 0.86,
      metalness: 0.08,
    }),
  );

  const steelDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x242b34,
      roughness: 0.42,
      metalness: 0.78,
    }),
  );

  const steelTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b4554,
      roughness: 0.36,
      metalness: 0.82,
    }),
  );

  const containerMats = {
    blue: trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.containerBlue,
        roughness: 0.56,
        metalness: 0.45,
      }),
    ),
    rust: trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.containerRust,
        roughness: 0.62,
        metalness: 0.38,
      }),
    ),
    olive: trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.containerOlive,
        roughness: 0.58,
        metalness: 0.4,
      }),
    ),
    slate: trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.containerSlate,
        roughness: 0.52,
        metalness: 0.5,
      }),
    ),
  };

  const crateMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.crateWood,
      roughness: 0.84,
      metalness: 0.08,
    }),
  );

  const barrierMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.hazardBarrier,
      roughness: 0.88,
      metalness: 0.05,
    }),
  );

  const rampMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.rampGrip,
      roughness: 0.68,
      metalness: 0.48,
    }),
  );

  const amberStripMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const cyanStripMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const floodGlowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfff0d4,
    }),
  );

  const lightConeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffd79b,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );

  const contactMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const outerSilhouetteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2a323d,
      roughness: 0.85,
      metalness: 0.25,
    }),
  );

  // 1. Arena Concrete Floor + Extended Outer Proving Ground
  const floorGeo = trackGeo(new THREE.PlaneGeometry(HALF * 2, HALF * 2));
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  shootableMeshes.push(floor);

  const outerGroundGeo = trackGeo(new THREE.PlaneGeometry(240, 240));
  const outerGround = new THREE.Mesh(outerGroundGeo, outerGroundMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.06;
  group.add(outerGround);

  // Tactical painted floor lane guides (offset +0.02m with polygonOffset to avoid Z-fighting)
  const addFloorLine = (x: number, z: number, w: number, l: number, mat: THREE.Material) => {
    const geo = trackGeo(new THREE.PlaneGeometry(w, l));
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    group.add(m);
  };
  // Center staging boundary & lane runners
  addFloorLine(-16, 0, 0.22, 34, amberStripMat);
  addFloorLine(0, 12.5, 10, 0.22, cyanStripMat);
  addFloorLine(0, -12.5, 10, 0.22, amberStripMat);
  addFloorLine(16, 0, 0.22, 34, amberStripMat);

  // Helper: Contact shadow grounding decal
  const addContactShadow = (x: number, z: number, w: number, d: number, y = 0.015) => {
    const geo = trackGeo(new THREE.PlaneGeometry(w * 1.24, d * 1.24));
    const shadow = new THREE.Mesh(geo, contactMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, y, z);
    group.add(shadow);
  };

  // Helper: Register solid box collider + visual mesh
  const addBoxCollider = (
    x: number,
    yBottom: number,
    z: number,
    w: number,
    h: number,
    d: number,
    tag?: string,
  ) => {
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: yBottom,
      maxY: yBottom + h,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      tag,
    });
  };

  // Helper: Composite Multi-Part Shipping Container (Bottom-center grounded)
  const addShippingContainer = (
    x: number,
    yBottom: number,
    z: number,
    length: number,
    height: number,
    width: number,
    rotateY90: boolean,
    colorKey: keyof typeof containerMats,
  ) => {
    const w = rotateY90 ? width : length;
    const d = rotateY90 ? length : width;
    const containerGroup = new THREE.Group();
    containerGroup.position.set(x, yBottom, z);

    // Primary corrugated steel hull
    const hullGeo = trackGeo(new THREE.BoxGeometry(w, height, d));
    const hull = new THREE.Mesh(hullGeo, containerMats[colorKey]);
    hull.position.y = height / 2;
    hull.castShadow = true;
    hull.receiveShadow = true;
    containerGroup.add(hull);
    shootableMeshes.push(hull);

    // Secondary structural corner steel posts (4 corners)
    const postGeo = trackGeo(new THREE.BoxGeometry(0.18, height + 0.04, 0.18));
    const hx = w / 2 - 0.06;
    const hz = d / 2 - 0.06;
    const postCoords = [
      [-hx, -hz],
      [hx, -hz],
      [-hx, hz],
      [hx, hz],
    ];
    for (const [px, pz] of postCoords) {
      const post = new THREE.Mesh(postGeo, steelDarkMat);
      post.position.set(px, height / 2, pz);
      post.castShadow = true;
      containerGroup.add(post);
    }

    // Accent detail: top reinforcement rail frame + roof locking castings
    const railXGeo = trackGeo(new THREE.BoxGeometry(w + 0.06, 0.12, 0.12));
    const railZGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.12, d + 0.06));
    const topR1 = new THREE.Mesh(railXGeo, steelTrimMat);
    topR1.position.set(0, height - 0.02, hz);
    const topR2 = new THREE.Mesh(railXGeo, steelTrimMat);
    topR2.position.set(0, height - 0.02, -hz);
    const topR3 = new THREE.Mesh(railZGeo, steelTrimMat);
    topR3.position.set(hx, height - 0.02, 0);
    const topR4 = new THREE.Mesh(railZGeo, steelTrimMat);
    topR4.position.set(-hx, height - 0.02, 0);
    containerGroup.add(topR1, topR2, topR3, topR4);

    group.add(containerGroup);
    if (yBottom < 0.1) addContactShadow(x, z, w, d);
    addBoxCollider(x, yBottom, z, w, height, d, 'container');
  };

  // Helper: Composite Tactical Crate Cluster (Bottom-center grounded)
  const addCrate = (x: number, yBottom: number, z: number, size: number) => {
    const crateGroup = new THREE.Group();
    crateGroup.position.set(x, yBottom, z);

    // Main wood crate body
    const bodyGeo = trackGeo(new THREE.BoxGeometry(size, size, size));
    const body = new THREE.Mesh(bodyGeo, crateMat);
    body.position.y = size / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    crateGroup.add(body);
    shootableMeshes.push(body);

    // Steel reinforcing edge straps (secondary contrast)
    const strapGeo = trackGeo(new THREE.BoxGeometry(size + 0.04, 0.08, size + 0.04));
    const strapBot = new THREE.Mesh(strapGeo, steelDarkMat);
    strapBot.position.y = 0.08;
    const strapTop = new THREE.Mesh(strapGeo, steelDarkMat);
    strapTop.position.y = size - 0.08;
    crateGroup.add(strapBot, strapTop);

    // Top latch detail
    const latchGeo = trackGeo(new THREE.BoxGeometry(size * 0.35, 0.05, 0.14));
    const latch = new THREE.Mesh(latchGeo, steelTrimMat);
    latch.position.set(0, size + 0.02, size * 0.25);
    crateGroup.add(latch);

    group.add(crateGroup);
    if (yBottom < 0.1) addContactShadow(x, z, size, size);
    addBoxCollider(x, yBottom, z, size, size, size, 'crate');
  };

  // Helper: Composite Concrete Jersey Cover Barrier
  const addJerseyBarrier = (
    x: number,
    yBottom: number,
    z: number,
    length: number,
    rotateY90: boolean,
    height = 1.25,
  ) => {
    const w = rotateY90 ? 0.72 : length;
    const d = rotateY90 ? length : 0.72;
    const barrierGroup = new THREE.Group();
    barrierGroup.position.set(x, yBottom, z);

    // Wide sturdy concrete base
    const baseGeo = trackGeo(new THREE.BoxGeometry(w, 0.36, d));
    const base = new THREE.Mesh(baseGeo, barrierMat);
    base.position.y = 0.18;
    base.castShadow = true;
    base.receiveShadow = true;
    barrierGroup.add(base);
    shootableMeshes.push(base);

    // Upper tapered concrete wall
    const topGeo = trackGeo(
      new THREE.BoxGeometry(rotateY90 ? 0.44 : length - 0.06, height - 0.36, rotateY90 ? length - 0.06 : 0.44),
    );
    const top = new THREE.Mesh(topGeo, barrierMat);
    top.position.y = 0.36 + (height - 0.36) / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    barrierGroup.add(top);
    shootableMeshes.push(top);

    // Steel top lifting hooks (accent detail)
    const capGeo = trackGeo(
      new THREE.BoxGeometry(rotateY90 ? 0.48 : length * 0.88, 0.06, rotateY90 ? length * 0.88 : 0.48),
    );
    const cap = new THREE.Mesh(capGeo, steelDarkMat);
    cap.position.y = height + 0.02;
    barrierGroup.add(cap);

    group.add(barrierGroup);
    if (yBottom < 0.1) addContactShadow(x, z, w, d);
    addBoxCollider(x, yBottom, z, w, height, d, 'barrier');
  };

  // Helper: Walkable Steel/Concrete Ramp with side safety curbs + RampVolume
  const addRamp = (
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    yLow: number,
    yHigh: number,
    ascendDir: RampVolume['ascendDir'],
  ) => {
    ramps.push({ minX, maxX, minZ, maxZ, yLow, yHigh, ascendDir });

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const widthX = maxX - minX;
    const depthZ = maxZ - minZ;
    const dy = yHigh - yLow;

    // Build solid wedge BufferGeometry so underside is enclosed and casts crisp shadows
    const shape = new THREE.Shape();
    const isAlongZ = ascendDir === '+z' || ascendDir === '-z';
    const run = isAlongZ ? depthZ : widthX;
    const span = isAlongZ ? widthX : depthZ;

    shape.moveTo(0, 0);
    shape.lineTo(run, 0);
    shape.lineTo(run, dy);
    shape.closePath();

    const wedgeGeo = trackGeo(
      new THREE.ExtrudeGeometry(shape, {
        depth: span,
        bevelEnabled: false,
      }),
    );

    const wedge = new THREE.Mesh(wedgeGeo, rampMat);
    wedge.castShadow = true;
    wedge.receiveShadow = true;

    // Orient extruded wedge so the high edge aligns with ascendDir
    if (ascendDir === '-z') {
      // High at minZ, low at maxZ
      wedge.rotation.y = Math.PI / 2;
      wedge.position.set(minX, yLow, maxZ);
    } else if (ascendDir === '+z') {
      // High at maxZ, low at minZ
      wedge.rotation.y = -Math.PI / 2;
      wedge.position.set(maxX, yLow, minZ);
    } else if (ascendDir === '+x') {
      // High at maxX, low at minZ..maxZ
      wedge.position.set(minX, yLow, minZ);
    } else {
      // '-x': High at minX
      wedge.rotation.y = Math.PI;
      wedge.position.set(maxX, yLow, maxZ);
    }

    group.add(wedge);
    shootableMeshes.push(wedge);

    // Side metallic handrail trim bars along the slope
    const slopeLen = Math.hypot(run, dy);
    const slopeAngle = Math.atan2(dy, run);
    const railGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.14, slopeLen));
    const railGroup = new THREE.Group();
    railGroup.position.set(cx, yLow + dy / 2 + 0.08, cz);

    if (ascendDir === '-z') {
      const r1 = new THREE.Mesh(railGeo, steelDarkMat);
      r1.position.x = -widthX / 2 + 0.06;
      r1.rotation.x = slopeAngle;
      const r2 = new THREE.Mesh(railGeo, steelDarkMat);
      r2.position.x = widthX / 2 - 0.06;
      r2.rotation.x = slopeAngle;
      railGroup.add(r1, r2);
    } else if (ascendDir === '+z') {
      const r1 = new THREE.Mesh(railGeo, steelDarkMat);
      r1.position.x = -widthX / 2 + 0.06;
      r1.rotation.x = -slopeAngle;
      const r2 = new THREE.Mesh(railGeo, steelDarkMat);
      r2.position.x = widthX / 2 - 0.06;
      r2.rotation.x = -slopeAngle;
      railGroup.add(r1, r2);
    } else if (ascendDir === '+x') {
      const railGeoX = trackGeo(new THREE.BoxGeometry(slopeLen, 0.14, 0.1));
      const r1 = new THREE.Mesh(railGeoX, steelDarkMat);
      r1.position.z = -depthZ / 2 + 0.06;
      r1.rotation.z = slopeAngle;
      const r2 = new THREE.Mesh(railGeoX, steelDarkMat);
      r2.position.z = depthZ / 2 - 0.06;
      r2.rotation.z = slopeAngle;
      railGroup.add(r1, r2);
    } else {
      const railGeoX = trackGeo(new THREE.BoxGeometry(slopeLen, 0.14, 0.1));
      const r1 = new THREE.Mesh(railGeoX, steelDarkMat);
      r1.position.z = -depthZ / 2 + 0.06;
      r1.rotation.z = -slopeAngle;
      const r2 = new THREE.Mesh(railGeoX, steelDarkMat);
      r2.position.z = depthZ / 2 - 0.06;
      r2.rotation.z = -slopeAngle;
      railGroup.add(r1, r2);
    }
    group.add(railGroup);
  };

  // 2. Perimeter Blast Walls + Top Steel Louver Frame + Buttress Columns
  const wallH = 6.2;
  const wallT = 1.2;
  const addPerimeterWall = (x: number, z: number, w: number, d: number) => {
    const geo = trackGeo(new THREE.BoxGeometry(w, wallH, d));
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, wallH / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    shootableMeshes.push(mesh);
    addBoxCollider(x, 0, z, w, wallH + 4, d, 'wall');

    // Top steel coping beam
    const capGeo = trackGeo(new THREE.BoxGeometry(w + 0.12, 0.34, d + 0.12));
    const cap = new THREE.Mesh(capGeo, steelDarkMat);
    cap.position.set(x, wallH + 0.17, z);
    group.add(cap);
  };

  addPerimeterWall(0, -HALF - wallT / 2, HALF * 2 + wallT * 2, wallT); // North
  addPerimeterWall(0, HALF + wallT / 2, HALF * 2 + wallT * 2, wallT); // South
  addPerimeterWall(-HALF - wallT / 2, 0, wallT, HALF * 2); // West
  addPerimeterWall(HALF + wallT / 2, 0, wallT, HALF * 2); // East

  // Perimeter concrete buttress pilasters (gives strong wall depth & shadow rhythm)
  const pillarGeo = trackGeo(new THREE.BoxGeometry(0.9, wallH + 0.5, 0.9));
  for (let i = -20; i <= 20; i += 8) {
    for (const side of [-1, 1]) {
      const pNS = new THREE.Mesh(pillarGeo, steelDarkMat);
      pNS.position.set(i, (wallH + 0.5) / 2, side * (HALF - 0.15));
      pNS.castShadow = true;
      group.add(pNS);

      const pEW = new THREE.Mesh(pillarGeo, steelDarkMat);
      pEW.position.set(side * (HALF - 0.15), (wallH + 0.5) / 2, i);
      pEW.castShadow = true;
      group.add(pEW);
    }
  }

  // 3. Tactical 3-Lane Cover & Verticality Architecture

  // --- CENTER HUB (Mid-Lane): Elevated Container Platform reachable via South & North Ramps ---
  // Central base platform deck (8m wide x 6m deep x 2.4m high)
  addShippingContainer(0, 0, 0, 8.2, 2.4, 3.4, false, 'rust');
  // Dual concrete ramps ascending onto the Mid container deck from East & West sides
  addRamp(-8.1, -4.1, -1.5, 1.5, 0, 2.4, '+x');
  addRamp(4.1, 8.1, -1.5, 1.5, 0, 2.4, '-x');
  // Low tactical cover on top of the Mid deck so fighting from high ground feels awesome
  addJerseyBarrier(0, 2.4, -1.35, 3.6, false, 1.05);
  addCrate(-2.4, 2.4, 0.85, 1.05);
  addCrate(2.4, 2.4, 0.85, 1.05);

  // Mid-lane flanking low barriers & crates (North & South approaches)
  addJerseyBarrier(-4.2, 0, 9.2, 3.8, false);
  addJerseyBarrier(4.2, 0, 9.2, 3.8, false);
  addCrate(0, 0, 11.4, 1.35);

  addJerseyBarrier(-4.2, 0, -9.2, 3.8, false);
  addJerseyBarrier(4.2, 0, -9.2, 3.8, false);
  addCrate(0, 0, -11.8, 1.35);

  // --- WEST LANE (A-Lane, x ≈ -16): Shipping Container Alley + West Overlook ---
  addShippingContainer(-15.5, 0, 6.2, 6.4, 2.6, 2.6, true, 'blue');
  addShippingContainer(-15.5, 0, -7.2, 6.4, 2.6, 2.6, true, 'slate');
  // Stacked double container landmark on far West edge for strong vertical silhouette
  addShippingContainer(-21.2, 0, -1.0, 7.2, 2.6, 2.6, true, 'olive');
  addShippingContainer(-21.2, 2.6, -1.0, 6.2, 2.5, 2.5, true, 'blue');
  // Ramp up onto the South-West blue container roof for flank angle!
  addRamp(-16.8, -14.2, 9.4, 14.2, 0, 2.6, '-z');
  // Waist-high crate cover in A-lane
  addCrate(-11.2, 0, 3.2, 1.3);
  addCrate(-11.2, 0, 1.85, 1.1);
  addJerseyBarrier(-15.5, 0, -0.5, 3.2, false);
  addCrate(-19.5, 0, 12.2, 1.4);
  addCrate(-19.5, 0, -13.5, 1.4);

  // --- EAST LANE (B-Lane, x ≈ +16): Fast Flanking Corridor + East Overlook ---
  addShippingContainer(15.5, 0, -6.2, 6.4, 2.6, 2.6, true, 'olive');
  addShippingContainer(15.5, 0, 7.2, 6.4, 2.6, 2.6, true, 'blue');
  // Double-stacked container tower on far East perimeter
  addShippingContainer(21.2, 0, 1.2, 7.2, 2.6, 2.6, true, 'slate');
  addShippingContainer(21.2, 2.6, 1.2, 6.2, 2.5, 2.5, true, 'rust');
  // Ramp up onto the North-East olive container roof
  addRamp(14.2, 16.8, -14.2, -9.4, 0, 2.6, '+z');
  // B-lane tactical cover
  addJerseyBarrier(15.5, 0, 0.6, 3.2, false);
  addCrate(11.4, 0, -3.4, 1.3);
  addCrate(11.4, 0, -2.0, 1.1);
  addCrate(19.6, 0, 13.4, 1.4);
  addCrate(19.6, 0, -12.6, 1.4);

  // --- SOUTH STAGING COVER (Player spawn safety & quick peek angles) ---
  addJerseyBarrier(-8.5, 0, 17.5, 4.0, false);
  addJerseyBarrier(8.5, 0, 17.5, 4.0, false);
  addCrate(-11.2, 0, 16.6, 1.25);
  addCrate(11.2, 0, 16.6, 1.25);

  // --- NORTH STAGING BUNKER (Enemy spawn staging cover) ---
  addShippingContainer(-8.5, 0, -17.6, 5.6, 2.5, 2.4, false, 'slate');
  addShippingContainer(8.5, 0, -17.6, 5.6, 2.5, 2.4, false, 'rust');
  addJerseyBarrier(0, 0, -17.2, 4.2, false);

  // 4. Overhead Industrial Steel Gantry Trusses + Lane Signs + Floodlights
  const trussY = 9.2;
  const beamGeo = trackGeo(new THREE.BoxGeometry(HALF * 2 + 2, 0.48, 0.48));
  const subBeamGeo = trackGeo(new THREE.BoxGeometry(HALF * 2 + 2, 0.24, 0.24));
  const housingGeo = trackGeo(new THREE.BoxGeometry(1.6, 0.26, 0.72));
  const emitterGeo = trackGeo(new THREE.PlaneGeometry(1.36, 0.52));
  const coneGeo = trackGeo(new THREE.ConeGeometry(4.6, 8.8, 12, 1, true));

  const trussZs = [-13, 0, 13];
  for (const tz of trussZs) {
    const trussGroup = new THREE.Group();
    const topBeam = new THREE.Mesh(beamGeo, steelDarkMat);
    topBeam.position.set(0, trussY, tz);
    const lowerBeam = new THREE.Mesh(subBeamGeo, steelTrimMat);
    lowerBeam.position.set(0, trussY - 0.9, tz);
    trussGroup.add(topBeam, lowerBeam);

    // Vertical truss columns anchoring gantry to perimeter walls
    const colGeo = trackGeo(new THREE.BoxGeometry(0.65, trussY, 0.65));
    const colL = new THREE.Mesh(colGeo, steelDarkMat);
    colL.position.set(-HALF + 0.25, trussY / 2, tz);
    const colR = new THREE.Mesh(colGeo, steelDarkMat);
    colR.position.set(HALF - 0.25, trussY / 2, tz);
    trussGroup.add(colL, colR);

    // Overhead floodlight fixtures + subtle volumetric light cones
    for (const lx of [-15, 0, 15]) {
      const housing = new THREE.Mesh(housingGeo, steelDarkMat);
      housing.position.set(lx, trussY - 1.15, tz);
      const emitter = new THREE.Mesh(emitterGeo, floodGlowMat);
      emitter.rotation.x = Math.PI / 2;
      emitter.position.set(lx, trussY - 1.29, tz);
      trussGroup.add(housing, emitter);

      if (tz === 0 || lx === 0) {
        const cone = new THREE.Mesh(coneGeo, lightConeMat);
        cone.position.set(lx, trussY - 5.65, tz);
        trussGroup.add(cone);
      }
    }

    group.add(trussGroup);
  }

  // Overhead Sector Lane Signs on the central gantry (A / MID / B)
  const addSignBoard = (x: number, y: number, z: number, tex: THREE.CanvasTexture) => {
    const signMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.4,
        metalness: 0.25,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.25,
      }),
    );
    const boardGeo = trackGeo(new THREE.BoxGeometry(2.6, 1.3, 0.14));
    const board = new THREE.Mesh(boardGeo, [
      steelDarkMat,
      steelDarkMat,
      steelDarkMat,
      steelDarkMat,
      signMat,
      signMat,
    ]);
    board.position.set(x, y, z);
    group.add(board);
  };

  addSignBoard(-15.5, trussY - 1.9, 0, textures.signA);
  addSignBoard(0, trussY - 1.9, 0, textures.signMid);
  addSignBoard(15.5, trussY - 1.9, 0, textures.signB);

  // 5. Outer Industrial Horizon Silhouettes (grounded beyond the blast walls so there is zero empty void)
  const outerSpecs: Array<[number, number, number, number, number]> = [
    [-44, -38, 22, 16, 14],
    [-12, -46, 26, 20, 12],
    [28, -42, 20, 14, 16],
    [46, -12, 16, 18, 28],
    [44, 24, 18, 12, 22],
    [-46, 16, 16, 15, 26],
    [-20, 44, 28, 13, 14],
    [22, 46, 24, 16, 14],
  ];
  for (const [bx, bz, bw, bh, bd] of outerSpecs) {
    const bGeo = trackGeo(new THREE.BoxGeometry(bw, bh, bd));
    const bMesh = new THREE.Mesh(bGeo, outerSilhouetteMat);
    bMesh.position.set(bx, bh / 2 - 0.1, bz);
    group.add(bMesh);
  }

  // Tall industrial communications / floodlight mast towers in outer corners
  const mastGeo = trackGeo(new THREE.CylinderGeometry(0.35, 0.65, 26, 8));
  const beaconMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf97316 }));
  const beaconGeo = trackGeo(new THREE.SphereGeometry(0.45, 8, 8));
  const mastCoords: Array<[number, number]> = [
    [-32, -32],
    [32, -32],
    [-34, 30],
    [34, 30],
  ];
  for (const [mx, mz] of mastCoords) {
    const mast = new THREE.Mesh(mastGeo, steelDarkMat);
    mast.position.set(mx, 13, mz);
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(mx, 26.2, mz);
    group.add(mast, beacon);
  }

  // 6. Tactical Bot Spawn Points & Lane Patrol Waypoints
  const botSpawns: THREE.Vector3[] = [
    new THREE.Vector3(-15.5, 0, -20.5),
    new THREE.Vector3(0, 0, -20.8),
    new THREE.Vector3(15.5, 0, -20.5),
    new THREE.Vector3(-19.5, 0, -10.5),
    new THREE.Vector3(19.5, 0, -10.5),
    new THREE.Vector3(-11.5, 0, -14.0),
    new THREE.Vector3(11.5, 0, -14.0),
    new THREE.Vector3(-18.5, 0, 1.5),
    new THREE.Vector3(18.5, 0, 1.5),
    new THREE.Vector3(-10.5, 0, 6.5),
    new THREE.Vector3(10.5, 0, 6.5),
  ];

  const laneWaypoints: THREE.Vector3[] = [
    new THREE.Vector3(-15.5, 0, -14.5),
    new THREE.Vector3(-15.5, 0, -2.5),
    new THREE.Vector3(-11.0, 0, 6.5),
    new THREE.Vector3(-6.0, 0, -6.5),
    new THREE.Vector3(0, 0, -14.5),
    new THREE.Vector3(6.0, 0, -6.5),
    new THREE.Vector3(11.0, 0, 6.5),
    new THREE.Vector3(15.5, 0, -2.5),
    new THREE.Vector3(15.5, 0, -14.5),
    new THREE.Vector3(-7.0, 0, 13.0),
    new THREE.Vector3(7.0, 0, 13.0),
  ];

  return {
    group,
    colliders,
    ramps,
    shootableMeshes,
    botSpawns,
    laneWaypoints,
    playerSpawn: new THREE.Vector3(0, 0, 20.2),
    arenaHalfSize: HALF,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
