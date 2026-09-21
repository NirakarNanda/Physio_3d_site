"""
Generates public/models/skeleton.glb — a detailed, anatomically-proportioned
procedural human skeleton built from primitives (boxes, spheres, capsules and
swept tubes) using only numpy + the stdlib (no trimesh/pygltflib/network).

The rig is ~1.78 m tall, feet at y = 0, facing +Z, and every mesh is named to
match components/anatomy/anatomyMapping.ts keyword patterns, so each bone
auto-classifies into its anatomy group (skull, spine, ribCage, shoulder, arm,
hand, pelvis, hip, knee, ankle, foot) with zero unassigned meshes.

Meshes in groups whose scroll section sets `separate: true` also carry a
`separationOffset` node extra (a unit direction vector). AnatomyController.tsx
reads it to drive the exploded-joint effect — ribs push outward, vertebrae
spread vertically, limb bones slide along the limb, the patella pops forward.

All triangle winding is verified outward-facing at build time (per-triangle
face normal vs. analytic vertex normals), so the model renders correctly with
three.js's default front-face culling.

Run:  python3 scripts/generate_skeleton_glb.py
"""

import json
import re
import struct
from pathlib import Path

import numpy as np

OUT_PATH = Path(__file__).resolve().parent.parent / "public" / "models" / "skeleton.glb"

# ---------------------------------------------------------------------------
# Primitive geometry generators.
# Each returns (positions Nx3 float32, normals Nx3 float32, indices Mx3 int64)
# in local space, with outward-facing CCW winding (verified by check_winding).
# ---------------------------------------------------------------------------

def make_box(size):
    sx, sy, sz = [s / 2 for s in size]
    # 24 verts (4 per face) so normals stay flat per face.
    faces = [
        ((0, 0, 1), [(-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]),
        ((0, 0, -1), [(sx, -sy, -sz), (-sx, -sy, -sz), (-sx, sy, -sz), (sx, sy, -sz)]),
        ((0, 1, 0), [(-sx, sy, sz), (sx, sy, sz), (sx, sy, -sz), (-sx, sy, -sz)]),
        ((0, -1, 0), [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, -sy, sz), (-sx, -sy, sz)]),
        ((1, 0, 0), [(sx, -sy, sz), (sx, -sy, -sz), (sx, sy, -sz), (sx, sy, sz)]),
        ((-1, 0, 0), [(-sx, -sy, -sz), (-sx, -sy, sz), (-sx, sy, sz), (-sx, sy, -sz)]),
    ]
    positions, normals, indices = [], [], []
    for normal, corners in faces:
        base = len(positions)
        for c in corners:
            positions.append(c)
            normals.append(normal)
        indices += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def make_sphere(radius, segments=12, rings=8):
    positions, normals = [], []
    for i in range(rings + 1):
        theta = np.pi * i / rings
        for j in range(segments + 1):
            phi = 2 * np.pi * j / segments
            x = np.sin(theta) * np.cos(phi)
            y = np.cos(theta)
            z = np.sin(theta) * np.sin(phi)
            positions.append((x * radius, y * radius, z * radius))
            normals.append((x, y, z))
    indices = []
    for i in range(rings):
        for j in range(segments):
            a = i * (segments + 1) + j
            b = a + segments + 1
            indices += [(a, a + 1, b), (b, a + 1, b + 1)]
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def make_cylinder(radius, height, segments=12):
    positions, normals = [], []
    half = height / 2
    # Side wall (verified outward).
    for i in range(2):
        y = -half if i == 0 else half
        for j in range(segments + 1):
            phi = 2 * np.pi * j / segments
            x, z = np.cos(phi) * radius, np.sin(phi) * radius
            positions.append((x, y, z))
            normals.append((x / radius, 0, z / radius))
    indices = []
    for j in range(segments):
        a, b = j, j + segments + 1
        indices += [(a, b, a + 1), (a + 1, b, b + 1)]
    # Caps get dedicated rim verts with axial normals so the winding check
    # stays meaningful (radial normals would be ~perpendicular to the face).
    top_center = len(positions)
    positions.append((0, half, 0)); normals.append((0, 1, 0))
    bottom_center = len(positions)
    positions.append((0, -half, 0)); normals.append((0, -1, 0))
    top_ring_start = len(positions)
    for j in range(segments + 1):
        phi = 2 * np.pi * j / segments
        positions.append((np.cos(phi) * radius, half, np.sin(phi) * radius))
        normals.append((0, 1, 0))
    bottom_ring_start = len(positions)
    for j in range(segments + 1):
        phi = 2 * np.pi * j / segments
        positions.append((np.cos(phi) * radius, -half, np.sin(phi) * radius))
        normals.append((0, -1, 0))
    for j in range(segments):
        a, b = top_ring_start + j, top_ring_start + j + 1
        indices.append((top_center, b, a))      # outward = +Y
        a, b = bottom_ring_start + j, bottom_ring_start + j + 1
        indices.append((bottom_center, a, b))   # outward = -Y
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def make_capsule(radius, length, segments=12, rings=8):
    """Capsule along +Y: cylinder of `length` with hemispherical caps.
    Total height = length + 2 * radius."""
    positions, normals = [], []
    rows = rings * 2
    for i in range(rows + 1):
        theta = np.pi * i / rows
        s = 1.0 if theta <= np.pi / 2 else -1.0
        y = radius * np.cos(theta) + s * length / 2
        rho = radius * np.sin(theta)
        for j in range(segments + 1):
            phi = 2 * np.pi * j / segments
            positions.append((rho * np.cos(phi), y, rho * np.sin(phi)))
            normals.append((np.sin(theta) * np.cos(phi), np.cos(theta), np.sin(theta) * np.sin(phi)))
    indices = []
    for i in range(rows):
        for j in range(segments):
            a = i * (segments + 1) + j
            b = a + segments + 1
            indices += [(a, a + 1, b), (b, a + 1, b + 1)]
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def _catmull_rom(points, samples_per_segment=10):
    pts = [np.array(p, dtype=np.float64) for p in points]
    out = []
    for i in range(len(pts) - 1):
        p0 = pts[max(0, i - 1)]
        p1 = pts[i]
        p2 = pts[i + 1]
        p3 = pts[min(len(pts) - 1, i + 2)]
        for s in range(samples_per_segment):
            t = s / samples_per_segment
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t +
                              (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-1].copy())
    return out


def make_tube(points, radius, radial_segments=7, samples_per_segment=10):
    """Swept circular tube along a 3D path (for ribs, clavicles). Capped."""
    spine = _catmull_rom(points, samples_per_segment)
    n = len(spine)
    tangents = []
    for i in range(n):
        a = spine[max(0, i - 1)]
        b = spine[min(n - 1, i + 1)]
        t = b - a
        tangents.append(t / (np.linalg.norm(t) + 1e-12))

    positions, normals = [], []
    # Parallel-transport frames: propagate the ring orientation along the
    # curve with minimal twist. (A fixed world-up reference would swing the
    # frame wildly where the tangent turns quickly, e.g. the rib angle,
    # shearing quads until some triangles face inward.)
    t0 = tangents[0]
    up = np.array([0.0, 1.0, 0.0])
    if abs(float(np.dot(t0, up))) > 0.92:
        up = np.array([1.0, 0.0, 0.0])
    n0 = np.cross(up, t0); n0 /= np.linalg.norm(n0)
    b0 = np.cross(t0, n0)
    frames = [(n0, b0)]
    for i in range(1, n):
        t = tangents[i]
        n_prev = frames[-1][0]
        nn = n_prev - t * float(np.dot(n_prev, t))
        nl = np.linalg.norm(nn)
        if nl < 1e-9:  # degenerate: rebuild from world up
            nn = np.cross(up, t); nl = np.linalg.norm(nn)
        nn /= nl
        frames.append((nn, np.cross(t, nn)))
    for i in range(n):
        nrm, binorm = frames[i]
        for j in range(radial_segments + 1):
            phi = 2 * np.pi * j / radial_segments
            d = np.cos(phi) * nrm + np.sin(phi) * binorm
            positions.append(spine[i] + radius * d)
            normals.append(d)
    indices = []
    ring = radial_segments + 1
    for i in range(n - 1):
        for j in range(radial_segments):
            a = i * ring + j
            b = (i + 1) * ring + j
            indices += [(a, a + 1, b), (b, a + 1, b + 1)]

    def add_cap(center_idx_point, tangent, flip):
        ci = len(positions)
        positions.append(spine[center_idx_point])
        cap_n = (-tangent if flip else tangent)
        normals.append(cap_n)
        rim_start = len(positions)
        # Rebuild the end ring with axial (cap) normals, reusing the
        # parallel-transport frame at that end of the tube.
        nrm, binorm = frames[center_idx_point]
        for j in range(radial_segments + 1):
            phi = 2 * np.pi * j / radial_segments
            d = np.cos(phi) * nrm + np.sin(phi) * binorm
            positions.append(spine[center_idx_point] + radius * d)
            normals.append(cap_n)
        for j in range(radial_segments):
            a, b = rim_start + j, rim_start + j + 1
            # Order chosen so the fan normal matches cap_n (verified below).
            tri = (ci, b, a) if flip else (ci, a, b)
            v0 = np.array(positions[tri[0]]); v1 = np.array(positions[tri[1]]); v2 = np.array(positions[tri[2]])
            fn = np.cross(v1 - v0, v2 - v0)
            if float(np.dot(fn, cap_n)) < 0:
                tri = (tri[0], tri[2], tri[1])
            indices.append(tri)

    add_cap(0, tangents[0], flip=True)    # start cap faces backwards
    add_cap(n - 1, tangents[-1], flip=False)  # end cap faces forwards
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


# ---------------------------------------------------------------------------
# Transforms (baked into vertex data; nodes carry translation only).
# ---------------------------------------------------------------------------

def xform(geo, scale=None, rotate=None, translate=None):
    pos, nrm, idx = geo
    pos = pos.astype(np.float64).copy()
    nrm = nrm.astype(np.float64).copy()
    if scale is not None:
        s = np.array(scale, dtype=np.float64)
        pos *= s
        nrm /= s
    if rotate is not None:
        rx, ry, rz = rotate
        cx, sx_ = np.cos(rx), np.sin(rx)
        cy, sy_ = np.cos(ry), np.sin(ry)
        cz, sz_ = np.cos(rz), np.sin(rz)
        Rx = np.array([[1, 0, 0], [0, cx, -sx_], [0, sx_, cx]])
        Ry = np.array([[cy, 0, sy_], [0, 1, 0], [-sy_, 0, cy]])
        Rz = np.array([[cz, -sz_, 0], [sz_, cz, 0], [0, 0, 1]])
        R = Rz @ Ry @ Rx
        pos = pos @ R.T
        nrm = nrm @ R.T
    if translate is not None:
        pos += np.array(translate, dtype=np.float64)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    return pos.astype(np.float32), nrm.astype(np.float32), idx


def capsule_between(p0, p1, radius, segments=12, rings=6):
    """Capsule stretched between two points."""
    p0 = np.array(p0, dtype=np.float64)
    p1 = np.array(p1, dtype=np.float64)
    d = p1 - p0
    length = float(np.linalg.norm(d)) - 2 * radius
    length = max(length, 0.001)
    geo = make_capsule(radius, length, segments=segments, rings=rings)
    # Align +Y to d.
    dn = d / (np.linalg.norm(d) + 1e-12)
    y = np.array([0.0, 1.0, 0.0])
    axis = np.cross(y, dn)
    angle = np.arccos(np.clip(float(np.dot(y, dn)), -1, 1))
    if np.linalg.norm(axis) < 1e-9:
        # d is parallel/anti-parallel to +Y: rotate π about Z (proper
        # rotation, det=+1) or identity. A bare -I would be a reflection
        # (det=-1) and flip triangle winding.
        R = np.eye(3) if angle < 1e-9 else np.diag([-1.0, -1.0, 1.0])
    else:
        axis = axis / np.linalg.norm(axis)
        K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
        R = np.eye(3) + np.sin(angle) * K + (1 - np.cos(angle)) * (K @ K)
    pos, nrm, idx = geo
    pos = (pos.astype(np.float64) @ R.T) + (p0 + p1) / 2
    nrm = nrm.astype(np.float64) @ R.T
    return pos.astype(np.float32), nrm.astype(np.float32), idx


def check_winding(name, geo):
    """Assert every non-degenerate triangle faces outward: the geometric
    face normal must agree with the analytic vertex normals."""
    pos, nrm, idx = geo
    pos = pos.astype(np.float64)
    nrm = nrm.astype(np.float64)
    idx = np.asarray(idx, dtype=np.int64)
    bad = 0
    for tri in idx:
        v0, v1, v2 = pos[tri[0]], pos[tri[1]], pos[tri[2]]
        e1, e2 = v1 - v0, v2 - v0
        fn = np.cross(e1, e2)
        area = np.linalg.norm(fn)
        if area < 1e-12:
            continue  # degenerate pole triangles are harmless
        fn /= area
        vn = nrm[tri[0]] + nrm[tri[1]] + nrm[tri[2]]
        vn /= np.linalg.norm(vn) + 1e-12
        if float(np.dot(fn, vn)) <= 1e-6:
            bad += 1
    assert bad == 0, f"{name}: {bad} inward-facing triangles"

# ---------------------------------------------------------------------------
# Skeleton layout.
# Each entry: (name, geometry-factory-lambda, separationOffset or None).
# Names match components/anatomy/anatomyMapping.ts keyword patterns.
# separationOffset is a unit direction written to the GLB node extras; the
# AnatomyController multiplies it by ~3 cm * emphasis for the exploded view.
# ---------------------------------------------------------------------------

def _norm(v):
    v = np.array(v, dtype=np.float64)
    n = np.linalg.norm(v)
    return (v / n).tolist() if n > 1e-9 else [0.0, 0.0, 0.0]

BONES = []

def bone(name, geo_fn, separation=None):
    BONES.append((name, geo_fn, _norm(separation) if separation else None))

# -- Skull -----------------------------------------------------------------
bone("Skull_Cranium",
     lambda: xform(make_sphere(0.105), scale=(0.92, 1.08, 1.12), translate=(0, 1.685, -0.015)))
bone("Skull_Face",
     lambda: xform(make_box((0.115, 0.10, 0.095)), translate=(0, 1.600, 0.055)))
bone("Mandible",
     lambda: xform(make_box((0.100, 0.045, 0.075)), translate=(0, 1.545, 0.045)))

# -- Spine: 24 vertebrae + sacrum ------------------------------------------
def vertebra(name, y, z, body, proc=None, pz=0.0):
    bone(name, lambda: xform(make_box(body), translate=(0, y, z)),
         separation=(0, 1 if y > 1.2 else -1, 0))
    if proc:
        bone(name + "_Process",
             lambda: xform(make_box(proc), translate=(0, y, z + pz)),
             separation=(0, 1 if y > 1.2 else -1, -0.4))

cerv_y = [1.505 - i * 0.0175 for i in range(7)]
for i, y in enumerate(cerv_y):
    vertebra(f"Vertebra_C{i + 1}", y, 0.006, (0.040, 0.016, 0.036))
thor_y = [1.385 - i * 0.026 for i in range(12)]
for i, y in enumerate(thor_y):
    vertebra(f"Vertebra_T{i + 1}", y, -0.012, (0.052, 0.022, 0.048),
             proc=(0.014, 0.014, 0.045), pz=-0.042)
lumb_y = [1.075 - i * 0.036 for i in range(5)]
for i, y in enumerate(lumb_y):
    vertebra(f"Vertebra_L{i + 1}", y, 0.008, (0.072, 0.030, 0.062),
             proc=(0.018, 0.018, 0.055), pz=-0.052)
bone("Sacrum",
     lambda: xform(make_box((0.095, 0.115, 0.050)), translate=(0, 0.875, -0.008)),
     separation=(0, -1, -0.2))

# -- Rib cage: 12 swept rib pairs + sternum ---------------------------------
rib_widths = [0.075, 0.095, 0.110, 0.122, 0.130, 0.136, 0.140, 0.138, 0.130, 0.118, 0.100, 0.085]
for i in range(12):
    y = 1.425 - i * 0.0295
    w = rib_widths[i]
    for s, side in ((-1, "L"), (1, "R")):
        # Rounded control polygon: the rib sweeps back to its angle, then
        # curves gently forward. Turns stay well under 90° so the swept tube
        # never self-intersects (which would flip triangle winding).
        pts = [
            (s * 0.026, y, -0.030),
            (s * w * 0.45, y + 0.010, -0.070),
            (s * w * 0.75, y + 0.002, -0.075),
            (s * w * 1.00, y - 0.015, -0.030),
        ]
        if i < 7:
            pts += [(s * w * 0.90, y - 0.042, 0.050),
                    (s * w * 0.52, y - 0.062, 0.125)]
        elif i < 10:
            pts += [(s * w * 0.90, y - 0.042, 0.050),
                    (s * w * 0.72, y - 0.055, 0.095)]
        else:
            # Floating ribs (11-12) taper off laterally — no forward hook.
            pts.append((s * w * 1.02, y - 0.028, 0.005))
        bone(f"Rib_{i + 1:02d}_{side}",
             lambda p=pts: make_tube(p, 0.007, samples_per_segment=12),
             separation=(s * 0.9, 0, 0.25))
bone("Sternum",
     lambda: xform(make_box((0.045, 0.185, 0.018)), translate=(0, 1.315, 0.148)),
     separation=(0, 0, 1))
bone("Sternum_Manubrium",
     lambda: xform(make_box((0.062, 0.050, 0.020)), translate=(0, 1.425, 0.144)),
     separation=(0, 0.3, 1))

# -- Shoulder girdle ---------------------------------------------------------
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Clavicle_{side}",
         lambda s=s: make_tube([
             (s * 0.030, 1.458, 0.138), (s * 0.100, 1.472, 0.115),
             (s * 0.160, 1.468, 0.060), (s * 0.205, 1.452, 0.012),
         ], 0.0105),
         separation=(s, 0.15, 0))
    bone(f"Scapula_{side}",
         lambda s=s: xform(make_box((0.095, 0.135, 0.016)),
                                    rotate=(0.06, -s * 0.38, s * 0.08),
                                    translate=(s * 0.128, 1.345, -0.112)),
         separation=(s, 0.1, -0.35))

# -- Arms --------------------------------------------------------------------
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Humerus_{side}",
         lambda s=s: capsule_between((s * 0.222, 1.425, 0), (s * 0.243, 1.135, 0), 0.026),
         separation=(s * 0.25, -1, 0))
    bone(f"Radius_{side}",
         lambda s=s: capsule_between((s * 0.248, 1.100, 0.010), (s * 0.252, 0.872, 0.010), 0.015),
         separation=(s * 0.25, -1, 0))
    bone(f"Ulna_{side}",
         lambda s=s: capsule_between((s * 0.233, 1.105, -0.012), (s * 0.238, 0.868, -0.006), 0.017),
         separation=(s * 0.25, -1, 0))
    bone(f"Carpal_{side}_01",
         lambda s=s: xform(make_sphere(0.019), translate=(s * 0.245, 0.848, 0.012)),
         separation=(s * 0.2, -1, 0.1))
    bone(f"Carpal_{side}_02",
         lambda s=s: xform(make_sphere(0.019), translate=(s * 0.245, 0.848, -0.014)),
         separation=(s * 0.2, -1, 0.1))

# -- Hands -------------------------------------------------------------------
for s, side in ((-1, "L"), (1, "R")):
    for f in range(4):
        x = s * (0.222 + f * 0.016)
        bone(f"Metacarpal_{side}_{f + 1:02d}",
             lambda x=x: capsule_between((x, 0.830, 0.008), (x, 0.758, 0.010), 0.0085),
             separation=(s * 0.2, -1, 0.1))
        y0, r = 0.758, [0.0075, 0.0065, 0.0055]
        segs = [(0.034, r[0]), (0.027, r[1]), (0.022, r[2])]
        for p, (ln, pr) in enumerate(segs):
            # Stacked segments along -Y; capsule_between makes each segment
            # `ln` tall including its rounded ends.
            a = (x, y0 - 0.004, 0.010)
            b = (x, y0 - ln - 0.004, 0.010)
            bone(f"Finger_{side}_{f + 1}_Phalanx_{p + 1}",
                 lambda a=a, b=b, pr=pr: capsule_between(a, b, pr),
                 separation=(s * 0.2, -1, 0.1))
            y0 -= ln + 0.006
    bone(f"Thumb_{side}_1",
         lambda s=s: capsule_between((s * 0.208, 0.815, 0.012), (s * 0.190, 0.772, 0.028), 0.0085),
         separation=(s * 0.35, -0.9, 0.2))
    bone(f"Thumb_{side}_2",
         lambda s=s: capsule_between((s * 0.190, 0.772, 0.028), (s * 0.178, 0.738, 0.040), 0.0075),
         separation=(s * 0.35, -0.9, 0.2))

# -- Pelvis ------------------------------------------------------------------
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Pelvis_Ilium_{side}",
         lambda s=s: xform(make_box((0.125, 0.145, 0.028)),
                            rotate=(0, -s * 0.45, s * 0.12),
                            translate=(s * 0.112, 0.958, -0.012)))
    bone(f"Pelvis_Ischium_{side}",
         lambda s=s: xform(make_box((0.065, 0.085, 0.050)),
                            translate=(s * 0.072, 0.868, -0.022)))
    bone(f"Pelvis_Pubis_{side}",
         lambda s=s: xform(make_box((0.055, 0.045, 0.040)),
                            translate=(s * 0.048, 0.878, 0.058)))

# -- Legs ----------------------------------------------------------------------
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Femoral_Head_{side}",
         lambda s=s: xform(make_sphere(0.042), translate=(s * 0.092, 0.888, 0.008)),
         separation=(s * 0.85, -0.35, 0))
    bone(f"Hip_Femur_{side}",
         lambda s=s: capsule_between((s * 0.098, 0.858, 0.002), (s * 0.112, 0.535, 0.006), 0.029),
         separation=(s * 0.85, -0.35, 0))
    bone(f"Knee_Distal_Femur_{side}",
         lambda s=s: capsule_between((s * 0.112, 0.535, 0.006), (s * 0.114, 0.452, 0.010), 0.035),
         separation=(0, 0.9, 0.15))
    bone(f"Patella_{side}",
         lambda s=s: xform(make_sphere(0.027), scale=(1, 1.15, 0.55),
                            translate=(s * 0.114, 0.452, 0.048)),
         separation=(0, 0, 1))
    bone(f"Knee_Proximal_Tibia_{side}",
         lambda s=s: capsule_between((s * 0.114, 0.432, 0.006), (s * 0.115, 0.335, 0.006), 0.031),
         separation=(0, -1, 0))
    bone(f"Knee_Tibia_{side}",
         lambda s=s: capsule_between((s * 0.115, 0.335, 0.006), (s * 0.115, 0.135, 0.006), 0.023),
         separation=(0, -1, 0))
    bone(f"Knee_Fibula_{side}",
         lambda s=s: capsule_between((s * 0.148, 0.400, -0.004), (s * 0.146, 0.125, -0.004), 0.0105),
         separation=(s * 0.3, -1, 0))
    bone(f"Distal_Tibia_{side}",
         lambda s=s: xform(make_box((0.052, 0.058, 0.048)),
                                    translate=(s * 0.115, 0.105, 0.006)))
    bone(f"Distal_Fibula_{side}",
         lambda s=s: xform(make_box((0.028, 0.065, 0.032)),
                                    translate=(s * 0.148, 0.098, -0.004)))
    bone(f"Talus_{side}",
         lambda s=s: xform(make_sphere(0.029), translate=(s * 0.117, 0.068, 0.012)))
    bone(f"Calcaneus_{side}",
         lambda s=s: xform(make_box((0.052, 0.052, 0.082)),
                                    translate=(s * 0.117, 0.030, -0.028)))
    bone(f"Tarsal_{side}_01",
         lambda s=s: xform(make_sphere(0.020), translate=(s * 0.117, 0.052, 0.048)))
    bone(f"Tarsal_{side}_02",
         lambda s=s: xform(make_sphere(0.018), translate=(s * 0.117, 0.046, 0.078)))
    for t in range(5):
        off = -0.024 + t * 0.012
        bone(f"Metatarsal_{side}_{t + 1:02d}",
             lambda s=s, off=off: capsule_between(
                 (s * 0.117 + off, 0.030, 0.055), (s * 0.117 + off, 0.026, 0.128), 0.0075))
        pr = 0.0075 if t == 2 else 0.006
        # Named without "Phalanx" — that keyword belongs to the hand group;
        # /toe/i alone routes these to the foot group.
        bone(f"Toe_{side}_{t + 1:02d}",
             lambda s=s, off=off, pr=pr: capsule_between(
                 (s * 0.117 + off, 0.026, 0.132), (s * 0.117 + off, 0.024, 0.158), pr))

# ---------------------------------------------------------------------------
# Build-time self-checks: every mesh must classify into its expected anatomy
# group (ports the ANATOMY_KEYWORDS regexes from anatomyMapping.ts), and every
# triangle must wind outward.
# ---------------------------------------------------------------------------

KEYWORDS = {
    "skull": [r"skull", r"cranium", r"mandible", r"^jaw", r"head[_-]?bone"],
    "spine": [r"spine", r"vertebra", r"vertebrae", r"cervical", r"lumbar", r"sacrum",
              r"coccyx", r"^c[1-7]$", r"^t[1-9]$|^t1[0-2]$", r"^l[1-5]$"],
    "ribCage": [r"rib", r"sternum", r"thora[cx]", r"costal"],
    "shoulder": [r"clavicle", r"scapula", r"shoulder"],
    "arm": [r"humerus", r"radius", r"ulna", r"forearm", r"(^|[_-])arm([_-]|$)"],
    "hand": [r"carpal", r"metacarpal", r"phalan(x|ge)", r"(^|[_-])hand([_-]|$)",
             r"finger", r"thumb"],
    "pelvis": [r"pelvis", r"pelvic", r"ilium", r"ischium", r"pubis"],
    "hip": [r"hip", r"femur[_-]?head", r"femoral[_-]?head", r"acetabulum"],
    "knee": [r"knee", r"patella", r"distal[_-]?femur", r"proximal[_-]?tibia",
             r"tibial[_-]?plateau"],
    "ankle": [r"ankle", r"talus", r"distal[_-]?tibia", r"distal[_-]?fibula", r"malleolus"],
    "foot": [r"tarsal", r"metatarsal", r"calcaneus", r"(^|[_-])foot([_-]|$)", r"toe"],
}
GROUP_ORDER = ["skull", "spine", "ribCage", "shoulder", "arm", "hand",
               "pelvis", "hip", "knee", "ankle", "foot"]
COMPILED = {k: [re.compile(p, re.IGNORECASE) for p in v] for k, v in KEYWORDS.items()}


def classify(name):
    for key in GROUP_ORDER:
        if any(p.search(name) for p in COMPILED[key]):
            return key
    return None


EXPECTED_GROUP = {}
for _name, _geo_fn, _sep in BONES:
    if _name.startswith("Skull") or _name == "Mandible":
        EXPECTED_GROUP[_name] = "skull"
    elif _name.startswith("Vertebra") or _name == "Sacrum":
        EXPECTED_GROUP[_name] = "spine"
    elif _name.startswith("Rib") or _name.startswith("Sternum"):
        EXPECTED_GROUP[_name] = "ribCage"
    elif _name.startswith("Clavicle") or _name.startswith("Scapula"):
        EXPECTED_GROUP[_name] = "shoulder"
    elif any(_name.startswith(p) for p in ("Humerus", "Radius", "Ulna")):
        EXPECTED_GROUP[_name] = "arm"
    elif any(_name.startswith(p) for p in ("Carpal", "Metacarpal", "Finger", "Thumb")):
        EXPECTED_GROUP[_name] = "hand"
    elif _name.startswith("Pelvis"):
        EXPECTED_GROUP[_name] = "pelvis"
    elif _name.startswith("Femoral") or _name.startswith("Hip_Femur"):
        EXPECTED_GROUP[_name] = "hip"
    elif _name.startswith("Knee") or _name.startswith("Patella"):
        EXPECTED_GROUP[_name] = "knee"
    elif _name.startswith("Distal") or _name.startswith("Talus"):
        EXPECTED_GROUP[_name] = "ankle"
    elif any(_name.startswith(p) for p in ("Calcaneus", "Tarsal", "Metatarsal", "Toe")):
        EXPECTED_GROUP[_name] = "foot"
    else:
        raise AssertionError(f"No expected group for {_name}")


# ---------------------------------------------------------------------------
# glTF 2.0 binary writer.
# ---------------------------------------------------------------------------

def build_gltf():
    buffer_bytes = bytearray()
    accessors, buffer_views, meshes, nodes = [], [], [], []

    def push_accessor(array, component_type, gltf_type, target, min_max=False):
        byte_offset = len(buffer_bytes)
        data = array.tobytes()
        buffer_bytes.extend(data)
        pad = (-len(buffer_bytes)) % 4
        buffer_bytes.extend(b"\x00" * pad)
        buffer_views.append({
            "buffer": 0, "byteOffset": byte_offset,
            "byteLength": len(data), "target": target,
        })
        accessor = {
            "bufferView": len(buffer_views) - 1,
            "componentType": component_type,
            "count": array.shape[0], "type": gltf_type,
        }
        if min_max:
            accessor["min"] = array.min(axis=0).tolist()
            accessor["max"] = array.max(axis=0).tolist()
        accessors.append(accessor)
        return len(accessors) - 1

    for name, geo_fn, separation in BONES:
        geo = geo_fn()
        check_winding(name, geo)
        actual = classify(name)
        expected = EXPECTED_GROUP[name]
        assert actual == expected, f"{name}: classified as {actual}, expected {expected}"

        positions, normals, indices = geo
        pos_idx = push_accessor(positions, 5126, "VEC3", 34962, min_max=True)
        norm_idx = push_accessor(normals, 5126, "VEC3", 34962)
        idx_idx = push_accessor(indices.reshape(-1).astype(np.uint32), 5125, "SCALAR", 34963)

        meshes.append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": pos_idx, "NORMAL": norm_idx},
                "indices": idx_idx, "mode": 4, "material": 0,
            }],
        })
        node = {"name": name, "mesh": len(meshes) - 1}
        if separation is not None:
            node["extras"] = {"separationOffset": separation}
        nodes.append(node)

    gltf = {
        "asset": {"version": "2.0", "generator": "physio-site skeleton exporter v2"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "materials": [{
            "name": "Bone",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.937, 0.914, 0.863, 1.0],
                "metallicFactor": 0.03, "roughnessFactor": 0.55,
            },
        }],
        "buffers": [{"byteLength": len(buffer_bytes)}],
    }
    return gltf, bytes(buffer_bytes)


def write_glb(gltf, bin_chunk, out_path):
    json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((-len(json_chunk)) % 4)
    bin_chunk = bin_chunk + b"\x00" * ((-len(bin_chunk)) % 4)
    total_length = 12 + (8 + len(json_chunk)) + (8 + len(bin_chunk))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total_length))
        f.write(struct.pack("<II", len(json_chunk), 0x4E4F534A))
        f.write(json_chunk)
        f.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
        f.write(bin_chunk)


if __name__ == "__main__":
    gltf, bin_chunk = build_gltf()
    write_glb(gltf, bin_chunk, OUT_PATH)
    size_kb = OUT_PATH.stat().st_size / 1024
    groups = {}
    for name, _, _ in BONES:
        groups[classify(name)] = groups.get(classify(name), 0) + 1
    print(f"Wrote {OUT_PATH} ({size_kb:.1f} KB, {len(BONES)} meshes)")
    print("Group counts:", {k: groups.get(k, 0) for k in GROUP_ORDER})
