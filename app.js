// 3D Art Playground - Web Version
// Adapted from Meta Quest VR version for desktop/mobile browsers

const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

// Global state
let scene;
let camera;
let physicsPlugin;
let ground;

// Drawing state
let strokes = [];
let currentStroke = null;
let isDrawing = false;
let lineWidth = 0.05;
const maxStrokes = 100;
const smoothingDistance = 0.01;

// Interaction state
let currentMode = 'draw'; // 'draw', 'grab', 'orbit'
let grabbedStroke = null;
let physicsOnDrop = true;

// Color palette
const colorPalette = [
    { name: "White", color: new BABYLON.Color3(1, 1, 1) },
    { name: "Red", color: new BABYLON.Color3(1, 0, 0) },
    { name: "Green", color: new BABYLON.Color3(0, 1, 0) },
    { name: "Blue", color: new BABYLON.Color3(0, 0, 1) },
    { name: "Yellow", color: new BABYLON.Color3(1, 1, 0) },
    { name: "Orange", color: new BABYLON.Color3(1, 0.5, 0) },
    { name: "Purple", color: new BABYLON.Color3(0.5, 0, 0.5) },
    { name: "Cyan", color: new BABYLON.Color3(0, 1, 1) },
    { name: "Pink", color: new BABYLON.Color3(1, 0.4, 0.7) }
];
let currentColorIndex = 0;

const getCurrentColor = () => colorPalette[currentColorIndex].color;

// Create the scene
const createScene = async function() {
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);

    // Enable Havok Physics
    const hk = await HavokPhysics();
    physicsPlugin = new BABYLON.HavokPlugin(true, hk);
    scene.enablePhysics(new BABYLON.Vector3(0, -3, 0), physicsPlugin);
    console.log("Havok Physics Enabled!");

    // Arc Rotate Camera - good for desktop/mobile
    camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        Math.PI / 3,
        5,
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 20;
    camera.wheelPrecision = 50;
    camera.pinchPrecision = 50;

    // Lighting
    const hemisphericLight = new BABYLON.HemisphericLight(
        "hemisphericLight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    hemisphericLight.intensity = 0.7;

    const directionalLight = new BABYLON.DirectionalLight(
        "directionalLight",
        new BABYLON.Vector3(-1, -2, -1),
        scene
    );
    directionalLight.intensity = 0.5;

    // Ground with grid
    ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);
    const groundMat = new BABYLON.GridMaterial("groundMat", scene);
    groundMat.majorUnitFrequency = 1;
    groundMat.minorUnitVisibility = 0.3;
    groundMat.gridRatio = 1;
    groundMat.backFaceCulling = false;
    groundMat.mainColor = new BABYLON.Color3(0.2, 0.2, 0.25);
    groundMat.lineColor = new BABYLON.Color3(0.4, 0.4, 0.5);
    groundMat.opacity = 0.8;
    ground.material = groundMat;

    // Ground physics
    const groundAggregate = new BABYLON.PhysicsAggregate(
        ground,
        BABYLON.PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.2, friction: 0.8 },
        scene
    );

    // Drawing plane (invisible, used for raycasting)
    const drawingPlane = BABYLON.MeshBuilder.CreatePlane("drawingPlane", { size: 20 }, scene);
    drawingPlane.rotation.x = Math.PI / 2;
    drawingPlane.position.y = 1;
    drawingPlane.visibility = 0;
    drawingPlane.isPickable = true;

    // Cursor indicator
    const cursorIndicator = BABYLON.MeshBuilder.CreateSphere("cursor", { diameter: 0.1 }, scene);
    const cursorMat = new BABYLON.StandardMaterial("cursorMat", scene);
    cursorMat.diffuseColor = getCurrentColor();
    cursorMat.emissiveColor = getCurrentColor().scale(0.5);
    cursorMat.alpha = 0.7;
    cursorIndicator.material = cursorMat;
    cursorIndicator.isPickable = false;

    // Setup input handling
    setupInputHandling(drawingPlane, cursorIndicator);

    return scene;
};

// Create stroke mesh
const createStrokeMesh = (points, color, width) => {
    if (points.length < 2) return null;

    const tube = BABYLON.MeshBuilder.CreateTube("stroke", {
        path: points,
        radius: width,
        tessellation: 8,
        cap: BABYLON.Mesh.CAP_ALL,
        updatable: true
    }, scene);

    const material = new BABYLON.StandardMaterial("strokeMat", scene);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.3);
    material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    tube.material = material;

    return tube;
};

// Add physics to stroke
const addStrokePhysics = (mesh, mass = 0.1) => {
    if (mesh._physicsAggregate) {
        mesh._physicsAggregate.dispose();
        mesh._physicsAggregate = null;
    }

    const aggregate = new BABYLON.PhysicsAggregate(
        mesh,
        BABYLON.PhysicsShapeType.MESH,
        { mass, restitution: 0.3, friction: 0.5 },
        scene
    );

    mesh._physicsAggregate = aggregate;
    return aggregate;
};

// Drawing functions
const startDrawing = (position) => {
    if (isDrawing || currentMode !== 'draw') return;

    isDrawing = true;
    currentStroke = {
        points: [position.clone()],
        color: getCurrentColor().clone(),
        width: lineWidth,
        mesh: null
    };
    console.log("Started drawing with color:", colorPalette[currentColorIndex].name);
};

const addPoint = (position) => {
    if (!isDrawing || !currentStroke) return;

    const points = currentStroke.points;
    const lastPoint = points[points.length - 1];
    const distance = BABYLON.Vector3.Distance(position, lastPoint);

    if (distance > smoothingDistance) {
        points.push(position.clone());
        updateStrokeMesh();
    }
};

const updateStrokeMesh = () => {
    const points = currentStroke.points;

    if (points.length < 2) return;

    if (currentStroke.mesh) {
        currentStroke.mesh.dispose();
    }

    currentStroke.mesh = createStrokeMesh(
        points,
        currentStroke.color,
        currentStroke.width
    );
};

const stopDrawing = () => {
    if (!isDrawing) return;

    isDrawing = false;

    if (currentStroke && currentStroke.points.length > 1) {
        if (currentStroke.mesh) {
            // Add static physics (mass=0)
            addStrokePhysics(currentStroke.mesh, 0);
        }

        strokes.push(currentStroke);
        console.log("Stroke saved. Total:", strokes.length);

        if (strokes.length > maxStrokes) {
            const oldStroke = strokes.shift();
            if (oldStroke.mesh) {
                if (oldStroke.mesh._physicsAggregate) {
                    oldStroke.mesh._physicsAggregate.dispose();
                }
                oldStroke.mesh.dispose();
            }
        }
    } else if (currentStroke && currentStroke.mesh) {
        currentStroke.mesh.dispose();
    }

    currentStroke = null;
};

// Undo function
const undo = () => {
    if (strokes.length === 0) return;

    const lastStroke = strokes.pop();
    if (lastStroke.mesh) {
        if (lastStroke.mesh._physicsAggregate) {
            lastStroke.mesh._physicsAggregate.dispose();
        }
        lastStroke.mesh.dispose();
    }
    console.log("Undo. Remaining:", strokes.length);
};

// Clear all
const clearAll = () => {
    strokes.forEach(stroke => {
        if (stroke.mesh) {
            if (stroke.mesh._physicsAggregate) {
                stroke.mesh._physicsAggregate.dispose();
            }
            stroke.mesh.dispose();
        }
    });
    strokes = [];
    console.log("Cleared all strokes");
};

// Grab functionality
const tryGrabStroke = (pickResult) => {
    if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.name.startsWith("stroke")) {
        grabbedStroke = pickResult.pickedMesh;

        // Remove physics while grabbing
        if (grabbedStroke._physicsAggregate) {
            grabbedStroke._physicsAggregate.dispose();
            grabbedStroke._physicsAggregate = null;
        }

        console.log("Grabbed stroke");
        return true;
    }
    return false;
};

const moveGrabbedStroke = (position) => {
    if (!grabbedStroke) return;
    grabbedStroke.position = position;
};

const releaseStroke = () => {
    if (!grabbedStroke) return;

    if (physicsOnDrop) {
        // Add dynamic physics (mass > 0)
        addStrokePhysics(grabbedStroke, 0.15);
        console.log("Released stroke with physics");
    } else {
        // Add static physics
        addStrokePhysics(grabbedStroke, 0);
        console.log("Released stroke (static)");
    }

    grabbedStroke = null;
};

// Input handling
const setupInputHandling = (drawingPlane, cursorIndicator) => {
    let lastPointerPosition = null;
    let pointerDown = false;

    // Get 3D position from screen coordinates
    const get3DPosition = (evt) => {
        const pickResult = scene.pick(evt.clientX, evt.clientY, (mesh) => mesh === drawingPlane);
        if (pickResult.hit) {
            return pickResult.pickedPoint;
        }
        return null;
    };

    // Update cursor
    const updateCursor = (position, color) => {
        if (position) {
            cursorIndicator.position = position;
            cursorIndicator.isVisible = true;
            cursorIndicator.material.diffuseColor = color;
            cursorIndicator.material.emissiveColor = color.scale(0.5);
            cursorIndicator.scaling = new BABYLON.Vector3(lineWidth * 2, lineWidth * 2, lineWidth * 2);
        } else {
            cursorIndicator.isVisible = false;
        }
    };

    // Pointer events
    canvas.addEventListener('pointerdown', (evt) => {
        pointerDown = true;

        if (currentMode === 'draw' && evt.button === 0) {
            camera.detachControl();
            const pos = get3DPosition(evt);
            if (pos) {
                startDrawing(pos);
            }
        } else if (currentMode === 'grab' && evt.button === 0) {
            camera.detachControl();
            const pickResult = scene.pick(evt.clientX, evt.clientY, (mesh) => mesh.name.startsWith("stroke"));
            tryGrabStroke(pickResult);
        } else if (currentMode === 'orbit' || evt.button === 2) {
            camera.attachControl(canvas, true);
        }

        lastPointerPosition = { x: evt.clientX, y: evt.clientY };
    });

    canvas.addEventListener('pointermove', (evt) => {
        const pos = get3DPosition(evt);

        if (currentMode === 'draw') {
            updateCursor(pos, getCurrentColor());
            if (isDrawing && pos) {
                addPoint(pos);
            }
        } else if (currentMode === 'grab') {
            if (grabbedStroke && pos) {
                moveGrabbedStroke(pos);
            }
            updateCursor(grabbedStroke ? pos : null, new BABYLON.Color3(1, 0.5, 0));
        } else {
            updateCursor(null, getCurrentColor());
        }

        lastPointerPosition = { x: evt.clientX, y: evt.clientY };
    });

    canvas.addEventListener('pointerup', (evt) => {
        pointerDown = false;

        if (currentMode === 'draw') {
            stopDrawing();
            camera.attachControl(canvas, true);
        } else if (currentMode === 'grab') {
            releaseStroke();
            camera.attachControl(canvas, true);
        }
    });

    canvas.addEventListener('pointerleave', () => {
        if (isDrawing) {
            stopDrawing();
        }
        if (grabbedStroke) {
            releaseStroke();
        }
        pointerDown = false;
    });

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (evt) => {
        evt.preventDefault();
    });

    // Touch handling for mobile
    let touchCount = 0;

    canvas.addEventListener('touchstart', (evt) => {
        touchCount = evt.touches.length;

        if (touchCount > 1) {
            // Multi-touch = orbit mode
            if (isDrawing) {
                stopDrawing();
            }
            camera.attachControl(canvas, true);
        }
    });

    canvas.addEventListener('touchend', () => {
        touchCount = 0;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (evt) => {
        switch(evt.key.toLowerCase()) {
            case 'z':
                if (evt.ctrlKey || evt.metaKey) {
                    evt.preventDefault();
                    undo();
                }
                break;
            case 'g':
                setMode('grab');
                break;
            case 'd':
                setMode('draw');
                break;
            case 'o':
                setMode('orbit');
                break;
            case 'escape':
                if (isDrawing) stopDrawing();
                if (grabbedStroke) releaseStroke();
                break;
        }
    });
};

// Set interaction mode
const setMode = (mode) => {
    currentMode = mode;

    // Update UI
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.mode === mode);
    });

    // Stop any current action
    if (isDrawing) stopDrawing();
    if (grabbedStroke) releaseStroke();

    // Always ensure camera is attached in orbit mode
    if (mode === 'orbit' && camera) {
        camera.attachControl(canvas, true);
    }

    console.log("Mode:", mode);
};

// Set color
const setColor = (index) => {
    currentColorIndex = index;

    // Update UI
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.color) === index);
    });

    console.log("Color:", colorPalette[index].name);
};

// Set brush size
const setBrushSize = (size) => {
    lineWidth = size;
    document.getElementById('size-value').textContent = size.toFixed(3);
};

// Initialize UI
const initUI = () => {
    // Instructions
    const instructionsOverlay = document.getElementById('instructions');
    const startBtn = document.getElementById('start-btn');

    startBtn.addEventListener('click', () => {
        instructionsOverlay.style.display = 'none';
    });

    // Color palette
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setColor(parseInt(btn.dataset.color));
        });
    });

    // Brush size slider
    const brushSizeSlider = document.getElementById('brush-size');
    brushSizeSlider.addEventListener('input', (evt) => {
        setBrushSize(parseFloat(evt.target.value));
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setMode(btn.dataset.mode);
        });
    });

    // Action buttons
    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('clear-btn').addEventListener('click', clearAll);

    // Physics toggle
    document.getElementById('physics-enabled').addEventListener('change', (evt) => {
        physicsOnDrop = evt.target.checked;
    });

    // Panel toggle
    const controlPanel = document.getElementById('control-panel');
    const toggleBtn = document.getElementById('toggle-panel');

    toggleBtn.addEventListener('click', () => {
        controlPanel.classList.toggle('collapsed');
        toggleBtn.textContent = controlPanel.classList.contains('collapsed') ? '+' : '-';
    });

    // Mobile controls
    document.getElementById('mobile-undo')?.addEventListener('click', undo);
    document.getElementById('mobile-menu')?.addEventListener('click', () => {
        controlPanel.classList.toggle('hidden');
    });

    // Hide loading screen
    document.getElementById('loading-screen').style.display = 'none';
};

// Main initialization
const init = async () => {
    try {
        // Load GridMaterial extension
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.babylonjs.com/materialsLibrary/babylonjs.materials.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        await createScene();
        initUI();

        engine.runRenderLoop(() => {
            scene.render();
        });

        window.addEventListener('resize', () => {
            engine.resize();
        });

        console.log("=================================");
        console.log("3D ART PLAYGROUND - WEB VERSION");
        console.log("=================================");
        console.log("Left-click: Draw");
        console.log("Right-click: Orbit camera");
        console.log("Scroll: Zoom");
        console.log("G key: Grab mode");
        console.log("D key: Draw mode");
        console.log("Ctrl+Z: Undo");
        console.log("=================================");

    } catch (error) {
        console.error("Initialization error:", error);
        document.getElementById('loading-screen').innerHTML = `
            <p style="color: red;">Error loading: ${error.message}</p>
            <p>Please refresh the page.</p>
        `;
    }
};

// Start the app
init();
