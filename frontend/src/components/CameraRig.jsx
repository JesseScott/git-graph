import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CAMERA_OFFSET = new THREE.Vector3(0, 4, 10); // behind and above the commit

/**
 * Snaps the camera to look at the current commit's position.
 * In orbit mode it steps back and lets OrbitControls take over.
 */
export function CameraRig({ targetPosition, orbitMode, orbitControlsRef }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const snapped = useRef(false);

  useEffect(() => {
    if (!targetPosition) return;
    const [x, y, z] = targetPosition;
    targetPos.current.set(x + CAMERA_OFFSET.x, y + CAMERA_OFFSET.y, z + CAMERA_OFFSET.z);
    targetLook.current.set(x, y, z);
    snapped.current = false;

    // When entering orbit mode, sync OrbitControls target to current commit
    if (orbitMode && orbitControlsRef?.current) {
      orbitControlsRef.current.target.set(x, y, z);
      orbitControlsRef.current.update();
    }
  }, [targetPosition, orbitMode, orbitControlsRef]);

  useFrame(() => {
    // In orbit mode the rig does nothing — OrbitControls has full control
    if (orbitMode) return;
    if (snapped.current) return;

    // Snap immediately (no lerp) to the target position
    camera.position.copy(targetPos.current);
    camera.lookAt(targetLook.current);
    snapped.current = true;
  });

  return null;
}
