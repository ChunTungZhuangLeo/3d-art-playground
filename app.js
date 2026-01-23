// 3D Art Playground - Web Version
// Basketball Demo for Incubator Pitch

const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

// Global state
let scene;
let camera;
let physicsPlugin;
let ground;

// Basketball hoop
let hoopRim;
let hoopTrigger;
let scoreCount = 0;

// Drawing state
let strokes = [];
let currentStroke = null;
let isDrawing = false;
let lineWidth = 0.05;
const maxStrokes = 100;
const smoothingDistance = 0.01;

// Interaction state
let currentMode = 'draw';
let grabbedStroke = null;
let physicsOnDrop = true;

// Tutorial state
let tutorialStep = 0; // 0: draw, 1: grab, 2: throw, 3: free play

// Color palette - orange first for basketball
const colorPalette = [
    { name: "Orange", color: new BABYLON.Color3(1, 0.5, 0) },
    { name: "White", color: new BABYLON.Color3(1, 1, 1) },
    { name: "Red", color: new BABYLON.Color3(1, 0, 0) },
    { name: "Green", color: new BABYLON.Color3(0, 1, 0) },
    { name: "Blue", color: new BABYLON.Color3(0, 0, 1) },
    { name: "Yellow", color: new BABYLON.Color3(1, 1, 0) },
    { name: "Purple", color: new BABYLON.Color3(0.5, 0, 0.5) },
    { name: "Cyan", color: new BABYLON.Color3(0, 1, 1) },
    { name: "Pink", color: new BABYLON.Color3(1, 0.4, 0.7) }
];
let currentColorIndex = 0;

const getCurrentColor = () => colorPalette[currentColorIndex].color;

// Create basketball hoop (facing the user - rim in front, backboard behind)
const createBasketballHoop = () => {
    // Backboard (behind the rim, further from user)
    const backboard = BABYLON.MeshBuilder.CreateBox("backboard", {
        width: 1.8,
        height: 1.2,
        depth: 0.1
    }, scene);
    backboard.position = new BABYLON.Vector3(0, 3, -4);

    const backboardMat = new BABYLON.StandardMaterial("backboardMat", scene);
    backboardMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    backboardMat.alpha = 0.7;
    backboard.material = backboardMat;

    // Backboard frame
    const frameColor = new BABYLON.Color3(0.8, 0.2, 0.2);

    // Red square on backboard (on the front face, toward user)
    const targetSquare = BABYLON.MeshBuilder.CreateBox("targetSquare", {
        width: 0.6,
        height: 0.45,
        depth: 0.02
    }, scene);
    targetSquare.position = new BABYLON.Vector3(0, 2.85, -3.93);
    const targetMat = new BABYLON.StandardMaterial("targetMat", scene);
    targetMat.diffuseColor = frameColor;
    targetMat.emissiveColor = frameColor.scale(0.3);
    targetSquare.material = targetMat;

    // Rim (torus) - closer to user than backboard
    hoopRim = BABYLON.MeshBuilder.CreateTorus("rim", {
        diameter: 0.46,
        thickness: 0.025,
        tessellation: 32
    }, scene);
    hoopRim.position = new BABYLON.Vector3(0, 2.6, -3.35);
    hoopRim.rotation.x = Math.PI / 2;

    const rimMat = new BABYLON.StandardMaterial("rimMat", scene);
    rimMat.diffuseColor = new BABYLON.Color3(1, 0.4, 0);
    rimMat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0);
    hoopRim.material = rimMat;

    // Rim connector to backboard
    const connector = BABYLON.MeshBuilder.CreateCylinder("connector", {
        height: 0.5,
        diameter: 0.03
    }, scene);
    connector.position = new BABYLON.Vector3(0, 2.6, -3.65);
    connector.rotation.x = Math.PI / 2;
    connector.material = rimMat;

    // Net (simplified with lines)
    const netSegments = 12;
    const netDepth = 0.4;
    const rimZ = -3.35;

    for (let i = 0; i < netSegments; i++) {
        const angle = (i / netSegments) * Math.PI * 2;
        const topX = Math.cos(angle) * 0.21;
        const topZ = Math.sin(angle) * 0.21;
        const bottomX = Math.cos(angle) * 0.1;
        const bottomZ = Math.sin(angle) * 0.1;

        const netLine = BABYLON.MeshBuilder.CreateLines("netLine" + i, {
            points: [
                new BABYLON.Vector3(topX, 0, topZ + rimZ),
                new BABYLON.Vector3(bottomX, -netDepth, bottomZ + rimZ)
            ]
        }, scene);
        netLine.position.y = 2.6;
        netLine.color = new BABYLON.Color3(1, 1, 1);
    }

    // Net rings
    for (let ring = 0; ring < 3; ring++) {
        const ringY = -ring * 0.13;
        const ringRadius = 0.21 - ring * 0.035;
        const ringPoints = [];

        for (let i = 0; i <= 32; i++) {
            const angle = (i / 32) * Math.PI * 2;
            ringPoints.push(new BABYLON.Vector3(
                Math.cos(angle) * ringRadius,
                ringY,
                Math.sin(angle) * ringRadius + rimZ
            ));
        }

        const netRing = BABYLON.MeshBuilder.CreateLines("netRing" + ring, {
            points: ringPoints
        }, scene);
        netRing.position.y = 2.6;
        netRing.color = new BABYLON.Color3(1, 1, 1);
    }

    // Pole (behind backboard)
    const pole = BABYLON.MeshBuilder.CreateCylinder("pole", {
        height: 4,
        diameter: 0.15
    }, scene);
    pole.position = new BABYLON.Vector3(0, 1.5, -4.3);

    const poleMat = new BABYLON.StandardMaterial("poleMat", scene);
    poleMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    pole.material = poleMat;

    // Add physics to backboard and rim
    new BABYLON.PhysicsAggregate(backboard, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);
    new BABYLON.PhysicsAggregate(hoopRim, BABYLON.PhysicsShapeType.MESH, { mass: 0, restitution: 0.5 }, scene);
    new BABYLON.PhysicsAggregate(pole, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, scene);

    // Invisible trigger zone for scoring (under the rim)
    hoopTrigger = BABYLON.MeshBuilder.CreateCylinder("hoopTrigger", {
        height: 0.3,
        diameter: 0.4
    }, scene);
    hoopTrigger.position = new BABYLON.Vector3(0, 2.45, rimZ);
    hoopTrigger.visibility = 0;
    hoopTrigger.isPickable = false;

    console.log("Basketball hoop created!");
};

// Check for scoring
const checkScore = (strokeMesh) => {
    if (!strokeMesh || !hoopTrigger) return;

    const strokePos = strokeMesh.getAbsolutePosition();
    const triggerPos = hoopTrigger.getAbsolutePosition();

    const horizontalDist = Math.sqrt(
        Math.pow(strokePos.x - triggerPos.x, 2) +
        Math.pow(strokePos.z - triggerPos.z, 2)
    );

    const verticalDist = Math.abs(strokePos.y - triggerPos.y);

    if (horizontalDist < 0.25 && verticalDist < 0.3 && strokePos.y < triggerPos.y) {
        // Check if this stroke already scored
        if (!strokeMesh._hasScored) {
            strokeMesh._hasScored = true;
            scoreCount++;
            showScoreEffect();
            updateTutorial(3); // Move to free play after scoring
            console.log("SCORE! Total:", scoreCount);
        }
    }
};

// Score celebration effect
const showScoreEffect = () => {
    const scoreText = document.getElementById('score-popup');
    if (scoreText) {
        scoreText.textContent = scoreCount === 1 ? "SCORE!" : `${scoreCount} POINTS!`;
        scoreText.classList.add('show');
        setTimeout(() => scoreText.classList.remove('show'), 1500);
    }

    // Flash the rim
    if (hoopRim && hoopRim.material) {
        const originalColor = hoopRim.material.emissiveColor.clone();
        hoopRim.material.emissiveColor = new BABYLON.Color3(0, 1, 0);
        setTimeout(() => {
            hoopRim.material.emissiveColor = originalColor;
        }, 300);
    }
};

// Tutorial system
const updateTutorial = (step) => {
    if (step <= tutorialStep) return;
    tutorialStep = step;

    const tutorialText = document.getElementById('tutorial-text');
    const tutorialHint = document.getElementById('tutorial-hint');

    if (!tutorialText) return;

    switch(step) {
        case 1:
            tutorialText.textContent = "Great! Now switch to Grab mode";
            tutorialHint.textContent = "Click 'Grab' button or press G";
            break;
        case 2:
            tutorialText.textContent = "Grab your ball and throw it!";
            tutorialHint.textContent = "Click & drag to throw toward the hoop";
            break;
        case 3:
            tutorialText.textContent = "Amazing! You're a natural!";
            tutorialHint.textContent = "Keep playing or explore other colors";
            setTimeout(() => {
                document.getElementById('tutorial-overlay')?.classList.add('minimized');
            }, 2000);
            break;
    }
};

// Create the scene
const createScene = async function() {
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.1, 1);

    // Enable Havok Physics
    const hk = await HavokPhysics();
    physicsPlugin = new BABYLON.HavokPlugin(true, hk);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), physicsPlugin);
    console.log("Havok Physics Enabled!");

    // Arc Rotate Camera - positioned for basketball view (looking at hoop area)
    camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI,        // Looking from positive z toward negative z (toward the hoop)
        Math.PI / 3,
        6,
        new BABYLON.Vector3(0, 2.5, -3),  // Target near the hoop
        scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 15;
    camera.wheelPrecision = 50;
    camera.pinchPrecision = 50;

    // Lighting
    const hemisphericLight = new BABYLON.HemisphericLight(
        "hemisphericLight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    hemisphericLight.intensity = 0.6;

    const directionalLight = new BABYLON.DirectionalLight(
        "directionalLight",
        new BABYLON.Vector3(-1, -2, -1),
        scene
    );
    directionalLight.intensity = 0.5;

    // Spotlight on hoop
    const spotLight = new BABYLON.SpotLight(
        "spotLight",
        new BABYLON.Vector3(0, 5, -2),
        new BABYLON.Vector3(0, -1, -0.5),
        Math.PI / 3,
        2,
        scene
    );
    spotLight.intensity = 0.8;

    // Ground - basketball court style
    ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 15, height: 15 }, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.6, 0.4, 0.2);
    groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    ground.material = groundMat;

    // Court lines
    const courtLine = BABYLON.MeshBuilder.CreateGround("courtLine", { width: 12, height: 12 }, scene);
    courtLine.position.y = 0.01;
    const courtLineMat = new BABYLON.GridMaterial("courtLineMat", scene);
    courtLineMat.majorUnitFrequency = 6;
    courtLineMat.minorUnitVisibility = 0;
    courtLineMat.gridRatio = 1;
    courtLineMat.mainColor = new BABYLON.Color3(0.6, 0.4, 0.2);
    courtLineMat.lineColor = new BABYLON.Color3(1, 1, 1);
    courtLineMat.opacity = 0.5;
    courtLine.material = courtLineMat;

    // Ground physics
    new BABYLON.PhysicsAggregate(
        ground,
        BABYLON.PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.6, friction: 0.8 },
        scene
    );

    // Create basketball hoop
    createBasketballHoop();

    // Drawing plane
    const drawingPlane = BABYLON.MeshBuilder.CreatePlane("drawingPlane", { size: 20 }, scene);
    drawingPlane.rotation.x = Math.PI / 2;
    drawingPlane.position.y = 2;
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

    // Score checking loop
    scene.onBeforeRenderObservable.add(() => {
        strokes.forEach(stroke => {
            if (stroke.mesh && stroke.mesh._physicsAggregate && stroke.mesh._physicsAggregate.body) {
                const mass = stroke.mesh._physicsAggregate.body.getMassProperties?.()?.mass;
                if (mass > 0) {
                    checkScore(stroke.mesh);
                }
            }
        });
    });

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
        { mass, restitution: 0.6, friction: 0.3 },
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
            addStrokePhysics(currentStroke.mesh, 0);
        }

        strokes.push(currentStroke);

        // Update tutorial after first drawing
        if (tutorialStep === 0 && strokes.length >= 1) {
            updateTutorial(1);
        }
    } else if (currentStroke && currentStroke.mesh) {
        currentStroke.mesh.dispose();
    }

    currentStroke = null;
};

// Undo
const undo = () => {
    if (strokes.length === 0) return;

    const lastStroke = strokes.pop();
    if (lastStroke.mesh) {
        if (lastStroke.mesh._physicsAggregate) {
            lastStroke.mesh._physicsAggregate.dispose();
        }
        lastStroke.mesh.dispose();
    }
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
    scoreCount = 0;
};

// Grab functionality
let grabDistance = 0;
let velocityHistory = [];
const VELOCITY_HISTORY_SIZE = 8;

const tryGrabStroke = (pickResult) => {
    if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.name.startsWith("stroke")) {
        grabbedStroke = pickResult.pickedMesh;

        // Store distance from camera to stroke for consistent depth
        const strokePos = grabbedStroke.getAbsolutePosition();
        grabDistance = BABYLON.Vector3.Distance(camera.position, strokePos);
        velocityHistory = [];

        // Remove physics while grabbing
        if (grabbedStroke._physicsAggregate) {
            grabbedStroke._physicsAggregate.dispose();
            grabbedStroke._physicsAggregate = null;
        }

        // Update tutorial
        if (tutorialStep === 1) {
            updateTutorial(2);
        }

        console.log("Grabbed stroke, distance:", grabDistance);
        return true;
    }
    return false;
};

const moveGrabbedStroke = (newPosition) => {
    if (!grabbedStroke || !newPosition) return;

    const oldPosition = grabbedStroke.getAbsolutePosition();

    // Track velocity for throwing
    const delta = newPosition.subtract(oldPosition);
    velocityHistory.push({
        delta: delta.clone(),
        time: performance.now()
    });

    // Keep only recent samples
    while (velocityHistory.length > VELOCITY_HISTORY_SIZE) {
        velocityHistory.shift();
    }

    // Move the stroke
    grabbedStroke.position = newPosition;
};

const calculateThrowVelocity = () => {
    if (velocityHistory.length < 2) {
        return new BABYLON.Vector3(0, 0, 0);
    }

    // Use only the last few frames for velocity
    const recentFrames = velocityHistory.slice(-4);
    let totalDelta = new BABYLON.Vector3(0, 0, 0);

    for (const frame of recentFrames) {
        totalDelta.addInPlace(frame.delta);
    }

    // Scale for satisfying throw (adjust multiplier as needed)
    return totalDelta.scale(50);
};

const releaseStroke = () => {
    if (!grabbedStroke) return;

    const throwVelocity = calculateThrowVelocity();

    if (physicsOnDrop) {
        const aggregate = addStrokePhysics(grabbedStroke, 0.3);

        // Apply throw velocity if significant
        if (aggregate.body && throwVelocity.length() > 1) {
            aggregate.body.setLinearVelocity(throwVelocity);
            console.log("Throw velocity:", throwVelocity.length().toFixed(2));
        }
    } else {
        addStrokePhysics(grabbedStroke, 0);
    }

    grabbedStroke = null;
    grabDistance = 0;
    velocityHistory = [];
};

// Input handling
const setupInputHandling = (drawingPlane, cursorIndicator) => {
    let pointerDown = false;
    let grabPlane = null; // Dynamic plane for grabbing

    const get3DPosition = (evt) => {
        const pickResult = scene.pick(evt.clientX, evt.clientY, (mesh) => mesh === drawingPlane);
        if (pickResult.hit) {
            return pickResult.pickedPoint;
        }
        return null;
    };

    // Get position on a plane facing the camera at the grab distance
    const getGrabPosition = (evt) => {
        if (!grabbedStroke || grabDistance <= 0) return null;

        // Create a ray from camera through screen point
        const ray = scene.createPickingRay(evt.clientX, evt.clientY, BABYLON.Matrix.Identity(), camera);

        // Project ray to the stored grab distance
        const newPos = camera.position.add(ray.direction.scale(grabDistance));
        return newPos;
    };

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
    });

    canvas.addEventListener('pointermove', (evt) => {
        if (currentMode === 'draw') {
            const pos = get3DPosition(evt);
            updateCursor(pos, getCurrentColor());
            if (isDrawing && pos) {
                addPoint(pos);
            }
        } else if (currentMode === 'grab') {
            if (grabbedStroke) {
                const grabPos = getGrabPosition(evt);
                if (grabPos) {
                    moveGrabbedStroke(grabPos);
                    updateCursor(grabbedStroke.getAbsolutePosition(), new BABYLON.Color3(1, 0.5, 0));
                }
            } else {
                // Show cursor when hovering over strokes
                const pickResult = scene.pick(evt.clientX, evt.clientY, (mesh) => mesh.name.startsWith("stroke"));
                if (pickResult.hit) {
                    updateCursor(pickResult.pickedPoint, new BABYLON.Color3(1, 0.5, 0));
                } else {
                    updateCursor(null, new BABYLON.Color3(1, 0.5, 0));
                }
            }
        } else {
            updateCursor(null, getCurrentColor());
        }
    });

    canvas.addEventListener('pointerup', () => {
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
        if (isDrawing) stopDrawing();
        if (grabbedStroke) releaseStroke();
        pointerDown = false;
    });

    canvas.addEventListener('contextmenu', (evt) => evt.preventDefault());

    // Touch handling
    let touchCount = 0;
    canvas.addEventListener('touchstart', (evt) => {
        touchCount = evt.touches.length;
        if (touchCount > 1) {
            if (isDrawing) stopDrawing();
            camera.attachControl(canvas, true);
        }
    });
    canvas.addEventListener('touchend', () => { touchCount = 0; });

    // Keyboard
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

// Set mode
const setMode = (mode) => {
    currentMode = mode;

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.mode === mode);
    });

    if (isDrawing) stopDrawing();
    if (grabbedStroke) releaseStroke();

    if (mode === 'orbit' && camera) {
        camera.attachControl(canvas, true);
    }
};

// Set color
const setColor = (index) => {
    currentColorIndex = index;

    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.color) === index);
    });
};

// Set brush size
const setBrushSize = (size) => {
    lineWidth = size;
    document.getElementById('size-value').textContent = size.toFixed(3);
};

// Initialize UI
const initUI = () => {
    const instructionsOverlay = document.getElementById('instructions');
    const startBtn = document.getElementById('start-btn');

    startBtn.addEventListener('click', () => {
        instructionsOverlay.style.display = 'none';
        document.getElementById('tutorial-overlay').classList.add('visible');
    });

    // Color palette
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setColor(parseInt(btn.dataset.color));
        });
    });

    // Brush size
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

    document.getElementById('loading-screen').style.display = 'none';
};

// Main init
const init = async () => {
    try {
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
        console.log("3D ART PLAYGROUND - BASKETBALL");
        console.log("=================================");

    } catch (error) {
        console.error("Initialization error:", error);
        document.getElementById('loading-screen').innerHTML = `
            <p style="color: red;">Error loading: ${error.message}</p>
            <p>Please refresh the page.</p>
        `;
    }
};

init();
