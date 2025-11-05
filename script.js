// CUSTOM CURSOR (replaced with a vanilla implementation mirroring the
// provided React `GlobalParallax` component). The cursor is created
// dynamically on client for fine-pointer devices and wide screens.
const lenis = new Lenis({
  infinite: false, // disable infinite scrolling — use normal page bounds
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
renderer.toneMappingExposure = 1.6; // Giảm phơi sáng để giảm độ sáng tổng thể
document.querySelector(".model").appendChild(renderer.domElement);

// ========================================
// CÀI ĐẶT HẬU XỬ LÝ THEO PHONG CÁCH ĐIỆN ẢNH
// ========================================

// Tạo EffectComposer cho hậu xử lý
const composer = new THREE.EffectComposer(renderer);

// Thêm render pass (vẽ cảnh thực tế)
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

// Thêm Unreal Bloom Pass để tạo ánh sáng rực rỡ theo phong cách điện ảnh
const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8, // strength - Reduced glow (was 2.0)
  0.4, // radius - Tighter spread (was 0.8)
  0.7 // threshold - Less blooming (was 0.3)
);
composer.addPass(bloomPass);

// ========================================
// HIỆU ỨNG SAI SỐ MÀU (CHROMATIC ABERRATION) HIỆN ĐẠI
// ========================================
const chromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.0015 }, // Subtle chromatic aberration
    angle: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform float angle;
    varying vec2 vUv;
    
    void main() {
      vec2 offset = amount * vec2(cos(angle), sin(angle));
      vec4 cr = texture2D(tDiffuse, vUv + offset);
      vec4 cga = texture2D(tDiffuse, vUv);
      vec4 cb = texture2D(tDiffuse, vUv - offset);
      gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
    }
  `,
};

const chromaticPass = new THREE.ShaderPass(chromaticAberrationShader);
composer.addPass(chromaticPass);

// ========================================
// SHADER CHỈNH MÀU (COLOR GRADING) HIỆN ĐẠI
// ========================================
const colorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 0.0 },
    contrast: { value: 1.05 },
    saturation: { value: 0.95 },
    colorTint: { value: new THREE.Color(0x0088ff) },
    tintStrength: { value: 0.02 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform vec3 colorTint;
    uniform float tintStrength;
    varying vec2 vUv;
    
    vec3 adjustSaturation(vec3 color, float sat) {
      const vec3 luminance = vec3(0.299, 0.587, 0.114);
      float gray = dot(color, luminance);
      return mix(vec3(gray), color, sat);
    }
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Độ sáng
      color.rgb += brightness;
      
      // Độ tương phản
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;
      
      // Độ bão hòa
      color.rgb = adjustSaturation(color.rgb, saturation);
      
      // Tông màu (nhuốm màu cyan/xanh hiện đại)
      color.rgb = mix(color.rgb, color.rgb * colorTint, tintStrength);
      
      gl_FragColor = color;
    }
  `,
};

const colorGradingPass = new THREE.ShaderPass(colorGradingShader);
composer.addPass(colorGradingPass);

// ========================================
// HIỆU ỨNG VIGNETTE HIỆN ĐẠI
// ========================================
const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.9 },
    darkness: { value: 1.3 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float dist = length(uv);
      float vignette = smoothstep(offset, offset - 0.3, dist);
      color.rgb = mix(color.rgb * darkness, color.rgb, vignette);
      gl_FragColor = color;
    }
  `,
};

const vignettePass = new THREE.ShaderPass(vignetteShader);
composer.addPass(vignettePass);

// ========================================
// HIỆU ỨNG LÀM SẮC (sharp) HIỆN ĐẠI (tăng độ rõ nét)
// ========================================
const sharpenShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
    amount: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float amount;
    varying vec2 vUv;
    
    void main() {
      vec2 step = 1.0 / resolution;
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Sharpen kernel
      vec4 sum = vec4(0.0);
      sum += texture2D(tDiffuse, vUv + vec2(-step.x, 0.0)) * -1.0;
      sum += texture2D(tDiffuse, vUv + vec2(step.x, 0.0)) * -1.0;
      sum += texture2D(tDiffuse, vUv + vec2(0.0, -step.y)) * -1.0;
      sum += texture2D(tDiffuse, vUv + vec2(0.0, step.y)) * -1.0;
      sum += color * 5.0;
      
      gl_FragColor = mix(color, sum, amount);
    }
  `,
};

const sharpenPass = new THREE.ShaderPass(sharpenShader);
composer.addPass(sharpenPass);

// ========================================
// LỚP PHỦ NHIỄU ĐỘNG (ANIMATED NOISE) HIỆN ĐẠI
// ========================================
const noiseShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    amount: { value: 0.08 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float amount;
    varying vec2 vUv;
    
    // Hàm nhiễu hiện đại
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float noise = random(vUv + time) * 2.0 - 1.0;
      color.rgb += noise * amount;
      gl_FragColor = color;
    }
  `,
};

const noisePass = new THREE.ShaderPass(noiseShader);
composer.addPass(noisePass);

// Thêm Film Pass để tạo nhiễu (grain) và cảm giác điện ảnh
const filmPass = new THREE.FilmPass(
  0.2, // noise intensity - Reduced (was 0.35)
  0.02, // scanline intensity - Reduced (was 0.04)
  648, // scanline count
  false // grayscale off
);
filmPass.renderToScreen = true;
composer.addPass(filmPass);

console.log("✓ Kích hoạt dãy hậu xử lý hiện đại:");
console.log("  - Bloom (ánh sáng nhẹ)");
console.log("  - Sai số màu (Chromatic Aberration)");
console.log("  - Chỉnh màu (Color Grading)");
console.log("  - Vignette (tập trung khung hình)");
console.log("  - Làm sắc (Sharpen)");
console.log("  - Nhiễu động (Animated Noise)");
console.log("  - Hạt phim (Film Grain)");

// Cấu hình hệ thống ánh sáng
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Increased for more brightness
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 3.5); // Increased brightness
mainLight.position.set(0.5, 7.5, 2.5);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 3.0); // Increased brightness
fillLight.position.set(-15, 0, -5);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2.0); // Increased brightness
hemiLight.position.set(0, 0, 0);
scene.add(hemiLight);

// Tương tác & hiệu ứng hiện đại

// Theo dõi chuột mượt với giới hạn
const mouse = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  maxOffset: 0.15, // Limit movement to 15% for subtlety
};

window.addEventListener("mousemove", (e) => {
  // Chuẩn hóa về -1 tới 1, sau đó giới hạn phạm vi
  const rawX = (e.clientX / window.innerWidth) * 2 - 1;
  const rawY = -(e.clientY / window.innerHeight) * 2 + 1;

  mouse.targetX = Math.max(
    -mouse.maxOffset,
    Math.min(mouse.maxOffset, rawX * mouse.maxOffset)
  );
  mouse.targetY = Math.max(
    -mouse.maxOffset,
    Math.min(mouse.maxOffset, rawY * mouse.maxOffset)
  );
});

// Nội suy mượt
function updateMouse() {
  mouse.x += (mouse.targetX - mouse.x) * 0.05;
  mouse.y += (mouse.targetY - mouse.y) * 0.05;
}

// Assembly UI removed

// Hạt môi trường hiện đại (nhẹ nhàng, không gây phân tâm)
const particleCount = 100; // Fewer, more refined
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleSizes = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
  // Phân bổ trong một hình cầu rộng, nông
  const radius = 1000 + Math.random() * 500;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.PI * 0.5 + (Math.random() - 0.5) * 0.5; // Keep mostly horizontal

  particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 800; // Phân bố theo trục dọc
  particlePositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

  particleSizes[i] = Math.random() * 2 + 1;
}

particleGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(particlePositions, 3)
);
particleGeometry.setAttribute(
  "size",
  new THREE.BufferAttribute(particleSizes, 1)
);

// Vật liệu shader cho hạt (Particle) hiện đại
const particleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    pixelRatio: { value: renderer.getPixelRatio() },
  },
  vertexShader: `
    uniform float pixelRatio;
    attribute float size;
    varying float vAlpha;
    
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      
      // Mờ dần theo khoảng cách
      float distance = length(mvPosition.xyz);
      vAlpha = smoothstep(2000.0, 500.0, distance);
      
      gl_PointSize = size * pixelRatio * (1000.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    
    void main() {
      // Hạt hình tròn mềm
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      
      float alpha = (1.0 - dist * 2.0) * vAlpha * 0.4;
      gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particleSystem);

// Hoạt ảnh nhẹ cho hạt
function animateParticles(time) {
  particleMaterial.uniforms.time.value = time * 0.001;

  const positions = particleSystem.geometry.attributes.position.array;

  for (let i = 0; i < particleCount; i++) {
    // Chuyển động nổi nhẹ nhàng
    const idx = i * 3;
    positions[idx + 1] += Math.sin(time * 0.0003 + i) * 0.1;

    // Đặt lại nếu quá xa
    if (Math.abs(positions[idx + 1]) > 1000) {
      positions[idx + 1] *= -0.5;
    }
  }

  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.rotation.y = time * 0.00005; // Slow rotation
}

console.log("✓ Hệ thống tương tác hiện đại đã khởi tạo");

// TẢI MẪU 3D
let model;
let modelMaxDim = 1400; // Default value, will be updated when model loads
const loader = new THREE.GLTFLoader();
console.log("Starting to load model from: ./assets/Untitled.glb");

// activeModel tracks which model receives interaction updates and is visible
let activeModel = null;
let _lastFrameTS = performance.now();

loader.load(
  "./assets/Untitled.glb",
  // Callback khi tải thành công
  function (gltf) {
    console.log("✓ Tải mô hình thành công!", gltf);
    model = gltf.scene;

    console.log("Trạng thái ban đầu của mô hình:", {
      position: model.position,
      scale: model.scale,
      rotation: model.rotation,
    });

    model.traverse((node) => {
      if (node.isMesh) {
        console.log("Tìm thấy mesh:", node.name, node);
        if (node.material) {
          node.material.metalness = 0.15; // Kim loại vừa phải
          node.material.roughness = 0.15; // Ít phản xạ hơn
          node.material.envMapIntensity = 1.2; // Giảm cường độ phản xạ
        }
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    modelMaxDim = maxDim; // Store globally for camera positioning

    // LOG: model size information (untitled) — searchable marker: [UNTITLED_LOADER_LOG]
    try {
      console.log(
        "[UNTITLED_LOADER_LOG] Untitled.glb bbox size:",
        size,
        "center:",
        center,
        "maxDim:",
        maxDim,
        "sceneRootScale:",
        model.scale
      );
    } catch (e) {
      console.warn("Failed to log Untitled size", e);
    }

    console.log("Hộp bao (bounding box) của mô hình:", {
      center: center,
      size: size,
      min: box.min,
      max: box.max,
      maxDim: maxDim,
    });

    model.position.sub(center); // recentre to origin
    scene.add(model);
    model.visible = true;
    activeModel = model; // primary model becomes active when loaded

    // Add a GridHelper and AxesHelper to help visualize model orientation/scale
    try {
      // grid size relative to model max dimension
      const gridSize = Math.max(Math.ceil(maxDim * 1.5), 10);
      const gridDivs = 10;
      const grid = new THREE.GridHelper(gridSize, gridDivs, 0x444444, 0x222222);
      grid.name = "untitled-grid";
      // Place grid near the bottom of the model so it sits under the mesh visually
      // model was recentred to its center, so approximate bottom at -size.y/2
      grid.position.set(0, -size.y * 0.5 - maxDim * 0.02, 0);
      // Axes helper sized according to model dimension
      const axes = new THREE.AxesHelper(Math.max(50, maxDim * 0.6));
      axes.name = "untitled-axes";
      // Attach to model so they follow any model transforms
      model.add(grid);
      model.add(axes);
      // expose toggle for convenience
      window.__untitledHelpers = { grid, axes };
      console.log("DEBUG: Added GridHelper and AxesHelper for Untitled", {
        gridSize,
        maxDim,
      });
    } catch (e) {
      console.warn("Failed to add grid/axes helper for Untitled", e);
    }

    // If Flow was loaded earlier and requested scaling, apply now (we prefer
    // scaling Flow down to Untitled so the scene doesn't require huge scales)
    try {
      if (pendingScaleUntitledToFlow) {
        pendingScaleUntitledToFlow = false;
        scaleUntitledToFlow();
      }
    } catch (e) {
      console.warn("deferred scaleUntitledToFlow failed", e);
    }

    // Best-effort attempt to scale Untitled now (no-op if Flow not present yet)
    try {
      scaleUntitledToFlow();
    } catch (e) {
      /* ignore */
    }

    // Đặt camera dựa trên kích thước mô hình
    camera.position.set(0, maxDim * 0.3, maxDim * 1.75);
    camera.lookAt(0, 0, 0); // Hướng camera về tâm mô hình (bây giờ là gốc tọa độ)
    console.log("Camera positioned at:", {
      position: camera.position,
      lookingAt: new THREE.Vector3(0, 0, 0),
    });

    // (visual helpers removed)

    console.log("Mô hình đã được thêm vào cảnh tại vị trí:", model.position);

    renderer.outputEncoding = THREE.sRGBEncoding;

    // Tạo PMREM generator để chuẩn bị bản đồ môi trường (env map) cho PBR
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Tải bản đồ môi trường HDR (equirectangular) (đặt HDR trong thư mục assets/)
    console.log("Attempting to load HDR from: ./assets/env.hdr");
    new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load(
      "./assets/env.hdr", // replace with your HDR file path
      (hdrEquirect) => {
        console.log("✓ HDR đã tải thành công!", hdrEquirect);
        const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture;
        scene.environment = envMap; // sử dụng cho phản xạ PBR
        console.log("✓ Bản đồ môi trường đã được tạo và áp dụng cho cảnh");
        hdrEquirect.dispose();
        pmremGenerator.dispose();

        // Cập nhật vật liệu để có độ bóng / phản xạ
        model.traverse((node) => {
          if (node.isMesh && node.material) {
            // If material is an array, iterate
            const mats = Array.isArray(node.material)
              ? node.material
              : [node.material];
            mats.forEach((mat) => {
              // Vật liệu kim loại sáng
              mat.metalness = 0.45; // Kim loại vừa phải
              mat.roughness = 0.4; // Phản xạ mềm hơn
              mat.envMap = envMap;
              mat.envMapIntensity = 0.9; // Phản xạ tinh tế hơn
              mat.clearcoat = 0.15; // Clearcoat tối thiểu
              mat.clearcoatRoughness = 0.2;
              mat.needsUpdate = true;
            });
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        console.log("✓ Vật liệu đã được cập nhật với bản đồ môi trường HDR");
      },
      (xhr) => {
        console.log(
          "Tiến trình tải HDR:",
          (xhr.loaded / xhr.total) * 100 + "%"
        );
      },
      (err) => {
        console.error("❌ Tải HDR thất bại:", err);
        console.error(
          "Đảm bảo bạn đang chạy từ server cục bộ (không phải file://)"
        );
        console.error("Thử: python3 -m http.server 4000");
        // phương án dự phòng: áp dụng vật liệu cơ bản nếu không có HDR
        model.traverse((node) => {
          if (node.isMesh && node.material) {
            const mats = Array.isArray(node.material)
              ? node.material
              : [node.material];
            mats.forEach((mat) => {
              mat.metalness = 0.45;
              mat.roughness = 0.5;
              mat.needsUpdate = true;
            });
          }
        });
      }
    ); // Close RGBELoader.load()

    // Không đặt scale/rotation ở đây - để hệ thống quản lý vị trí xử lý
    console.log("Trạng thái cuối cùng của mô hình:", {
      position: model.position,
      scale: model.scale,
      rotation: model.rotation,
      visible: model.visible,
    });

    // Ẩn màn hình tải khi mô hình đã tải xong
    const loadingScreen = document.querySelector(".loading-screen");
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.classList.add("fade-out");
      }, 500); // Tạm dừng nhỏ để chuyển tiếp mượt
    }

    // Assembly interaction (explode/reassemble) removed per user request.

    animate();
  }, // Close success callback
  // Callback tiến trình
  function (xhr) {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  // Callback lỗi
  function (error) {
    console.error("❌ Error loading model:", error);
    console.error("Check that ./assets/Untitled.glb exists and is accessible");
  }
); // Close loader.load()

// Second model removed — keep placeholder variables to avoid reference errors elsewhere
let secondModel = null;
let secondModelFrame = null;

// --- Flow background model (large spine) ---
let flowModel = null;
let flowLookTop = null;
let flowLookBottom = null;
let flowCenterGlobal = null;
let flowSidePos = null; // camera side position to look from
let flowPresent = false;
let pendingSwitchToFlow = false; // if user scrolled to flow section before it finished loading
let pendingScaleUntitledToFlow = false; // if Flow loads before Untitled, defer scaling
// pending flag used when Flow loads before Untitled; we'll scale Untitled to Flow
// once Untitled finishes loading.
// (removed unused pendingScaleFlowToUntitled variable)

// Load Flow.glb into the scene as a large background object. This only
// adds the model and computes top/bottom look targets; it does not change
// any other existing logic.
(function loadFlowModel() {
  try {
    const fl = new THREE.GLTFLoader();
    const path = "./assets/Flow.glb";
    fl.load(
      path,
      function (gltf) {
        flowModel = gltf.scene;

        // Basic material defaults
        flowModel.traverse((n) => {
          if (n.isMesh && n.material) {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((m) => {
              m.metalness = m.metalness ?? 0.1;
              m.roughness = m.roughness ?? 0.7;
              m.needsUpdate = true;
            });
            n.castShadow = false;
            n.receiveShadow = false;
          }
        });

        // Add to scene
        scene.add(flowModel);

        // Compute bbox and scale. If the primary model (Untitled) is already
        // loaded, scale Flow to match Untitled's max dimension so both appear
        // the same size. Otherwise fall back to the legacy large value.
        const box = new THREE.Box3().setFromObject(flowModel);
        const center = box.getCenter(new THREE.Vector3());
        let size = box.getSize(new THREE.Vector3());
        const currentMax = Math.max(size.x, size.y, size.z) || 1;
        // Keep Flow large by default (legacy). We'll scale Untitled up to match
        // Flow instead of downscaling Flow.
        const desiredMax = 1000; // legacy large background size
        const scaleFactor = desiredMax / currentMax;
        if (Math.abs(scaleFactor - 1) > 0.001) {
          flowModel.scale.multiplyScalar(scaleFactor);
          // recompute
          const box2 = new THREE.Box3().setFromObject(flowModel);
          const center2 = box2.getCenter(new THREE.Vector3());
          size = box2.getSize(new THREE.Vector3());
          // keep model centered
          flowModel.position.sub(center2);
        } else {
          // center model
          flowModel.position.sub(center);
        }

        // Compute look targets (points on the model to point at)
        const fbox = new THREE.Box3().setFromObject(flowModel);
        const fcenter = fbox.getCenter(new THREE.Vector3());
        const fsize = fbox.getSize(new THREE.Vector3());
        flowLookTop = new THREE.Vector3(
          fcenter.x,
          fcenter.y + fsize.y * 0.45,
          fcenter.z
        );
        flowLookBottom = new THREE.Vector3(
          fcenter.x,
          fcenter.y - fsize.y * 0.45,
          fcenter.z
        );
        // store center and side camera position so camera can move along Y while
        // looking from the side (no vertical tilt). Side pos is offset along X.
        flowCenterGlobal = fcenter.clone();
        const sideOffset = Math.max(fsize.x, fsize.z) * 1.6;
        flowSidePos = new THREE.Vector3(
          fcenter.x + sideOffset,
          fcenter.y,
          fcenter.z
        );

        flowPresent = true;
        console.log("✓ Flow model loaded and added as background:", path);
        // LOG: model size information (flow) — searchable marker: [FLOW_LOADER_LOG]
        try {
          const dbgBox = new THREE.Box3().setFromObject(flowModel);
          const dbgSize = dbgBox.getSize(new THREE.Vector3());
          const dbgCenter = dbgBox.getCenter(new THREE.Vector3());
          console.log(
            "[FLOW_LOADER_LOG] Flow.glb bbox size:",
            dbgSize,
            "center:",
            dbgCenter,
            "sceneRootScale:",
            flowModel.scale
          );
        } catch (e) {
          console.warn("Failed to log Flow size", e);
        }
        // If Untitled already exists, scale Flow down to match Untitled so
        // they appear the same size. Otherwise remember to scale Flow once
        // Untitled loads.
        try {
          if (model) {
            // scale Untitled up to match Flow
            scaleUntitledToFlow();
          } else {
            pendingScaleUntitledToFlow = true;
          }
        } catch (e) {
          console.warn("scaleUntitledToFlow invocation failed", e);
        }
        // Best-effort attempt to scale Untitled now in case model exists
        try {
          scaleUntitledToFlow();
        } catch (e) {
          /* ignore */
        }
        // If the user already scrolled to the flow section, activate it now
        if (pendingSwitchToFlow) {
          try {
            setActiveModel(flowModel);
          } catch (e) {}
          pendingSwitchToFlow = false;
        }
      },
      undefined,
      function (err) {
        console.warn("Flow model failed to load (optional):", err);
        flowPresent = false;
      }
    );
  } catch (e) {
    console.warn("Flow loader error", e);
    flowPresent = false;
  }
})();

// Scale helper: scale the Untitled model so its maximum dimension matches
// the (already scaled) Flow model. This makes both models appear the same
// apparent size without changing camera framing logic.
function scaleUntitledToFlow() {
  try {
    if (!model || !flowModel)
      return console.warn("scaleUntitledToFlow: missing model or flowModel");
    // Ensure world matrices are up to date so Box3 reflects current scale/transforms
    model.updateMatrixWorld(true);
    flowModel.updateMatrixWorld(true);
    const boxA = new THREE.Box3().setFromObject(model);
    const boxB = new THREE.Box3().setFromObject(flowModel);
    const sizeA = boxA.getSize(new THREE.Vector3());
    const sizeB = boxB.getSize(new THREE.Vector3());
    const maxA = Math.max(sizeA.x, sizeA.y, sizeA.z) || 1;
    const maxB = Math.max(sizeB.x, sizeB.y, sizeB.z) || 1;

    // We choose to scale the Untitled model to match Flow's size
    const scaleFactor = maxB / maxA;
    if (Math.abs(scaleFactor - 1) > 0.0005) {
      console.log("Scaling Untitled to match Flow: factor=", scaleFactor, {
        maxA,
        maxB,
      });
      // apply uniform scaling to the model root
      const currentScale = model.scale && model.scale.x ? model.scale.x : 1;
      const newScale = currentScale * scaleFactor;
      model.scale.set(newScale, newScale, newScale);
      // force matrix updates and re-center after scaling
      model.updateMatrixWorld(true);
      const boxAfter = new THREE.Box3().setFromObject(model);
      const centerAfter = boxAfter.getCenter(new THREE.Vector3());
      model.position.sub(centerAfter);
      // update world matrices again after moving
      model.updateMatrixWorld(true);
      // re-run a log so developer can confirm sizes
      const afterBox = new THREE.Box3().setFromObject(model);
      const afterSize = afterBox.getSize(new THREE.Vector3());
      console.log(
        "scaleUntitledToFlow: after scaling bbox size:",
        afterSize,
        "model.scale=",
        model.scale
      );
      // Reframe camera to show scaled model clearly
      try {
        if (window.frameCameraToModel) window.frameCameraToModel(0.9);
      } catch (e) {}
      // Lock the root scale to prevent the animation loop from resetting it
      try {
        model.userData = model.userData || {};
        model.userData.lockedScale = true;
      } catch (e) {}
    } else {
      console.log("scaleUntitledToFlow: no scaling needed", { maxA, maxB });
    }
  } catch (e) {
    console.warn("scaleUntitledToFlow failed", e);
  }
}

// Expose for manual testing
window.scaleUntitledToFlow = scaleUntitledToFlow;

// Scale helper: scale the Flow model down so its maximum dimension matches
// the Untitled model. This avoids making Untitled extremely large and keeps
// the scene scales reasonable. Call this after both models are loaded.
function scaleFlowToUntitled() {
  try {
    if (!model || !flowModel)
      return console.warn("scaleFlowToUntitled: missing model or flowModel");
    const boxA = new THREE.Box3().setFromObject(model);
    const boxB = new THREE.Box3().setFromObject(flowModel);
    const sizeA = boxA.getSize(new THREE.Vector3());
    const sizeB = boxB.getSize(new THREE.Vector3());
    const maxA = Math.max(sizeA.x, sizeA.y, sizeA.z) || 1;
    const maxB = Math.max(sizeB.x, sizeB.y, sizeB.z) || 1;

    // Scale Flow down so its max dimension equals Untitled's max dimension
    const scaleFactor = maxA / maxB;
    if (Math.abs(scaleFactor - 1) > 0.0001) {
      console.log("Scaling Flow to match Untitled: factor=", scaleFactor, {
        maxA,
        maxB,
      });
      flowModel.scale.multiplyScalar(scaleFactor);
      // re-center after scaling
      const boxAfter = new THREE.Box3().setFromObject(flowModel);
      const centerAfter = boxAfter.getCenter(new THREE.Vector3());
      flowModel.position.sub(centerAfter);
    } else {
      console.log("scaleFlowToUntitled: no scaling needed", { maxA, maxB });
    }
  } catch (e) {
    console.warn("scaleFlowToUntitled failed", e);
  }
}
window.scaleFlowToUntitled = scaleFlowToUntitled;

// Helper to print sizes for both models on demand. Useful if you want to
// inspect values after any runtime transforms. Searchable marker: [LOG_MODEL_SIZES_HELPER]
function logModelSizes() {
  try {
    if (model) {
      const b = new THREE.Box3().setFromObject(model);
      const s = b.getSize(new THREE.Vector3());
      const c = b.getCenter(new THREE.Vector3());
      console.log(
        "[LOG_MODEL_SIZES_HELPER] Untitled - bbox size:",
        s,
        "center:",
        c,
        "scale:",
        model.scale
      );
    } else {
      console.log("[LOG_MODEL_SIZES_HELPER] Untitled not loaded yet");
    }
    if (flowModel) {
      const b2 = new THREE.Box3().setFromObject(flowModel);
      const s2 = b2.getSize(new THREE.Vector3());
      const c2 = b2.getCenter(new THREE.Vector3());
      console.log(
        "[LOG_MODEL_SIZES_HELPER] Flow - bbox size:",
        s2,
        "center:",
        c2,
        "scale:",
        flowModel.scale
      );
    } else {
      console.log("[LOG_MODEL_SIZES_HELPER] Flow not loaded yet");
    }
  } catch (e) {
    console.warn("logModelSizes failed", e);
  }
}
window.logModelSizes = logModelSizes;

let isFloating = true;
let currentScroll = 0;

const totalScrollHeight =
  document.documentElement.scrollHeight - window.innerHeight;

// MẪU QUẢN LÝ VỊ TRÍ MÔ HÌNH 3D

const modelPositionConfig = {
  // Chỉ vị trí và tỉ lệ - rotation được xử lý bởi cuộn liên tục
  keyframes: [
    {
      scrollPercent: 0, // Ở đầu trang
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }, // Rotation Y được điều khiển bởi totalRotation
      scale: { x: 1, y: 1, z: 1 },
    },
    {
      scrollPercent: 1, // Ở cuối trang
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: -30, z: 0 }, // Rotation Y được điều khiển bởi totalRotation
      scale: { x: 1, y: 1, z: 1 },
    },
  ],

  // Cài đặt animation - QUAN TRỌNG: Smoothing nhỏ = phản hồi nhanh hơn
  // Use a small smoothing so we don't immediately override manual scale changes.
  smoothing: 0.05, // smaller -> smoother transitions (0.01-0.15 recommended)
  enableFloating: false,
  floatingAmplitude: 0,
  floatingSpeed: 0,
};

// Hàm tiện ích nội suy giữa hai giá trị
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

// Hàm tiện ích nội suy giữa hai vector 3D
function lerpVector3(start, end, factor) {
  return {
    x: lerp(start.x, end.x, factor),
    y: lerp(start.y, end.y, factor),
    z: lerp(start.z, end.z, factor),
  };
}

// Hàm lấy vị trí/rotation/scale nội suy dựa trên cuộn trang
function getModelTransform(scrollProgress) {
  const keyframes = modelPositionConfig.keyframes;

  // Giới hạn tiến trình cuộn giữa 0 và 1
  scrollProgress = Math.max(0, Math.min(1, scrollProgress));

  // Tìm hai keyframe nằm giữa chúng ta
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

  // Tính hệ số nội suy giữa hai keyframe
  const range = nextKeyframe.scrollPercent - prevKeyframe.scrollPercent;
  const factor =
    range === 0 ? 0 : (scrollProgress - prevKeyframe.scrollPercent) / range;

  // Nội suy vị trí, rotation và tỉ lệ
  return {
    position: lerpVector3(prevKeyframe.position, nextKeyframe.position, factor),
    rotation: lerpVector3(prevKeyframe.rotation, nextKeyframe.rotation, factor),
    scale: lerpVector3(prevKeyframe.scale, nextKeyframe.scale, factor),
  };
}

// Để tuỳ chỉnh thêm, chỉnh mảng keyframes trong modelPositionConfig

// UI split/ScrollTrigger utilities removed to keep the bundle focused on the 3D scene.

lenis.on("scroll", (e) => {
  currentScroll = e.scroll;
});

// Quay liên tục lặp lại hoàn hảo từ -30° đến -30°
const startRotation = -30 * (Math.PI / 180); // -30 degrees in radians
const rotationsPerCycle = 2; // Number of full rotations per scroll cycle

function animate() {
  const time = Date.now();

  // Cập nhật làm mượt chuột
  updateMouse();

  const curModel = activeModel || model;
  if (curModel) {
    // Get scroll progress (0 to 1) across the page (clamped). When Lenis
    // infinite scrolling is disabled this maps 0 at top → 1 at bottom.
    const scrollProgress =
      totalScrollHeight > 0
        ? Math.max(0, Math.min(1, currentScroll / totalScrollHeight))
        : 0;

    // ========================================
    // HIỆU ỨNG ĐỘNG DỰA TRÊN CUỘN & CHUỘT (HIỆN ĐẠI)
    // ========================================

    // Cập nhật nhiễu động theo thời gian
    noisePass.uniforms.time.value = time * 0.0001;

    // Sai số màu tăng theo cuộn (hiệu ứng biến dạng hiện đại)
    chromaticPass.uniforms.amount.value = 0.002 + scrollProgress * 0.004;
    chromaticPass.uniforms.angle.value = scrollProgress * Math.PI * 2;

    // Vignette tối đi nhẹ theo cuộn để tăng kịch tính
    vignettePass.uniforms.darkness.value = 1.3 + scrollProgress * 0.3;

    // Độ nét giảm theo cuộn (mềm hơn ở cuối)
    sharpenPass.uniforms.amount.value = 0.5 - scrollProgress * 0.2;

    // Nhuộm màu thay đổi dựa trên cuộn (chuyển đổi màu hiện đại)
    const hue = scrollProgress * 0.3; // Shift through 30% of color spectrum
    colorGradingPass.uniforms.colorTint.value.setHSL(0.55 + hue, 0.6, 0.5); // Cyan to blue range
    colorGradingPass.uniforms.tintStrength.value = 0.05 + scrollProgress * 0.08;

    // Tăng nhẹ tương phản khi di chuột (phản hồi tương tác)
    const mouseActivity = Math.abs(mouse.x) + Math.abs(mouse.y);
    colorGradingPass.uniforms.contrast.value = 1.2 + mouseActivity * 0.08;

    // Tính quay: bắt đầu -30°, thực hiện 2 vòng đầy đủ, kết thúc lại -30°
    const rotationAmount = scrollProgress * (Math.PI * 2 * rotationsPerCycle);
    const currentRotation = startRotation + rotationAmount;

    // Giữ vị trí và tỉ lệ từ cấu hình
    const transform = getModelTransform(scrollProgress);

    // Áp dụng animation nổi nếu được bật
    let finalY = transform.position.y;
    if (modelPositionConfig.enableFloating && isFloating) {
      const floatOffset =
        Math.sin(time * 0.001 * modelPositionConfig.floatingSpeed) *
        modelPositionConfig.floatingAmplitude;
      finalY += floatOffset;
    }

    // Áp dụng các biến đổi đã tính với làm mượt
    const smoothing = modelPositionConfig.smoothing;

    // Determine sensitivity: reduce interaction strength for second model
    const isSecond = activeModel === secondModel;
    const sensitivityFactor = isSecond ? 0.35 : 1.0;

    // Nội suy vị trí mượt với hiệu ứng parallax chuột RẤT NHẸ
    const parallaxOffsetX = mouse.x * 5 * sensitivityFactor; // Very subtle - max ~5 units
    const parallaxOffsetY = mouse.y * 3 * sensitivityFactor; // Very subtle - max ~3 units

    curModel.position.x = lerp(
      curModel.position.x,
      transform.position.x + parallaxOffsetX,
      smoothing
    );
    curModel.position.y = lerp(
      curModel.position.y,
      finalY + parallaxOffsetY,
      smoothing
    );
    curModel.position.z = lerp(
      curModel.position.z,
      transform.position.z,
      smoothing
    );

    // Quay - trục Y lặp hoàn hảo từ -30° đến -30°, X và Z lấy từ cấu hình
    // Thêm quay dựa trên chuột RẤT NHẸ (scaled per-model)
    const mouseRotationX = mouse.y * 0.02 * sensitivityFactor; // Reduced when second model active
    const mouseRotationZ = -mouse.x * 0.01 * sensitivityFactor;

    curModel.rotation.x = lerp(
      curModel.rotation.x,
      transform.rotation.x + mouseRotationX,
      smoothing
    );
    curModel.rotation.y = currentRotation; // Seamless loop: -30° at 0% and 100%
    curModel.rotation.z = lerp(
      curModel.rotation.z,
      transform.rotation.z + mouseRotationZ,
      smoothing
    );

    // Nội suy tỉ lệ mượt
    try {
      // If the model has been manually scaled and locked, do not override its
      // root scale from the keyframe transform. This preserves manual fixes like
      // scaleUntitledToFlow(). You can unlock by deleting model.userData.lockedScale.
      if (!curModel.userData || !curModel.userData.lockedScale) {
        curModel.scale.x = lerp(curModel.scale.x, transform.scale.x, smoothing);
        curModel.scale.y = lerp(curModel.scale.y, transform.scale.y, smoothing);
        curModel.scale.z = lerp(curModel.scale.z, transform.scale.z, smoothing);
      }
    } catch (e) {
      // ignore
    }

    // HIỆU ỨNG VẬT LIỆU PHẢN HỒI THEO CON TRỎ
    // Khiến vật liệu mô hình phản hồi gần-gần của chuột (tương tác hiện đại)
    curModel.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material)
          ? node.material
          : [node.material];
        mats.forEach((mat) => {
          // Độ nhám động dựa trên hoạt động chuột (bóng hơn khi tương tác)
          const targetRoughness = 0.2 - mouseActivity * 0.1 * sensitivityFactor;
          if (mat.roughness !== undefined) {
            mat.roughness = lerp(
              mat.roughness,
              Math.max(0.05, targetRoughness),
              0.05
            );
          }

          // Cường độ bản đồ môi trường động (sáng hơn khi tương tác)
          const targetEnvIntensity =
            3.5 + mouseActivity * 0.8 * sensitivityFactor;
          if (mat.envMapIntensity !== undefined) {
            mat.envMapIntensity = lerp(
              mat.envMapIntensity,
              targetEnvIntensity,
              0.05
            );
          }
        });
      }
    });
  }

  // Cursor is handled by the modular cursor (src/three/cursor.js)
  // Hoạt ảnh hạt hiện đại (Three.js particles)
  animateParticles(time);

  // If the Flow background is present, make the Untitled "logo" start
  // at the top of the page (anchored to the hero element) and move down with
  // the current viewport while scrolling. After a configurable threshold it
  // will blend into a world-space orbit around the spine.
  if (
    flowPresent &&
    flowSidePos &&
    flowCenterGlobal &&
    flowLookTop &&
    flowLookBottom
  ) {
    try {
      const logoProgress = Math.max(
        0,
        Math.min(1, currentScroll / Math.max(1, totalScrollHeight))
      );

      // Orbit geometry derived from flow spine
      const sideOffset = Math.abs(flowSidePos.x - flowCenterGlobal.x) || Math.max(modelMaxDim * 0.8, 400);
      const baseRadius = Math.max(180, sideOffset * 0.6);
      const revolutions = 1.2;
      const angle = -logoProgress * revolutions * Math.PI * 2;
      const orbitY = lerp(flowLookTop.y, flowLookBottom.y, logoProgress);
      const orbitX = flowCenterGlobal.x + baseRadius * Math.cos(angle);
      const orbitZ = flowCenterGlobal.z + baseRadius * Math.sin(angle);

      // Screen anchor (DOM element center) — prefer `#hero-model` so the logo
      // visually appears stuck to the hero area at the top of the page.
      const heroEl = document.getElementById('hero-model') || document.querySelector('.hero') || document.querySelector('.model');
      const heroRect = heroEl ? heroEl.getBoundingClientRect() : null;
      const heroCx = heroRect ? heroRect.left + heroRect.width / 2 : window.innerWidth / 2;
      const heroCy = heroRect ? heroRect.top + heroRect.height / 2 : window.innerHeight * 0.18; // default near top

      // scroll range where logo stays attached to screen and moves down with it
      const stickUntil = 0.25; // fraction of total scroll

      // compute the screen-space Y the logo should occupy while stuck:
      // it moves from heroCy (top) toward mid-screen as the user scrolls
      const stuckT = Math.max(0, Math.min(1, logoProgress / stickUntil));
      const screenTargetY = lerp(heroCy, window.innerHeight * 0.5, stuckT);
      const screenTargetX = heroCx; // keep horizontally centered on hero

      // project screen target to world (unproject) at a chosen depth
      const startDist = Math.max(modelMaxDim * 0.9, 600);
      const ndc = new THREE.Vector3((screenTargetX / window.innerWidth) * 2 - 1, -(screenTargetY / window.innerHeight) * 2 + 1, 0.5);
      ndc.unproject(camera);
      const dir = ndc.clone().sub(camera.position).normalize();
      const stuckWorld = camera.position.clone().add(dir.multiplyScalar(startDist));

      // After sticking phase, blend from the stuckWorld into the orbit world
      const blendFrom = Math.max(0, logoProgress - stickUntil) / Math.max(1e-6, 1 - stickUntil);
      const blendT = Math.max(0, Math.min(1, blendFrom));

      // compute final world target (interpolate between stuckWorld and orbit position)
      const finalTarget = new THREE.Vector3(
        lerp(stuckWorld.x, orbitX, blendT),
        lerp(stuckWorld.y, orbitY, blendT),
        lerp(stuckWorld.z, orbitZ, blendT)
      );

      if (model && (activeModel === model || activeModel === null)) {
        const smooth = modelPositionConfig.smoothing || 0.05;
        model.position.x = lerp(model.position.x, finalTarget.x, smooth);
        model.position.y = lerp(model.position.y, finalTarget.y, smooth);
        model.position.z = lerp(model.position.z, finalTarget.z, smooth);

        // orientation: during stick-phase face the camera; during orbit face the spine
        const yawToCamera = Math.atan2(camera.position.x - model.position.x, camera.position.z - model.position.z);
        const yawToSpine = Math.atan2(flowCenterGlobal.x - model.position.x, flowCenterGlobal.z - model.position.z);
        const targetYaw = lerp(yawToCamera, yawToSpine, blendT);
        model.rotation.y = lerp(model.rotation.y || 0, targetYaw, Math.min(0.18, smooth * 1.5));
      }
    } catch (e) {
      // defensive: do not interrupt the render loop
    }
  }

  // If the Flow background is present, move the camera along a vertical rail
  // (top -> bottom) while keeping it at a fixed side position so it looks at
  // the model from the side (no upward tilt). This makes the scroll feel like
  // moving along the side of the spine from top to bottom.
  if (
    flowPresent &&
    flowSidePos &&
    flowCenterGlobal &&
    flowLookTop &&
    flowLookBottom
  ) {
    const progress = Math.max(
      0,
      Math.min(1, currentScroll / Math.max(1, totalScrollHeight))
    );

    const topY = flowLookTop.y;
    const bottomY = flowLookBottom.y;
    const targetY = lerp(topY, bottomY, progress);

    // Keep camera at the computed side X/Z, but slide Y from top->bottom
    camera.position.x = flowSidePos.x;
    camera.position.z = flowSidePos.z;
    camera.position.y = targetY;

    // Look horizontally at the model's center at the same Y level (side view)
    camera.lookAt(
      new THREE.Vector3(flowCenterGlobal.x, targetY, flowCenterGlobal.z)
    );
  }

  // Update screen-space cursor particles (dt in ms)
  const nowPerf = performance.now();
  const dt = Math.max(1, nowPerf - _lastFrameTS);
  _lastFrameTS = nowPerf;
  if (window.updateAndRenderParticles) window.updateAndRenderParticles(dt);

  composer.render(); // Use composer for post-processing effects
  requestAnimationFrame(animate);
}

// Split-type and ScrollTrigger based intro/outro animations removed (unused in current build)

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

// ========================================
// RESPONSIVE HANDLING
// ========================================

// Handle window resize for responsive design
window.addEventListener("resize", () => {
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance

  // Update composer size for post-processing
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Optimize for mobile devices
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
if (isMobile) {
  // Reduce quality slightly on mobile for better performance
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // Adjust scroll speed for mobile
  modelPositionConfig.smoothing = 0.15; // Slightly more responsive on mobile
}

// NAV LINK SMOOTH SCROLL
document.querySelectorAll('nav a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (e) => {
    e.preventDefault();
    const targetId = anchor.getAttribute("href").slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;

    // Prefer Lenis smooth scrolling if available
    if (
      typeof lenis !== "undefined" &&
      lenis &&
      typeof lenis.scrollTo === "function"
    ) {
      lenis.scrollTo(target, { offset: 0, duration: 1.0 });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// Initialize cursor and particle subsystems via small modules.
// Modules are loaded via <script> tags (see index.html) and attach APIs to window.
if (window.initParticleSystem) {
  try {
    window.initParticleSystem();
  } catch (e) {
    /* ignore */
  }
}
if (window.initCursor) {
  try {
    window.initCursor();
  } catch (e) {
    /* ignore */
  }
}

// MODEL SWITCHING: observe #features and toggle between `model` and `secondModel`
// Smoothly switch active model with cross-fade and camera tween (uses GSAP)
function fadeMaterialOpacity(mat, toOpacity, dur) {
  if (!mat) return;
  // store original opacity
  if (mat.userData._origOpacity === undefined)
    mat.userData._origOpacity = mat.opacity === undefined ? 1 : mat.opacity;
  mat.transparent = true;
  gsap.to(mat, {
    opacity: toOpacity,
    duration: dur,
    onUpdate: () => (mat.needsUpdate = true),
  });
}

function fadeModelMaterials(object3d, toOpacity, dur) {
  if (!object3d) return;
  object3d.traverse((node) => {
    if (node.isMesh && node.material) {
      const mats = Array.isArray(node.material)
        ? node.material
        : [node.material];
      mats.forEach((m) => fadeMaterialOpacity(m, toOpacity, dur));
    }
  });
}

function setActiveModel(newModel, frame) {
  if (newModel === activeModel) return;
  const dur = 0.9; // seconds
  const outgoing = activeModel;

  // Prepare incoming
  if (newModel) {
    newModel.visible = true;
    // initialize incoming opacity to 0
    newModel.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material)
          ? node.material
          : [node.material];
        mats.forEach((m) => {
          if (m.userData._origOpacity === undefined)
            m.userData._origOpacity = m.opacity === undefined ? 1 : m.opacity;
          m.opacity = 0;
          m.transparent = true;
          m.needsUpdate = true;
        });
      }
    });
  }

  // Cross-fade outgoing -> incoming
  if (outgoing) {
    fadeModelMaterials(outgoing, 0, dur);
  }
  if (newModel) {
    fadeModelMaterials(newModel, 1, dur);
  }

  // Camera tween to frame (if provided)
  if (frame && frame.maxDim) {
    const to = { x: 0, y: frame.maxDim * 0.3, z: frame.maxDim * 1.75 };
    gsap.to(camera.position, {
      x: to.x,
      y: to.y,
      z: to.z,
      duration: dur,
      ease: "power2.inOut",
      onUpdate: () => camera.lookAt(0, 0, 0),
    });
  }

  // After fade, hide outgoing
  if (outgoing) {
    setTimeout(() => {
      try {
        outgoing.visible = false;
      } catch (e) {}
    }, dur * 1000 + 50);
  }

  activeModel = newModel;
}

const featuresSection = document.getElementById("features");
if (featuresSection) {
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // switch to second model if available
          if (secondModel) {
            setActiveModel(
              secondModel,
              secondModelFrame || { maxDim: modelMaxDim }
            );
          }
        } else {
          // revert to primary model
          if (model) setActiveModel(model, { maxDim: modelMaxDim });
        }
      });
    },
    { threshold: 0.45 }
  );

  obs.observe(featuresSection);
}
