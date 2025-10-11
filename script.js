const lenis = new Lenis({
  infinite: true, // Enable true infinite scroll like Lusion
  syncTouch: true,
});

lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.5;
document.querySelector(".model").appendChild(renderer.domElement);

// OrbitControls - DISABLED to lock camera (no user interaction)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enabled = false; // Disable all controls
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0); // Look at model center
controls.enableZoom = false;
controls.enablePan = false;
controls.enableRotate = false;

const ambientLight = new THREE.AmbientLight(0xffffff, 0);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
mainLight.position.set(0.5, 7.5, 2.5);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 2.5);
fillLight.position.set(-15, 0, -5);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.5);
hemiLight.position.set(0, 0, 0);
scene.add(hemiLight);

function basicAnimate() {
  renderer.render(scene, camera);
  requestAnimationFrame(basicAnimate);
}
basicAnimate();

let model;
const loader = new THREE.GLTFLoader();
console.log("Starting to load model from: ./assets/Untitled.glb");

loader.load(
  "./assets/Untitled.glb",
  // Success callback
  function (gltf) {
    console.log("✓ Model loaded successfully!", gltf);
    model = gltf.scene;

    console.log("Model initial state:", {
      position: model.position,
      scale: model.scale,
      rotation: model.rotation,
    });

    model.traverse((node) => {
      if (node.isMesh) {
        console.log("Found mesh:", node.name, node);
        if (node.material) {
          node.material.metalness = 0.5;
          node.material.roughness = 0.25;
          node.material.envMapIntensity = 5;
        }
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    console.log("Model bounding box:", {
      center: center,
      size: size,
      min: box.min,
      max: box.max,
      maxDim: maxDim,
    });

    model.position.sub(center);
    scene.add(model);

    // Position camera based on model size
    camera.position.set(0, maxDim * 0.3, maxDim * 1.75);
    camera.lookAt(0, 0, 0); // Point camera at model center (which is now at origin)
    console.log("Camera positioned at:", {
      position: camera.position,
      lookingAt: new THREE.Vector3(0, 0, 0),
    });

    //Add helpers to visualize model (remove these after debugging)
    //const axesHelper = new THREE.AxesHelper(500);
    //scene.add(axesHelper);
    //const gridHelper = new THREE.GridHelper(2000, 20);
    //scene.add(gridHelper);

    console.log("Model added to scene at position:", model.position);

    renderer.outputEncoding = THREE.sRGBEncoding;

    // Create PMREM generator to prepare environment map for PBR
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Load an HDR (equirectangular) environment map (place HDR in assets/)
    new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load(
      "./assets/env.hdr", // replace with your HDR file path
      (hdrEquirect) => {
        const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture;
        scene.environment = envMap; // use for PBR reflections
        hdrEquirect.dispose();
        pmremGenerator.dispose();

        // Update materials to be shiny / reflective
        model.traverse((node) => {
          if (node.isMesh && node.material) {
            // If material is an array, iterate
            const mats = Array.isArray(node.material)
              ? node.material
              : [node.material];
            mats.forEach((mat) => {
              // Brushed Metal material
              mat.metalness = 1.0; // Fully metallic
              mat.roughness = 0.4; // Medium roughness for brushed effect
              mat.envMap = envMap;
              mat.envMapIntensity = 1.2; // Moderate reflections
              mat.clearcoat = 0.0; // No clear coat for brushed look
              mat.clearcoatRoughness = 0.0;
              mat.needsUpdate = true;
            });
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
      },
      undefined,
      (err) => {
        console.warn("HDR loading failed:", err);
        // fallback: you can use a cubeTexture or leave existing lights
      }
    );

    // Don't set scale/rotation here - let the position management system handle it
    console.log("Final model state:", {
      position: model.position,
      scale: model.scale,
      rotation: model.rotation,
      visible: model.visible,
    });

    animate();
  },
  // Progress callback
  function (xhr) {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  // Error callback
  function (error) {
    console.error("❌ Error loading model:", error);
    console.error("Check that ./assets/Untitled.glb exists and is accessible");
  }
);

let isFloating = true;
let currentScroll = 0;

const totalScrollHeight =
  document.documentElement.scrollHeight - window.innerHeight;

// ========================================
// 3D MODEL POSITION MANAGEMENT TEMPLATE
// ========================================

const modelPositionConfig = {
  // Position and scale only - rotation is handled by continuous scroll
  keyframes: [
    {
      scrollPercent: 0, // At top of page
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: -30, z: 0 }, // Y rotation controlled by totalRotation
      scale: { x: 1, y: 1, z: 1 },
    },
    {
      scrollPercent: 1, // At bottom of page
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: -30, z: 0 }, // Y rotation controlled by totalRotation
      scale: { x: 1, y: 1, z: 1 },
    },
  ],

  // Animation settings - IMPORTANT: Lower smoothing = more responsive
  smoothing: 0.1, // 0.1 is good, 1 means NO movement!
  enableFloating: false,
  floatingAmplitude: 0,
  floatingSpeed: 0,
};

// Utility function to interpolate between two values
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

// Utility function to interpolate between two 3D vectors
function lerpVector3(start, end, factor) {
  return {
    x: lerp(start.x, end.x, factor),
    y: lerp(start.y, end.y, factor),
    z: lerp(start.z, end.z, factor),
  };
}

// Function to get interpolated position/rotation/scale based on scroll
function getModelTransform(scrollProgress) {
  const keyframes = modelPositionConfig.keyframes;

  // Clamp scroll progress between 0 and 1
  scrollProgress = Math.max(0, Math.min(1, scrollProgress));

  // Find the two keyframes we're between
  let prevKeyframe = keyframes[0];
  let nextKeyframe = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (
      scrollProgress >= keyframes[i].scrollPercent &&
      scrollProgress <= keyframes[i + 1].scrollPercent
    ) {
      prevKeyframe = keyframes[i];
      nextKeyframe = keyframes[i + 1];
      break;
    }
  }

  // Calculate interpolation factor between the two keyframes
  const range = nextKeyframe.scrollPercent - prevKeyframe.scrollPercent;
  const factor =
    range === 0 ? 0 : (scrollProgress - prevKeyframe.scrollPercent) / range;

  // Interpolate position, rotation, and scale
  return {
    position: lerpVector3(prevKeyframe.position, nextKeyframe.position, factor),
    rotation: lerpVector3(prevKeyframe.rotation, nextKeyframe.rotation, factor),
    scale: lerpVector3(prevKeyframe.scale, nextKeyframe.scale, factor),
  };
}

// Quick configuration presets - uncomment to use different styles
const presets = {
  // Gentle floating with subtle movement
  gentle: {
    keyframes: [
      {
        scrollPercent: 0,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0.3, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      {
        scrollPercent: 0.5,
        position: { x: 0.5, y: 0.5, z: 0 },
        rotation: { x: 1, y: 1, z: 0 },
        scale: { x: 1.1, y: 1.1, z: 1.1 },
      },
      {
        scrollPercent: 1,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 2, y: 2, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    ],
  },

  // Dynamic movement with dramatic changes
  dynamic: {
    keyframes: [
      {
        scrollPercent: 0,
        position: { x: -2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.8, y: 0.8, z: 0.8 },
      },
      {
        scrollPercent: 0.3,
        position: { x: 2, y: 1, z: 1 },
        rotation: { x: 1, y: 2, z: 0.5 },
        scale: { x: 1.3, y: 1.3, z: 1.3 },
      },
      {
        scrollPercent: 0.7,
        position: { x: -1, y: -1, z: -1 },
        rotation: { x: 3, y: 1, z: -0.5 },
        scale: { x: 0.9, y: 0.9, z: 0.9 },
      },
      {
        scrollPercent: 1,
        position: { x: 0, y: 2, z: 0 },
        rotation: { x: 4, y: 3, z: 0 },
        scale: { x: 1.2, y: 1.2, z: 1.2 },
      },
    ],
  },

  // Minimalist - just rotation
  minimal: {
    keyframes: [
      {
        scrollPercent: 0,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      {
        scrollPercent: 1,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 6.28, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    ],
  },
};

// To use a preset, uncomment one of these lines:
// modelPositionConfig.keyframes = presets.gentle.keyframes;
// modelPositionConfig.keyframes = presets.dynamic.keyframes;
// modelPositionConfig.keyframes = presets.minimal.keyframes;

function playInitialAnimation() {
  if (model) {
    gsap.to(model.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1,
      ease: "power2.out",
    });
  }
}

lenis.on("scroll", (e) => {
  currentScroll = e.scroll;
});

// Continuous rotation that loops perfectly from -30° to -30°
const startRotation = -30 * (Math.PI / 180); // -30 degrees in radians
const rotationsPerCycle = 2; // Number of full rotations per scroll cycle

function animate() {
  if (model) {
    // Get scroll progress (0 to 1) for the current cycle
    const scrollProgress = (currentScroll % totalScrollHeight) / totalScrollHeight;
    
    // Calculate rotation: start at -30°, do 2 full rotations, end back at -30°
    const rotationAmount = scrollProgress * (Math.PI * 2 * rotationsPerCycle);
    const currentRotation = startRotation + rotationAmount;
    
    // Keep position and scale from config
    const transform = getModelTransform(scrollProgress);

    // Apply floating animation if enabled
    let finalY = transform.position.y;
    if (modelPositionConfig.enableFloating && isFloating) {
      const floatOffset =
        Math.sin(Date.now() * 0.001 * modelPositionConfig.floatingSpeed) *
        modelPositionConfig.floatingAmplitude;
      finalY += floatOffset;
    }

    // Apply the calculated transforms with smoothing
    const smoothing = modelPositionConfig.smoothing;

    // Smooth position interpolation
    model.position.x = lerp(model.position.x, transform.position.x, smoothing);
    model.position.y = lerp(model.position.y, finalY, smoothing);
    model.position.z = lerp(model.position.z, transform.position.z, smoothing);

    // Rotation - Y loops perfectly from -30° to -30°, X and Z from config
    model.rotation.x = lerp(model.rotation.x, transform.rotation.x, smoothing);
    model.rotation.y = currentRotation; // Seamless loop: -30° at 0% and 100%
    model.rotation.z = lerp(model.rotation.z, transform.rotation.z, smoothing);

    // Smooth scale interpolation
    model.scale.x = lerp(model.scale.x, transform.scale.x, smoothing);
    model.scale.y = lerp(model.scale.y, transform.scale.y, smoothing);
    model.scale.z = lerp(model.scale.z, transform.scale.z, smoothing);
  }

  // Update controls for smooth damping
  controls.update();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

const introSection = document.querySelector(".intro");
const archiveSection = document.querySelector(".archive");
const outroSection = document.querySelector(".outro");

const splitText = new SplitType(".outro-copy h2", {
  types: "lines",
  lineClass: "line",
});

splitText.lines.forEach((line) => {
  const text = line.innerHTML;
  line.innerHTML = `<span style="display: block; transform: translateY(70px);">${text}</span>`;
});

ScrollTrigger.create({
  trigger: ".outro",
  start: "top center",
  onEnter: () => {
    gsap.to(".outro-copy h2 .line span", {
      translateY: 0,
      duration: 1,
      stagger: 0.1,
      ease: "power3.out",
      force3D: true,
    });
  },
  onLeaveBack: () => {
    gsap.to(".outro-copy h2 .line span", {
      translateY: 70,
      duration: 1,
      stagger: 0.1,
      ease: "power3.out",
      force3D: true,
    });
  },
  toggleActions: "play reverse play reverse",
});

// ========================================
// USAGE EXAMPLES - HOW TO CUSTOMIZE MODEL POSITION
// ========================================

/*
QUICK CUSTOMIZATION GUIDE:

1. MODIFY EXISTING KEYFRAMES:
   Edit the modelPositionConfig.keyframes array above to adjust positions.
   
   Example - Make model move more dramatically:
   modelPositionConfig.keyframes[1].position.x = 5; // Move further right at 25% scroll

2. ADD NEW KEYFRAMES:
   Insert new objects in the keyframes array for more control points.
   
   Example - Add keyframe at 10% scroll:
   modelPositionConfig.keyframes.splice(1, 0, {
     scrollPercent: 0.1,
     position: { x: 0.5, y: 0.2, z: 0 },
     rotation: { x: 0.7, y: 0.3, z: 0 },
     scale: { x: 1.05, y: 1.05, z: 1.05 }
   });

3. USE PRESETS:
   Uncomment one of the preset lines in the configuration section above.
   
   For gentle movement: modelPositionConfig.keyframes = presets.gentle.keyframes;
   For dynamic movement: modelPositionConfig.keyframes = presets.dynamic.keyframes;
   For minimal rotation: modelPositionConfig.keyframes = presets.minimal.keyframes;

4. ADJUST ANIMATION SETTINGS:
   modelPositionConfig.smoothing = 0.05;        // Smoother transitions (0.01-0.5)
   modelPositionConfig.enableFloating = false;  // Disable floating
   modelPositionConfig.floatingAmplitude = 0.5; // Bigger floating movement
   
5. CREATE CUSTOM PRESET:
   const myCustomPreset = {
     keyframes: [
       { scrollPercent: 0, position: {x: 0, y: 0, z: 0}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1} },
       { scrollPercent: 1, position: {x: 3, y: 1, z: 0}, rotation: {x: 0, y: 3.14, z: 0}, scale: {x: 0.8, y: 0.8, z: 0.8} }
     ]
   };
   modelPositionConfig.keyframes = myCustomPreset.keyframes;

COORDINATE SYSTEM:
- X: Left (-) to Right (+)
- Y: Down (-) to Up (+)  
- Z: Away (-) to Toward camera (+)
- Rotation in radians (3.14 ≈ 180 degrees)

TIPS:
- Start with small values (0.1 - 2.0) and adjust gradually
- Use the browser console to test: modelPositionConfig.keyframes[0].position.x = 1
- Refresh the page to see changes take effect
*/
