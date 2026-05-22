const fs = require("fs");
const path = require("path");

const inputDir = process.argv[2] || path.join("GolfSimulation", "Assets", "StreamingAssets", "preprocessed", "face_on");

const required = [
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist",
  "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
  "nose", "left_eye", "right_eye", "left_ear", "right_ear"
];

const segments = [
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"]
];

const angleChains = [
  ["left_shoulder", "left_elbow", "left_wrist", 10, 179],
  ["right_shoulder", "right_elbow", "right_wrist", 10, 179],
  ["left_hip", "left_knee", "left_ankle", 6, 179],
  ["right_hip", "right_knee", "right_ankle", 6, 179]
];

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const mag = (a) => Math.sqrt(dot(a, a));
const dist = (a, b) => mag(sub(a, b));
const norm = (a, fallback = { x: 0, y: 0, z: 1 }) => {
  const m = mag(a);
  return m > 1e-8 ? mul(a, 1 / m) : fallback;
};
const lerp = (a, b, t) => add(mul(a, 1 - t), mul(b, t));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const angleDeg = (a, b) => Math.acos(clamp(dot(norm(a), norm(b)), -1, 1)) * 180 / Math.PI;

function mapFrame(frame) {
  const map = new Map();
  for (const lm of frame.landmarks || []) {
    if (lm && lm.name) map.set(lm.name, lm);
  }
  return map;
}

function v(lm) {
  return { x: lm.x, y: lm.y, z: lm.z };
}

function setv(lm, p) {
  lm.x = p.x;
  lm.y = p.y;
  lm.z = p.z;
}

function bodyFrame(map, lastForward) {
  for (const key of ["left_hip", "right_hip", "left_shoulder", "right_shoulder"]) {
    if (!map.has(key)) return null;
  }

  const lh = v(map.get("left_hip"));
  const rh = v(map.get("right_hip"));
  const ls = v(map.get("left_shoulder"));
  const rs = v(map.get("right_shoulder"));
  const pelvis = mul(add(lh, rh), 0.5);
  const shoulders = mul(add(ls, rs), 0.5);
  const up = norm(sub(shoulders, pelvis), { x: 0, y: 1, z: 0 });
  let right = sub(mul(add(sub(rh, lh), sub(rs, ls)), 0.5), mul(up, dot(mul(add(sub(rh, lh), sub(rs, ls)), 0.5), up)));
  right = norm(right, { x: 1, y: 0, z: 0 });
  let forward = norm(cross(right, up), lastForward || { x: 0, y: 0, z: 1 });
  if (lastForward && dot(forward, lastForward) < 0) forward = mul(forward, -1);
  const bodyWidth = Math.max(dist(lh, rh), dist(ls, rs));
  return { pelvis, shoulders, up, right, forward, bodyWidth };
}

function ensureLateral(map, leftKey, rightKey, origin, rightAxis, minAbs) {
  if (!map.has(leftKey) || !map.has(rightKey)) return;
  const leftLm = map.get(leftKey);
  const rightLm = map.get(rightKey);
  let left = v(leftLm);
  let right = v(rightLm);
  const leftLat = dot(sub(left, origin), rightAxis);
  const rightLat = dot(sub(right, origin), rightAxis);
  const center = (leftLat + rightLat) * 0.5;
  const half = Math.max(minAbs, Math.abs(rightLat - leftLat) * 0.5);
  const targetLeft = center - half;
  const targetRight = center + half;
  if (leftLat > targetLeft) left = add(left, mul(rightAxis, targetLeft - leftLat));
  if (rightLat < targetRight) right = add(right, mul(rightAxis, targetRight - rightLat));
  setv(leftLm, left);
  setv(rightLm, right);
}

function pushArm(map, shoulderKey, elbowKey, wristKey, forward, bodyWidth) {
  if (!map.has(shoulderKey)) return;
  const shoulder = v(map.get(shoulderKey));
  for (const [key, ratio] of [[elbowKey, 0.22], [wristKey, 0.253]]) {
    if (!map.has(key)) continue;
    const lm = map.get(key);
    let p = v(lm);
    const current = dot(sub(p, shoulder), forward);
    const minForward = bodyWidth * ratio;
    if (current < minForward) setv(lm, add(p, mul(forward, (minForward - current) * 0.65)));
  }
}

function shiftArmChain(map, shoulderKey, elbowKey, wristKey, forward, bodyWidth) {
  if (!map.has(shoulderKey) || !map.has(elbowKey) || !map.has(wristKey)) return;
  const shoulder = v(map.get(shoulderKey));
  const elbowLm = map.get(elbowKey);
  const wristLm = map.get(wristKey);
  const elbow = v(elbowLm);
  const wrist = v(wristLm);
  const minForward = bodyWidth * 0.22;
  const required = minForward - Math.min(dot(sub(elbow, shoulder), forward), dot(sub(wrist, shoulder), forward));
  if (required <= 0) return;
  const shift = mul(forward, required);
  setv(elbowLm, add(elbow, shift));
  setv(wristLm, add(wrist, shift));
}

function estimateLengths(frames) {
  const samples = new Map(segments.map(([a, b]) => [`${a}>${b}`, []]));
  for (const frame of frames) {
    if (!frame.has_pose) continue;
    const map = mapFrame(frame);
    for (const [a, b] of segments) {
      if (!map.has(a) || !map.has(b)) continue;
      const av = map.get(a).visibility ?? 1;
      const bv = map.get(b).visibility ?? 1;
      const d = dist(v(map.get(a)), v(map.get(b)));
      if (Math.min(av, bv) >= 0.35 && d > 0.005 && d < 1.5) samples.get(`${a}>${b}`).push(d);
    }
  }
  const targets = new Map();
  for (const [key, values] of samples) {
    if (!values.length) continue;
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    targets.set(key, values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) * 0.5);
  }
  return targets;
}

function rotateAroundAxis(vec, axis, degrees) {
  const rad = degrees * Math.PI / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const a = norm(axis);
  return add(add(mul(vec, c), mul(cross(a, vec), s)), mul(a, dot(a, vec) * (1 - c)));
}

function repairAngle(map, a, b, c, minAngle, maxAngle, fallback) {
  if (!map.has(a) || !map.has(b) || !map.has(c)) return;
  const parent = v(map.get(a));
  const joint = v(map.get(b));
  const childLm = map.get(c);
  const child = v(childLm);
  const toParent = sub(parent, joint);
  const toChild = sub(child, joint);
  const childLen = mag(toChild);
  if (mag(toParent) < 1e-8 || childLen < 1e-8) return;
  const parentDir = norm(toParent);
  const childDir = norm(toChild);
  const current = angleDeg(parentDir, childDir);
  const target = clamp(current, minAngle, maxAngle);
  if (Math.abs(current - target) < 0.5) return;
  let axis = cross(parentDir, childDir);
  if (mag(axis) < 1e-8) axis = cross(parentDir, fallback);
  if (mag(axis) < 1e-8) axis = cross(parentDir, { x: 0, y: 1, z: 0 });
  axis = norm(axis, { x: 1, y: 0, z: 0 });
  const aDir = norm(rotateAroundAxis(parentDir, axis, target));
  const bDir = norm(rotateAroundAxis(parentDir, axis, -target));
  const targetDir = dot(aDir, childDir) >= dot(bDir, childDir) ? aDir : bDir;
  setv(childLm, lerp(child, add(joint, mul(targetDir, childLen)), 1));
}

function correctedClone(sequence) {
  const clone = JSON.parse(JSON.stringify(sequence));
  let lastForward = null;
  for (const frame of clone.frames || []) {
    if (!frame.has_pose) continue;
    const map = mapFrame(frame);
    const bf = bodyFrame(map, lastForward);
    if (!bf) continue;
    lastForward = bf.forward;
    const legSide = bf.bodyWidth * 0.24;
    ensureLateral(map, "left_knee", "right_knee", bf.pelvis, bf.right, legSide);
    ensureLateral(map, "left_ankle", "right_ankle", bf.pelvis, bf.right, legSide * 1.05);
    ensureLateral(map, "left_heel", "right_heel", bf.pelvis, bf.right, legSide * 1.05);
    ensureLateral(map, "left_foot_index", "right_foot_index", bf.pelvis, bf.right, legSide * 1.1);
    pushArm(map, "left_shoulder", "left_elbow", "left_wrist", bf.forward, bf.bodyWidth);
    pushArm(map, "right_shoulder", "right_elbow", "right_wrist", bf.forward, bf.bodyWidth);
  }

  const lengths = estimateLengths(clone.frames || []);
  for (const frame of clone.frames || []) {
    if (!frame.has_pose) continue;
    const map = mapFrame(frame);
    for (const [a, b] of segments) {
      if (!map.has(a) || !map.has(b)) continue;
      const target = lengths.get(`${a}>${b}`);
      if (!target) continue;
      const parent = v(map.get(a));
      const childLm = map.get(b);
      const child = v(childLm);
      const off = sub(child, parent);
      const len = mag(off);
      if (len < 1e-8 || Math.abs(len - target) <= Math.max(0.002, target * 0.18)) continue;
      setv(childLm, lerp(child, add(parent, mul(off, target / len)), 0.75));
    }
  }

  lastForward = null;
  for (const frame of clone.frames || []) {
    if (!frame.has_pose) continue;
    const map = mapFrame(frame);
    const bf = bodyFrame(map, lastForward);
    const fallback = bf ? bf.forward : { x: 0, y: 0, z: 1 };
    if (bf) lastForward = bf.forward;
    for (const chain of angleChains) repairAngle(map, ...chain, fallback);
  }
  lastForward = null;
  for (const frame of clone.frames || []) {
    if (!frame.has_pose) continue;
    const map = mapFrame(frame);
    const bf = bodyFrame(map, lastForward);
    if (!bf) continue;
    lastForward = bf.forward;
    const legSide = bf.bodyWidth * 0.24;
    ensureLateral(map, "left_knee", "right_knee", bf.pelvis, bf.right, legSide);
    ensureLateral(map, "left_ankle", "right_ankle", bf.pelvis, bf.right, legSide * 1.05);
    ensureLateral(map, "left_heel", "right_heel", bf.pelvis, bf.right, legSide * 1.05);
    ensureLateral(map, "left_foot_index", "right_foot_index", bf.pelvis, bf.right, legSide * 1.1);
    pushArm(map, "left_shoulder", "left_elbow", "left_wrist", bf.forward, bf.bodyWidth);
    pushArm(map, "right_shoulder", "right_elbow", "right_wrist", bf.forward, bf.bodyWidth);
  }
  const refinedLengths = estimateLengths(clone.frames || []);
  for (const frame of clone.frames || []) {
    if (!frame.has_pose) continue;
    const map = mapFrame(frame);
    for (const [a, b] of segments) {
      if (!map.has(a) || !map.has(b)) continue;
      const target = refinedLengths.get(`${a}>${b}`);
      if (!target) continue;
      const parent = v(map.get(a));
      const childLm = map.get(b);
      const child = v(childLm);
      const off = sub(child, parent);
      const len = mag(off);
      if (len < 1e-8 || Math.abs(len - target) <= Math.max(0.002, target * 0.18)) continue;
      setv(childLm, lerp(child, add(parent, mul(off, target / len)), 0.75));
    }
  }
  lastForward = null;
  for (const frame of clone.frames || []) {
    if (!frame.has_pose) continue;
    const map = mapFrame(frame);
    const bf = bodyFrame(map, lastForward);
    const fallback = bf ? bf.forward : { x: 0, y: 0, z: 1 };
    if (bf) lastForward = bf.forward;
    for (const chain of angleChains) repairAngle(map, ...chain, fallback);
  }
  lastForward = null;
  for (const frame of clone.frames || []) {
    if (!frame.has_pose) continue;
    const map = mapFrame(frame);
    const bf = bodyFrame(map, lastForward);
    if (!bf) continue;
    lastForward = bf.forward;
    shiftArmChain(map, "left_shoulder", "left_elbow", "left_wrist", bf.forward, bf.bodyWidth);
    shiftArmChain(map, "right_shoulder", "right_elbow", "right_wrist", bf.forward, bf.bodyWidth);
  }
  return clone;
}

function metrics(sequence) {
  const out = {
    frames: 0,
    validPoseFrames: 0,
    missingRequiredFrames: 0,
    crossedLegFrames: 0,
    armBehindFrames: 0,
    jointAngleOutlierFrames: 0,
    maxBoneRangeRel: 0
  };
  const lengths = new Map(segments.map(([a, b]) => [`${a}>${b}`, []]));
  let lastForward = null;
  for (const frame of sequence.frames || []) {
    out.frames++;
    if (!frame.has_pose) continue;
    out.validPoseFrames++;
    const map = mapFrame(frame);
    if (required.some((key) => !map.has(key))) out.missingRequiredFrames++;
    const bf = bodyFrame(map, lastForward);
    if (bf) {
      lastForward = bf.forward;
      for (const [lk, rk] of [["left_knee", "right_knee"], ["left_ankle", "right_ankle"]]) {
        if (!map.has(lk) || !map.has(rk)) continue;
        if (dot(sub(v(map.get(lk)), bf.pelvis), bf.right) >= dot(sub(v(map.get(rk)), bf.pelvis), bf.right)) {
          out.crossedLegFrames++;
          break;
        }
      }
      for (const [s, e, w] of [["left_shoulder", "left_elbow", "left_wrist"], ["right_shoulder", "right_elbow", "right_wrist"]]) {
        if (!map.has(s) || !map.has(e) || !map.has(w)) continue;
        const shoulder = v(map.get(s));
        const minForward = bf.bodyWidth * 0.05;
        if (dot(sub(v(map.get(e)), shoulder), bf.forward) < -minForward ||
            dot(sub(v(map.get(w)), shoulder), bf.forward) < -minForward) {
          out.armBehindFrames++;
          break;
        }
      }
    }

    for (const [a, b] of segments) {
      if (map.has(a) && map.has(b)) lengths.get(`${a}>${b}`).push(dist(v(map.get(a)), v(map.get(b))));
    }
    for (const [a, b, c, minA, maxA] of angleChains) {
      if (!map.has(a) || !map.has(b) || !map.has(c)) continue;
      const angle = angleDeg(sub(v(map.get(a)), v(map.get(b))), sub(v(map.get(c)), v(map.get(b))));
      if (angle < minA - 0.75 || angle > maxA + 0.75) {
        out.jointAngleOutlierFrames++;
        break;
      }
    }
  }
  for (const values of lengths.values()) {
    if (values.length < 2) continue;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (avg <= 1e-8) continue;
    const rel = (Math.max(...values) - Math.min(...values)) / avg;
    out.maxBoneRangeRel = Math.max(out.maxBoneRangeRel, rel);
  }
  return out;
}

function summarize() {
  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(2);
  }
  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith(".json")).sort();
  const failures = [];
  const rows = [];
  for (const file of files) {
    const full = path.join(inputDir, file);
    const sequence = JSON.parse(fs.readFileSync(full, "utf8"));
    const raw = metrics(sequence);
    const corrected = metrics(correctedClone(sequence));
    const failReasons = [];
    if (corrected.validPoseFrames === 0) failReasons.push("no valid pose frames");
    if (corrected.missingRequiredFrames > 0) failReasons.push("missing required landmarks");
    if (corrected.crossedLegFrames > 0) failReasons.push("crossed legs remain");
    if (corrected.jointAngleOutlierFrames > Math.max(20, corrected.validPoseFrames * 0.08)) failReasons.push("joint angle outliers remain");
    if (corrected.maxBoneRangeRel > 1.0) failReasons.push("bone length variance remains high");
    if (failReasons.length) failures.push({ file, failReasons, corrected });
    rows.push({ file, raw, corrected });
  }
  const summary = {
    inputDir,
    files: files.length,
    failures,
    aggregate: rows.reduce((acc, row) => {
      acc.rawCrossedLegFrames += row.raw.crossedLegFrames;
      acc.correctedCrossedLegFrames += row.corrected.crossedLegFrames;
      acc.rawJointAngleOutliers += row.raw.jointAngleOutlierFrames;
      acc.correctedJointAngleOutliers += row.corrected.jointAngleOutlierFrames;
      acc.rawArmBehindFrames += row.raw.armBehindFrames;
      acc.correctedArmBehindFrames += row.corrected.armBehindFrames;
      acc.maxCorrectedBoneRangeRel = Math.max(acc.maxCorrectedBoneRangeRel, row.corrected.maxBoneRangeRel);
      return acc;
    }, {
      rawCrossedLegFrames: 0,
      correctedCrossedLegFrames: 0,
      rawJointAngleOutliers: 0,
      correctedJointAngleOutliers: 0,
      rawArmBehindFrames: 0,
      correctedArmBehindFrames: 0,
      maxCorrectedBoneRangeRel: 0
    })
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failures.length ? 1 : 0);
}

summarize();
