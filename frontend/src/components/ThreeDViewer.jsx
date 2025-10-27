// src/components/ThreeDViewer.jsx
import React, { useRef, useEffect, useImperativeHandle, forwardRef, Suspense } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Grid, TransformControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * ThreeDViewer
 * Props:
 *  - layout: { rooms: [ {name, size, x, y, rotation? , scale? } ] }
 *  - selectedRoomName
 *  - onSelectRoom(name)
 *  - onTransformEnd(name, { x, y, rotationY, scale })
 *  - mode: "translate" | "rotate" | "scale"
 *  - snap: number (optional) - grid snap size in same units as x,y
 */

  // Demo exterior: simple house + trees
  const DemoExteriorScene = () => {
    return (
      <>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 7]} intensity={0.9} />
        {/* ground */}
        <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={'#7fbf7f'} />
        </mesh>

        {/* simple house */}
        <group position={[0, 0.75, 0]}> 
          <mesh position={[0, 0.35, 0]}> <boxGeometry args={[3, 0.6, 3]} /> <meshStandardMaterial color={'#efe1d6'} /> </mesh>
          <mesh position={[0, 1.05, 0]}> <coneGeometry args={[1.8, 1.2, 4]} /> <meshStandardMaterial color={'#b55a3c'} /></mesh>
          <mesh position={[0, 0.18, 1.55]}> <boxGeometry args={[0.8, 0.5, 0.02]} /> <meshStandardMaterial color={'#333'} /></mesh>
        </group>

        {/* trees */}
        {[-6, -3, 4, 7].map((x, i) => (
          <group key={i} position={[x, 0, -6 + i * 3]}>
            <mesh position={[0, 1.5, 0]}> <cylinderGeometry args={[0, 1, 3, 8]} /> <meshStandardMaterial color={'#2e7d32'} /></mesh>
            <mesh position={[0, 0.35, 0]}> <cylinderGeometry args={[0.12, 0.12, 0.6, 8]} /> <meshStandardMaterial color={'#6b4a2a'} /></mesh>
          </group>
        ))}
      </>
    );
  };

  // Demo culture: plaza with benches and a simple sculpture
  const DemoCultureScene = () => {
    return (
      <>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 7]} intensity={0.8} />
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0,0,0]}> <planeGeometry args={[200,200]} /> <meshStandardMaterial color={'#dcdcdc'} /></mesh>

        {/* plaza tiles */}
        {Array.from({ length: 6 }).map((_, i) => (
          Array.from({ length: 6 }).map((__, j) => (
            <mesh key={`${i}-${j}`} position={[i - 3, 0.01, j - 3]}> <boxGeometry args={[0.9, 0.02, 0.9]} /> <meshStandardMaterial color={(i + j) % 2 ? '#e8e8e8' : '#cfcfcf'} /></mesh>
          ))
        ))}

        {/* benches */}
        {[-2, 2].map((x, idx) => (
          <group key={idx} position={[x, 0.2, -1.5]}>
            <mesh position={[0, 0.15, 0]}> <boxGeometry args={[1.2, 0.1, 0.3]} /> <meshStandardMaterial color={'#6b4a2a'} /></mesh>
            <mesh position={[0, 0.45, -0.25]}> <boxGeometry args={[1.2, 0.02, 0.4]} /> <meshStandardMaterial color={'#bfbfbf'} /></mesh>
          </group>
        ))}

        {/* sculpture */}
        <mesh position={[0, 0.8, 0]}> <torusKnotGeometry args={[0.4, 0.12, 64, 8]} /> <meshStandardMaterial color={'#8b5e45'} /></mesh>
      </>
    );
  };

const SceneInner = forwardRef(({ layout, selectedRoomName, onSelectRoom, onTransformEnd, mode = "translate", snap = 0, renderMode = "furnished" }, ref) => {
  // --- glTF model support (additive, does not replace procedural) ---
  // These URLs should point to your public folder or CDN. Place .gltf/.glb files in public/models/.
  let sofaGltf, tvGltf, toiletGltf, bedGltf;
  try {
    sofaGltf = useLoader(GLTFLoader, "/models/sofa.glb");
  } catch {}
  try {
    tvGltf = useLoader(GLTFLoader, "/models/tv.glb");
  } catch {}
  try {
    toiletGltf = useLoader(GLTFLoader, "/models/toilet.glb");
  } catch {}
  try {
    bedGltf = useLoader(GLTFLoader, "/models/bed.glb");
  } catch {}
  const { gl, scene, camera } = useThree();
  const transformRef = useRef();
  const groupRefs = useRef({}); // name -> group object3D

  // expose capture() up to outer ref
  useImperativeHandle(ref, () => ({
    capture: () => {
      try {
        // ensure a final render
        gl.render(scene, camera);
      } catch (e) {}
      return gl.domElement.toDataURL("image/png");
    },
  }), [gl, scene, camera]);

  // When selection changes or transformRef created, attach events to control
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    // objectChange fires continuously while transforming
    const onObjectChange = () => {
      // live updates not pushed here; we wait until interaction ends
    };

    // mouseUp indicates the user finished the transform
    const onMouseUp = () => {
      if (!selectedRoomName) return;
      const grp = groupRefs.current[selectedRoomName];
      if (!grp) return;
      // grp.position is center position; convert to top-left x,y in layout coordinate system:
      const roomDef = (layout.rooms || []).find((r) => r.name === selectedRoomName);
      const size = Number(roomDef?.size) || 3;
      // center -> top-left:
      const newX = Number((grp.position.x - size / 2).toFixed(3));
      const newY = Number((grp.position.z - size / 2).toFixed(3));
      const rotationY = Number((grp.rotation.y || 0).toFixed(5));
      const scale = Number((grp.scale.x || 1).toFixed(5));
      // optional snapping
      const snapTo = (v) => (snap ? Math.round(v / snap) * snap : v);
      onTransformEnd && onTransformEnd(selectedRoomName, {
        x: snapTo(newX),
        y: snapTo(newY),
        rotationY,
        scale,
      });
    };

    controls.addEventListener("objectChange", onObjectChange);
    controls.addEventListener("mouseUp", onMouseUp);

    return () => {
      controls.removeEventListener("objectChange", onObjectChange);
      controls.removeEventListener("mouseUp", onMouseUp);
    };
  }, [transformRef, selectedRoomName, layout, onTransformEnd, snap]);

  // Keep the group positions in sync with layout when layout changes externally
  useEffect(() => {
    (layout.rooms || []).forEach((r) => {
      const g = groupRefs.current[r.name];
      if (g) {
        const size = Number(r.size) || 3;
        g.position.set(Number(r.x) + size / 2, 0, Number(r.y) + size / 2);
        if (typeof r.rotationY !== "undefined") g.rotation.set(0, r.rotationY, 0);
        if (typeof r.scale !== "undefined") g.scale.set(r.scale, r.scale, r.scale);
      }
    });
  }, [layout]);

  // --- simple procedural room interior prefabs (no external assets) ---
  const Sofa = ({ w = 1.6, d = 0.8, h = 0.6, color = '#6b3e26' }) => (
    <group>
      {/* base */}
      <mesh position={[0, h/2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* cushions */}
      <mesh position={[ -w*0.22, h*0.85, -d*0.15 ]}>
        <boxGeometry args={[w*0.4, h*0.3, d*0.6]} />
        <meshStandardMaterial color={'#a87a5a'} roughness={0.7} />
      </mesh>
      <mesh position={[ w*0.22, h*0.85, -d*0.15 ]}>
        <boxGeometry args={[w*0.4, h*0.3, d*0.6]} />
        <meshStandardMaterial color={'#a87a5a'} roughness={0.7} />
      </mesh>
    </group>
  );

  const TV = ({ w = 1.0, h = 0.6 }) => (
    <group>
      <mesh position={[0, h/2 + 0.2, -0.01]}> {/* slight offset from wall */}
        <boxGeometry args={[w, h, 0.06]} />
        <meshStandardMaterial color="#111" metalness={0.2} roughness={0.3} />
      </mesh>
      <mesh position={[0, h/2 + 0.05, -0.16]}> {/* screen */}
        <planeGeometry args={[w*0.92, h*0.6]} />
        <meshStandardMaterial color="#000" emissive="#060606" />
      </mesh>
    </group>
  );

  const Toilet = () => (
    <group>
      <mesh position={[0, 0.25, 0]}> <cylinderGeometry args={[0.22, 0.26, 0.45, 16]} /> <meshStandardMaterial color="#ffffff" /> </mesh>
      <mesh position={[0, 0.52, -0.08]}> <boxGeometry args={[0.34, 0.12, 0.18]} /> <meshStandardMaterial color="#ffffff" /> </mesh>
    </group>
  );

  const Bed = ({ w = 1.6, d = 2.0 }) => (
    <group>
      <mesh position={[0, 0.25, 0]}> <boxGeometry args={[w, 0.5, d]} /> <meshStandardMaterial color={'#cfa78a'} /></mesh>
      <mesh position={[0, 0.6, -d*0.15]}> <boxGeometry args={[w*0.8, 0.18, d*0.25]} /> <meshStandardMaterial color={'#e7d7c9'} /></mesh>
    </group>
  );

  function RoomInterior({ room, isSelected }){
    const size = Number(room.size) || 3;
    const half = size/2;
    const name = (room.name || '').toLowerCase();

    // basic floor
    return (
      <group>
        {/* floor */}
        <mesh rotation={[-Math.PI/2,0,0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[size, size]} />
          <meshStandardMaterial color={isSelected ? '#f7efe6' : '#efe6dd'} metalness={0.05} roughness={0.9} />
        </mesh>

        {/* four low walls */}
        {/* back wall */}
        <mesh position={[0, 0.85, -half+0.05]}> <boxGeometry args={[size, 1.7, 0.1]} /> <meshStandardMaterial color={'#f7f1ec'} /></mesh>
        {/* front low wall */}
        <mesh position={[0, 0.85, half-0.05]}> <boxGeometry args={[size, 1.7, 0.1]} /> <meshStandardMaterial color={'#f7f1ec'} /></mesh>
        {/* left wall */}
        <mesh position={[-half+0.05, 0.85, 0]}> <boxGeometry args={[0.1, 1.7, size]} /> <meshStandardMaterial color={'#f7f1ec'} /></mesh>
        {/* right wall */}
        <mesh position={[half-0.05, 0.85, 0]}> <boxGeometry args={[0.1, 1.7, size]} /> <meshStandardMaterial color={'#f7f1ec'} /></mesh>

        {/* furniture based on room name heuristics, using glTF if available and renderMode is 'furnished' */}
        {renderMode === 'furnished' ? (
          (/bath|toilet|wc/).test(name) ? (
            <group position={[0, 0, 0.2]}>
              {toiletGltf ? <primitive object={toiletGltf.scene.clone()} scale={[0.7,0.7,0.7]} /> : <Toilet />}
              <mesh position={[ -half + 0.6, 0.35, 0.2 ]}> <boxGeometry args={[0.6, 0.18, 0.4]} /> <meshStandardMaterial color={'#ffffff'} /></mesh>
            </group>
          ) : (/living|lounge|living room|family/).test(name) ? (
            <group>
              <group position={[0, 0, -half*0.25]}>{sofaGltf ? <primitive object={sofaGltf.scene.clone()} scale={[0.7,0.7,0.7]} /> : <Sofa w={size*0.9} d={0.8} />}</group>
              <group position={[0, 0, half*0.25]}> <mesh position={[0, 0.3, 0]}> <boxGeometry args={[size*0.5, 0.2, size*0.3]} /> <meshStandardMaterial color={'#8b5e45'} /></mesh></group>
              <group position={[half*0.6, 0.6, 0]}>{tvGltf ? <primitive object={tvGltf.scene.clone()} scale={[0.7,0.7,0.7]} /> : <TV w={Math.min(1.4, size*0.6)} h={Math.min(0.8, size*0.35)} />}</group>
            </group>
          ) : (/bed|sleep|master|room/).test(name) ? (
            <group>
              <group position={[0, 0, 0]}>{bedGltf ? <primitive object={bedGltf.scene.clone()} scale={[0.7,0.7,0.7]} /> : <Bed w={Math.min(1.8, size*0.9)} d={Math.min(2.2, size*1.1)} />}</group>
            </group>
          ) : (
            /* generic furnished room */
            <group>
              <group position={[ -half*0.3, 0, -half*0.2 ]}>{sofaGltf ? <primitive object={sofaGltf.scene.clone()} scale={[0.5,0.5,0.5]} /> : <Sofa w={size*0.6} d={0.7} />}</group>
              <group position={[ half*0.5, 0.6, 0 ]}>{tvGltf ? <primitive object={tvGltf.scene.clone()} scale={[0.5,0.5,0.5]} /> : <TV w={Math.min(1.2, size*0.5)} h={0.6} />}</group>
            </group>
          )
        ) : null}
      </group>
    );
  }

  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight skyColor={"#bde0ff"} groundColor={"#444"} intensity={0.6} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <Grid args={[100, 100]} cellColor="#2b2b2b" sectionColor="#2b2b2b" position={[0, 0.001, 0]} />

      {/* Ground plane to receive pointer events if needed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#111" transparent opacity={0} />
      </mesh>

      {(layout.rooms || []).map((room) => {
        const size = Number(room.size) || 3;
        const centerX = Number(room.x) + size / 2;
        const centerZ = Number(room.y) + size / 2;
        const isSelected = selectedRoomName === room.name;

        // If selected, wrap the group in TransformControls so user can transform it
        // --- Schematic mode: original blue box ---
        const SchematicGroup = (
          <group
            key={room.name + "-schematic"}
            ref={(el) => (groupRefs.current[room.name] = el)}
            position={[centerX, 0, centerZ]}
          >
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelectRoom && onSelectRoom(room.name);
              }}
            >
              <boxGeometry args={[size, 1, size]} />
              <meshStandardMaterial color={isSelected ? "#ff8c42" : "#2aa3ff"} roughness={0.5} metalness={0.1} />
            </mesh>
            <Html position={[0, 1.05, 0]} center>
              <div style={{ color: "white", background: "rgba(0,0,0,0.6)", padding: "3px 6px", borderRadius: 6, fontSize: 12 }}>
                {room.name}
              </div>
            </Html>
          </group>
        );

        // --- Furnished mode: new interior ---
        const FurnishedGroup = (
          <group
              key={room.name + "-furnished"}
              ref={(el) => (groupRefs.current[room.name] = el)}
              position={[centerX, 0, centerZ]}
            >
              <group onPointerDown={(e) => { e.stopPropagation(); onSelectRoom && onSelectRoom(room.name); }}>
                <RoomInterior room={room} isSelected={isSelected} />
              </group>
              <Html position={[0, 1.9, 0]} center>
                <div style={{ color: "#3b2a20", background: "rgba(255,250,246,0.9)", padding: "6px 10px", borderRadius: 8, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                  {room.name}
                </div>
              </Html>
            </group>
        );

        const GroupContents = renderMode === 'schematic' ? SchematicGroup : FurnishedGroup;

        return isSelected ? (
          <TransformControls
            key={room.name + "-tc"}
            ref={transformRef}
            mode={mode}
            showX
            showY
            showZ
            // disable pointer events propagation so OrbitControls doesn't fight
            onMouseDown={(e) => { e.stopPropagation(); }}
          >
            {GroupContents}
          </TransformControls>
        ) : (
          GroupContents
        );
      })}

      <OrbitControls />
    </>
  );
});

import { useState } from "react";

const ThreeDViewer = forwardRef(({ layout = { rooms: [] }, modelPath = null, selectedRoomName, onSelectRoom, onTransformEnd, mode = "translate", snap = 0 }, ref) => {
  const innerRef = useRef();
  const [renderMode, setRenderMode] = useState('furnished');

  // forward capture
  useImperativeHandle(ref, () => ({
    capture: () => {
      if (!innerRef.current) return null;
      return innerRef.current.capture();
    },
  }));
  // If a GLTF model path was provided, render that model in a focused viewer
  const isGLTF = typeof modelPath === 'string' && (modelPath.toLowerCase().endsWith('.glb') || modelPath.toLowerCase().endsWith('.gltf'));

  // small component to load and render a single glTF model
  const GLTFModel = ({ url }) => {
    const gltf = useLoader(GLTFLoader, url);
    const refGroup = useRef();

    useEffect(() => {
      if (!gltf || !gltf.scene) return;
      // center & scale
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      gltf.scene.position.sub(center);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 4 / maxDim;
      gltf.scene.scale.multiplyScalar(scale);
    }, [gltf]);

    return <primitive object={gltf.scene} ref={refGroup} />;
  };

  // demo layout used when modelPath starts with 'demo' or no modelPath provided
  const demoLayout = {
    rooms: [
      { name: 'Living Room', size: 4, x: 0, y: 0 },
      { name: 'Bedroom', size: 3, x: 5, y: 0 },
      { name: 'Kitchen', size: 3, x: 0, y: 5 }
    ]
  };

  if (isGLTF) {
    return (
      <div style={{ width: "100%", height: "70vh", borderRadius: 8, overflow: "hidden", background: "#000", position: 'relative' }}>
        <Canvas shadows camera={{ position: [0, 1.6, 4], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 7]} intensity={0.8} />
          <Suspense fallback={null}>
            <GLTFModel url={modelPath} />
          </Suspense>
          <OrbitControls enablePan enableZoom enableRotate />
        </Canvas>
      </div>
    );
  }

  // fallback: show the R3F scene inner (demo procedural rooms)
  return (
    <div style={{ width: "100%", height: "520px", borderRadius: 8, overflow: "hidden", background: "#111", position: 'relative' }}>
      {/* Toggle button for schematic/furnished */}
      <div style={{ position: 'absolute', top: 12, right: 18, zIndex: 10 }}>
        <button
          className={renderMode === 'furnished' ? 'btn-coffee' : 'btn-soft'}
          style={{ marginRight: 6 }}
          onClick={() => setRenderMode('furnished')}
        >
          Furnished
        </button>
        <button
          className={renderMode === 'schematic' ? 'btn-coffee' : 'btn-soft'}
          onClick={() => setRenderMode('schematic')}
        >
          Schematic
        </button>
      </div>
      <Canvas shadows camera={{ position: [10, 12, 10], fov: 50 }}>
        {typeof modelPath === 'string' && modelPath.startsWith('demo-exterior') ? (
          <DemoExteriorScene />
        ) : typeof modelPath === 'string' && modelPath.startsWith('demo-culture') ? (
          <DemoCultureScene />
        ) : (
          <SceneInner ref={innerRef} layout={(typeof modelPath === 'string' && modelPath.startsWith('demo')) ? demoLayout : layout} selectedRoomName={selectedRoomName} onSelectRoom={onSelectRoom} onTransformEnd={onTransformEnd} mode={mode} snap={snap} renderMode={renderMode} />
        )}
      </Canvas>
    </div>
  );
});

export default ThreeDViewer;
