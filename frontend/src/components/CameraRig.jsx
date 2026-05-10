import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const LERP_SPEED = 0.06;
const ARRIVE_THRESHOLD = 0.02;
const CAM_HEIGHT = 4;
const CAM_DIST = 10;

function getRestPosition(commitPos, facing) {
  const [x, y, z] = commitPos;
  const zOff = facing === 'newest' ? -CAM_DIST : CAM_DIST;
  return new THREE.Vector3(x, y + CAM_HEIGHT, z + zOff);
}

export function CameraRig({ targetPosition, orbitMode, orbitControlsRef, facing = 'oldest' }) {
  const { camera } = useThree();

  // Where we want to end up
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());

  // What the camera is actually lerping towards each frame
  const currentLook = useRef(new THREE.Vector3());

  // Swoop arc state
  const swoopActive = useRef(false);
  const swoopProgress = useRef(0);
  const swoopFrom = useRef(new THREE.Vector3());
  const swoopMid = useRef(new THREE.Vector3());   // apex of arc
  const swoopTo = useRef(new THREE.Vector3());
  const swoopLook = useRef(new THREE.Vector3());

  const facingRef = useRef(facing);
  const arrived = useRef(false);

  function setTarget(position, dir) {
    if (!position) return;
    const [x, y, z] = position;
    targetPos.current.copy(getRestPosition(position, dir));
    targetLook.current.set(x, y, z);
    arrived.current = false;
  }

  // Normal commit-to-commit movement
  useEffect(() => {
    if (swoopActive.current) return; // let swoop finish first
    setTarget(targetPosition, facing);

    if (orbitMode && orbitControlsRef?.current && targetPosition) {
      const [x, y, z] = targetPosition;
      orbitControlsRef.current.target.set(x, y, z);
      orbitControlsRef.current.update();
    }
  }, [targetPosition, orbitMode]);

  // Facing flip — start a swoop arc
  useEffect(() => {
    if (facingRef.current === facing) return;
    facingRef.current = facing;
    if (!targetPosition) return;

    const [x, y, z] = targetPosition;

    // Arc: from current camera pos → high midpoint directly above commit → new rest pos
    swoopFrom.current.copy(camera.position);
    swoopMid.current.set(x, y + CAM_DIST * 1.8, z); // high apex above the commit
    swoopTo.current.copy(getRestPosition(targetPosition, facing));
    swoopLook.current.set(x, y, z);

    swoopProgress.current = 0;
    swoopActive.current = true;
    arrived.current = false;
  }, [facing]);

  useFrame((_, delta) => {
    if (orbitMode) return;

    if (swoopActive.current) {
      // Advance swoop using delta time for frame-rate independence
      swoopProgress.current = Math.min(1, swoopProgress.current + delta * 0.8);
      const t = swoopProgress.current;

      // Quadratic bezier: P = (1-t)²·from + 2(1-t)t·mid + t²·to
      const mt = 1 - t;
      camera.position.set(
        mt * mt * swoopFrom.current.x + 2 * mt * t * swoopMid.current.x + t * t * swoopTo.current.x,
        mt * mt * swoopFrom.current.y + 2 * mt * t * swoopMid.current.y + t * t * swoopTo.current.y,
        mt * mt * swoopFrom.current.z + 2 * mt * t * swoopMid.current.z + t * t * swoopTo.current.z,
      );
      camera.lookAt(swoopLook.current);

      if (t >= 1) {
        swoopActive.current = false;
        // Hand off to normal lerp from new position
        setTarget(targetPosition, facing);
        currentLook.current.copy(swoopLook.current);
      }
      return;
    }

    if (arrived.current) return;

    camera.position.lerp(targetPos.current, LERP_SPEED);
    currentLook.current.lerp(targetLook.current, LERP_SPEED);
    camera.lookAt(currentLook.current);

    if (camera.position.distanceTo(targetPos.current) < ARRIVE_THRESHOLD) {
      camera.position.copy(targetPos.current);
      currentLook.current.copy(targetLook.current);
      camera.lookAt(currentLook.current);
      arrived.current = true;
    }
  });

  return null;
}