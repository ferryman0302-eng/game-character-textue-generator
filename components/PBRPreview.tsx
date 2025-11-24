
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface PBRPreviewProps {
  colorMap: string;
  normalMap?: string | null;
  roughnessMap?: string | null;
  metallicMap?: string | null;
  aoMap?: string | null;
  heightMap?: string | null;
}

const PBRPreview: React.FC<PBRPreviewProps> = ({ colorMap, normalMap, roughnessMap, metallicMap, aoMap, heightMap }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Init Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050b14); // Very dark blue/black
    sceneRef.current = scene;

    // Init Camera
    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 2.0); // Flat on view initially

    // Init Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- Environment / Studio Lighting ---
    // Use PMREMGenerator to process the RoomEnvironment for realistic reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const environmentTexture = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    scene.environment = environmentTexture; 
    // scene.background = environmentTexture; // Optional: show the room blur or keep cyber dark background

    // Additional directional light for strong shadows (Key Light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(2, 2, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 5;

    // Geometry: High-poly Plane for accurate UVs and potential displacement
    // 256 segments for detailed height map visualization
    const geometry = new THREE.PlaneGeometry(1.5, 1.5, 256, 256);
    // Duplicate UVs to uv2 for Ambient Occlusion Map
    geometry.setAttribute('uv2', geometry.attributes.uv);
    
    // Material: Physical based
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    meshRef.current = mesh;

    // Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle Resize
    const handleResize = () => {
      if (mountRef.current && rendererRef.current) {
        camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      pmremGenerator.dispose();
      environmentTexture.dispose();
    };
  }, []);

  // Update Textures
  useEffect(() => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    const loader = new THREE.TextureLoader();

    // Helper to setup texture
    const setupTexture = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.NoColorSpace; // Default to linear for data maps
      // If we want to preview tiling, we can set repeat here, but plain view usually implies 1:1
    };

    // Load Base Color
    if (colorMap) {
      loader.load(colorMap, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace; // Color is SRGB
        setupTexture(tex);
        material.map = tex;
        material.needsUpdate = true;
      });
    }

    // Load Normal
    if (normalMap) {
      loader.load(normalMap, (tex) => {
        setupTexture(tex);
        material.normalMap = tex;
        material.normalScale.set(1, 1);
        material.needsUpdate = true;
      });
    } else {
      material.normalMap = null;
      material.needsUpdate = true;
    }

    // Load Roughness
    if (roughnessMap) {
      loader.load(roughnessMap, (tex) => {
        setupTexture(tex);
        material.roughnessMap = tex;
        material.roughness = 1; 
        material.needsUpdate = true;
      });
    } else {
      material.roughnessMap = null;
      material.roughness = 0.5;
      material.needsUpdate = true;
    }

    // Load Metallic
    if (metallicMap) {
      loader.load(metallicMap, (tex) => {
        setupTexture(tex);
        material.metalnessMap = tex;
        material.metalness = 1;
        material.needsUpdate = true;
      });
    } else {
      material.metalnessMap = null;
      material.metalness = 0.0;
      material.needsUpdate = true;
    }

    // Load Ambient Occlusion
    if (aoMap) {
        loader.load(aoMap, (tex) => {
          setupTexture(tex);
          material.aoMap = tex;
          material.aoMapIntensity = 1.0;
          material.needsUpdate = true;
        });
    } else {
        material.aoMap = null;
        material.needsUpdate = true;
    }

    // Load Height/Displacement
    if (heightMap) {
        loader.load(heightMap, (tex) => {
            setupTexture(tex);
            material.displacementMap = tex;
            material.displacementScale = 0.15; // Enhanced displacement depth
            material.displacementBias = -0.075; 
            material.needsUpdate = true;
        });
    } else {
        material.displacementMap = null;
        material.needsUpdate = true;
    }

  }, [colorMap, normalMap, roughnessMap, metallicMap, aoMap, heightMap]);

  return <div ref={mountRef} className="w-full h-full min-h-[400px] bg-transparent cursor-move" />;
};

export default PBRPreview;
