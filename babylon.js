export const createScene = async function (engine, canvas) {
    const scene = new BABYLON.Scene(engine);

    // Jason update: Enable Physics
    const hk = await HavokPhysics();
    const physicsPlugin = new BABYLON.HavokPlugin(true, hk);
    scene.enablePhysics(new BABYLON.Vector3(0, -3, 0), physicsPlugin);
    console.log("Havok Physics Enabled!");

    
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1.6, -3), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 10, height: 10}, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.alpha = 0;
    ground.material = groundMat;
    ground.isVisible = false;

    // Jason update: make ground collide with thrown strokes
    const groundAggregate = new BABYLON.PhysicsAggregate(
        ground,
        BABYLON.PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.2, friction: 0.8 },
        scene
    );
    
    // === 2D GUI Menu on a Plane ===
    const menuPlane = BABYLON.MeshBuilder.CreatePlane("menuPlane", {
        width: 2,
        height: 1.5
    }, scene);
    menuPlane.position = new BABYLON.Vector3(0, 1.6, 2);
    
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(menuPlane, 1024, 768);
    
    const mainContainer = new BABYLON.GUI.Rectangle();
    mainContainer.width = "100%";
    mainContainer.height = "100%";
    mainContainer.background = "#1a1a1aee";
    mainContainer.thickness = 4;
    mainContainer.color = "#444";
    mainContainer.cornerRadius = 20;
    advancedTexture.addControl(mainContainer);
    
    const stackPanel = new BABYLON.GUI.StackPanel();
    stackPanel.width = "90%";
    stackPanel.height = "90%";
    stackPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    mainContainer.addControl(stackPanel);
    
    const title = new BABYLON.GUI.TextBlock();
    title.text = "3D Art Playground";
    title.color = "white";
    title.fontSize = 60;
    title.fontWeight = "bold";
    title.height = "120px";
    title.paddingBottom = "40px";
    stackPanel.addControl(title);
    
    let selectedMode = "smash"; // Default to smash mode (with physics)
    
    const startButtonContainer = new BABYLON.GUI.Rectangle();
    startButtonContainer.width = "60%";
    startButtonContainer.height = "120px";
    startButtonContainer.thickness = 4;
    startButtonContainer.cornerRadius = 15;
    startButtonContainer.color = "#4a9aff";
    startButtonContainer.background = "#1a5a9a";
    stackPanel.addControl(startButtonContainer);
    
    const startButtonText = new BABYLON.GUI.TextBlock();
    startButtonText.text = "Start";
    startButtonText.color = "white";
    startButtonText.fontSize = 48;
    startButtonText.fontWeight = "bold";
    startButtonContainer.addControl(startButtonText);
    
    startButtonContainer.onPointerEnterObservable.add(() => {
        startButtonContainer.background = "#2a6aaa";
    });
    
    startButtonContainer.onPointerOutObservable.add(() => {
        startButtonContainer.background = "#1a5a9a";
    });
    
    let hasStarted = false;
    
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
    
    const setColor = (index) => {
        currentColorIndex = index;
        console.log("🎨 Color: " + colorPalette[currentColorIndex].name);
        updateTipIndicator();
    };
    
    let currentStroke = null;
    let strokes = [];
    let isDrawing = false;
    let lineWidth = 0.05;
    const maxStrokes = 100;
    const smoothingDistance = 0.005;
    
    const createStrokeMesh = (points, color, width) => {
        if (points.length < 2) return null;
        
        const tube = BABYLON.MeshBuilder.CreateTube("stroke", {
            path: points,
            radius: width,
            tessellation: 6,
            cap: BABYLON.Mesh.CAP_ALL,
            updatable: true
        }, scene);
        
        const material = new BABYLON.StandardMaterial("strokeMat", scene);
        material.diffuseColor = color;
        material.emissiveColor = color.scale(0.5);
        material.specularColor = new BABYLON.Color3(0, 0, 0);
        tube.material = material;
        
        return tube;
    };
    
    const startDrawing = () => {
        if (isDrawing || !hasStarted) return;

        isDrawing = true;
        currentStroke = {
            points: [],
            color: getCurrentColor().clone(),
            width: lineWidth,
            mesh: null
        };

        console.log("✏️ startDrawing with color:", colorPalette[currentColorIndex].name);
    };
    
    const addPoint = (position) => {
        if (!isDrawing || !currentStroke) return;
        
        const points = currentStroke.points;
        
        if (points.length === 0) {
            points.push(position.clone());
            return;
        }
        
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
            // Add physics but make it STATIC (mass=0) so it stays in place without gravity
            if (currentStroke.mesh) {
                addStrokePhysics(currentStroke.mesh, 0); // mass=0 means static
                console.log("⚛️ Static physics added to stroke");
            }
            
            strokes.push(currentStroke);
            console.log("💾 Saved. Total: " + strokes.length);
            
            if (strokes.length > maxStrokes) {
                const oldStroke = strokes.shift();
                if (oldStroke.mesh) {
                    // Dispose physics first
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
    
    const undo = () => {
        if (strokes.length === 0) return;
        
        const lastStroke = strokes.pop();
        if (lastStroke.mesh) {
            // Dispose physics first
            if (lastStroke.mesh._physicsAggregate) {
                lastStroke.mesh._physicsAggregate.dispose();
            }
            lastStroke.mesh.dispose();
        }
        
        console.log("↩️ Undo: " + strokes.length);
    };
    
    const clearAll = () => {
        strokes.forEach(stroke => {
            if (stroke.mesh) {
                // Dispose physics first
                if (stroke.mesh._physicsAggregate) {
                    stroke.mesh._physicsAggregate.dispose();
                }
                stroke.mesh.dispose();
            }
        });
        
        strokes = [];
        console.log("🗑️ Cleared");
    };
    
    const increaseBrushSize = () => {
        lineWidth = Math.min(lineWidth + 0.005, 0.05);
        console.log("📏 Size: " + lineWidth.toFixed(3));
        updateTipIndicator();
    };
    
    const decreaseBrushSize = () => {
        lineWidth = Math.max(lineWidth - 0.005, 0.002);
        console.log("📏 Size: " + lineWidth.toFixed(3));
        updateTipIndicator();
    };
    
    let rightController = null;
    let leftController = null;
    let tipIndicator = null;
    let colorPanel = null;
    let colorMenuPlane = null;
    let lastLeftThumbstickTime = 0;
    const thumbstickDebounce = 200;
    let drawingObserver = null;
    let leftThumbstickX = 0;
    let leftThumbstickY = 0;

    let grabbedStroke = null;
    let grabbedOriginalParent = null;
    let lastRightPos = null;
    let rightLinearVelocity = new BABYLON.Vector3(0, 0, 0);
    
    const createTipIndicator = (parentMesh) => {
        tipIndicator = BABYLON.MeshBuilder.CreateSphere("tip", {diameter: 0.02}, scene);
        tipIndicator.parent = parentMesh;
        tipIndicator.position = new BABYLON.Vector3(0, 0, 0.1);
        
        const tipMat = new BABYLON.StandardMaterial("tipMat", scene);
        tipMat.diffuseColor = getCurrentColor();
        tipMat.emissiveColor = getCurrentColor();
        tipMat.specularColor = new BABYLON.Color3(0, 0, 0);
        tipIndicator.material = tipMat;
    };
    
    const updateTipIndicator = () => {
        if (!tipIndicator) return;
        
        const color = getCurrentColor();
        tipIndicator.material.diffuseColor = color;
        tipIndicator.material.emissiveColor = color;
        
        const size = lineWidth * 2;
        tipIndicator.scaling = new BABYLON.Vector3(size, size, size);
    };

    const pickStrokeInFrontOfController = () => {
        if (!rightController || !rightController.rootMesh) return null;

        const controllerMesh = rightController.rootMesh;
        const origin = controllerMesh.getAbsolutePosition();
        const forward = controllerMesh.forward;

        const ray = new BABYLON.Ray(origin, forward, 3.0);

        const hit = scene.pickWithRay(ray, (mesh) => mesh && mesh.name.startsWith("stroke"));
        if (hit && hit.pickedMesh) {
            return hit.pickedMesh;
        }
        return null;
    };
    
    const startDrawingLoop = () => {
        if (drawingObserver) {
            return;
        }

        drawingObserver = scene.onBeforeRenderObservable.add(() => {
            if (!isDrawing || !currentStroke) return;
            if (!rightController || !rightController.rootMesh) return;

            const controllerMesh = rightController.rootMesh;
            const controllerPos = controllerMesh.absolutePosition;
            const controllerForward = controllerMesh.forward;
            const drawDistance = 0.05;

            const drawPoint = controllerPos.add(controllerForward.scale(drawDistance));
            addPoint(drawPoint);
        });

        console.log("🌀 Drawing loop started");
    };
    
    const stopDrawingLoop = () => {
        if (drawingObserver) {
            scene.onBeforeRenderObservable.remove(drawingObserver);
            drawingObserver = null;
            console.log("🌀 Drawing loop stopped");
        }
    };
    
    scene.onBeforeRenderObservable.add(() => {
        const DEADZONE = 0.15;

        if (rightController && rightController.rootMesh) {
            const dt = scene.getEngine().getDeltaTime() / 1000;
            const currentPos = rightController.rootMesh.getAbsolutePosition();

            if (lastRightPos && dt > 0) {
                rightLinearVelocity = currentPos.subtract(lastRightPos).scale(1 / dt);
            }

            lastRightPos = currentPos.clone();
        }

        if (Math.abs(leftThumbstickY) > DEADZONE || Math.abs(leftThumbstickX) > DEADZONE) {
            const moveSpeed = 0.05;
            const activeCamera = scene.activeCamera;
            
            if (Math.abs(leftThumbstickY) > DEADZONE) {
                const forward = activeCamera.getDirection(BABYLON.Axis.Z);
                forward.y = 0;
                forward.normalize();
                activeCamera.position.addInPlace(forward.scale(-leftThumbstickY * moveSpeed));
            }
            
            if (Math.abs(leftThumbstickX) > DEADZONE) {
                const forward = activeCamera.getDirection(BABYLON.Axis.Z);
                const right = BABYLON.Vector3.Cross(BABYLON.Axis.Y, forward);
                right.normalize();
                activeCamera.position.addInPlace(right.scale(leftThumbstickX * moveSpeed));
            }
        }
    });
    
    const handleLeftThumbstick = (x, y) => {
        const now = Date.now();
        
        leftThumbstickX = x;
        leftThumbstickY = y;
        
        if (now - lastLeftThumbstickTime < thumbstickDebounce) {
            return;
        }
        
        const threshold = 0.9;
        
        if (Math.abs(y) > threshold) {
            if (y > 0) {
                increaseBrushSize();
            } else {
                decreaseBrushSize();
            }
            lastLeftThumbstickTime = now;
        }
    };

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
    
    const setupGrabAndThrow = (motionController) => {
        const squeeze = motionController.getComponent("xr-standard-squeeze");
        if (!squeeze) {
            console.warn("No xr-standard-squeeze component found on right controller.");
            return;
        }

        squeeze.onButtonStateChangedObservable.add((component) => {
            if (selectedMode !== "smash") return;

            if (component.pressed && !grabbedStroke) {
                const mesh = pickStrokeInFrontOfController();
                if (mesh) {
                    grabbedStroke = mesh;
                    grabbedOriginalParent = mesh.parent;

                    if (mesh._physicsAggregate) {
                        mesh._physicsAggregate.dispose();
                        mesh._physicsAggregate = null;
                    }

                    mesh.setParent(motionController.rootMesh);
                    console.log("🤚 Grabbed stroke:", mesh.name);
                }
            }
            else if (!component.pressed && grabbedStroke) {
                const mesh = grabbedStroke;

                mesh.setParent(grabbedOriginalParent || null);

                // Give it DYNAMIC physics (mass > 0) so it becomes affected by gravity
                const aggregate = addStrokePhysics(mesh, 0.15); // mass=0.15 means dynamic

                const throwVelocity = rightLinearVelocity.scale(2.5);
                aggregate.body.setLinearVelocity(throwVelocity);

                console.log("🏹 Thrown stroke with velocity:", throwVelocity.toString());

                grabbedStroke = null;
                grabbedOriginalParent = null;
            }
        });
    };

    const setupRightController = (motionController) => {
        rightController = motionController;
        const componentIds = motionController.getComponentIds();
        
        createTipIndicator(motionController.rootMesh);
        
        const trigger = motionController.getComponent(componentIds[0]);
        if (trigger) {
            trigger.onButtonStateChangedObservable.add((component) => {
                if (component.pressed) {
                    startDrawing();
                    startDrawingLoop();
                } else {
                    stopDrawing();
                    stopDrawingLoop();
                }
            });
        }

        setupGrabAndThrow(motionController);
        
        const aButton = motionController.getComponent("a-button");
        if (aButton) {
            aButton.onButtonStateChangedObservable.add((component) => {
                if (component.pressed) {
                    undo();
                }
            });
        }
        
        const bButton = motionController.getComponent("b-button");
        if (bButton) {
            bButton.onButtonStateChangedObservable.add((component) => {
                if (component.pressed) {
                    if (colorPanel && colorMenuPlane) {
                        const newVisibility = !colorPanel.isVisible;
                        colorPanel.isVisible = newVisibility;
                        colorMenuPlane.isVisible = newVisibility;
                        console.log("🎨 Menu toggled:", newVisibility);
                    }
                }
            });
        }
        
        console.log("✅ Right controller");
    };
    
    const setupLeftController = (motionController) => {
        leftController = motionController;
        
        const thumbstick = motionController.getComponent("xr-standard-thumbstick");
        if (thumbstick) {
            thumbstick.onAxisValueChangedObservable.add((axes) => {
                handleLeftThumbstick(axes.x, axes.y);
            });
        }
        
        console.log("✅ Left controller");
    };
    
    const visualizePlane = (plane) => {
        const polygon = plane.polygonDefinition;
        
        if (polygon.length < 3) return;
        
        const points = polygon.map(p => new BABYLON.Vector3(p.x, p.y, -p.z));
        points.push(points[0]);
        
        const lines = BABYLON.MeshBuilder.CreateLines("planeBorder" + plane.id, {
            points: points,
            updatable: true
        }, scene);
        
        lines.color = new BABYLON.Color3(0, 1, 0);
        lines.alpha = 0.7;
        
        console.log("✅ Plane visualized: " + plane.id);
    };
    
    const xrHelper = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: 'immersive-ar'
        },
        optionalFeatures: true
    });
    
    console.log("🚀 AR Mode");
    
    const fm = xrHelper.baseExperience.featuresManager;
    
    fm.enableFeature(BABYLON.WebXRBackgroundRemover.Name);
    console.log("✅ Passthrough enabled");
    
    const planeDetector = fm.enableFeature(
        BABYLON.WebXRPlaneDetector.Name, 
        'latest'
    );
    
    planeDetector.onPlaneAddedObservable.add((plane) => {
        console.log("🔲 Plane detected: " + plane.id);
        visualizePlane(plane);
    });
    
    xrHelper.input.onControllerAddedObservable.add((inputSource) => {
        inputSource.onMotionControllerInitObservable.add((motionController) => {
            console.log("🎮 " + motionController.handness);
            
            if (motionController.handness === 'right') {
                setupRightController(motionController);
            } else if (motionController.handness === 'left') {
                setupLeftController(motionController);
            }
        });
    });
    
    startButtonContainer.onPointerClickObservable.add(() => {
        hasStarted = true;
        
        menuPlane.dispose();
        
        // Create color menu plane in the same spot as the start menu
        colorMenuPlane = BABYLON.MeshBuilder.CreatePlane("colorMenuPlane", {
            width: 2,
            height: 1.5
        }, scene);
        colorMenuPlane.position = new BABYLON.Vector3(-0.5, 1.6, 2);
        colorMenuPlane.isVisible = false;

        const hudTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(colorMenuPlane, 1024, 1536);
        
        const colorMenuContainer = new BABYLON.GUI.Rectangle();
        colorMenuContainer.width = "100%";
        colorMenuContainer.height = "100%";
        colorMenuContainer.thickness = 0;
        hudTexture.addControl(colorMenuContainer);
        
        const menuButton = new BABYLON.GUI.Rectangle();
        menuButton.width = "60px";
        menuButton.height = "60px";
        menuButton.cornerRadius = 10;
        menuButton.color = "white";
        menuButton.thickness = 3;
        menuButton.background = "#2a2a2aee";
        menuButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        menuButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        colorMenuContainer.addControl(menuButton);
        
        const line1 = new BABYLON.GUI.Rectangle();
        line1.width = "40px";
        line1.height = "4px";
        line1.background = "white";
        line1.top = "-15px";
        menuButton.addControl(line1);
        
        const line2 = new BABYLON.GUI.Rectangle();
        line2.width = "40px";
        line2.height = "4px";
        line2.background = "white";
        menuButton.addControl(line2);
        
        const line3 = new BABYLON.GUI.Rectangle();
        line3.width = "40px";
        line3.height = "4px";
        line3.background = "white";
        line3.top = "15px";
        menuButton.addControl(line3);
        
        colorPanel = new BABYLON.GUI.Rectangle();
        colorPanel.width = "380px";
        colorPanel.height = "730px";
        colorPanel.cornerRadius = 15;
        colorPanel.color = "white";
        colorPanel.thickness = 3;
        colorPanel.background = "#1a1a1aee";
        colorPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        colorPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        colorPanel.isVisible = false;
        colorMenuContainer.addControl(colorPanel);
        
        const colorStack = new BABYLON.GUI.StackPanel();
        colorStack.width = "90%";
        colorStack.paddingTop = "20px";
        colorPanel.addControl(colorStack);
        
        const colorTitle = new BABYLON.GUI.TextBlock();
        colorTitle.text = "Change Color";
        colorTitle.color = "#4a9aff";
        colorTitle.fontSize = 32;
        colorTitle.fontWeight = "bold";
        colorTitle.height = "50px";
        colorTitle.paddingBottom = "20px";
        colorStack.addControl(colorTitle);
        
        const colorGrid = new BABYLON.GUI.StackPanel();
        colorGrid.height = "380px";
        colorGrid.paddingBottom = "20px";
        colorStack.addControl(colorGrid);
        
        const colorButtons = [];
        
        const colorsPerRow = 3;
        const rows = Math.ceil(colorPalette.length / colorsPerRow);
        
        for (let row = 0; row < rows; row++) {
            const rowPanel = new BABYLON.GUI.StackPanel();
            rowPanel.isVertical = false;
            rowPanel.height = "110px";
            rowPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
            colorGrid.addControl(rowPanel);
            
            for (let col = 0; col < colorsPerRow; col++) {
                const colorIndex = row * colorsPerRow + col;
                if (colorIndex >= colorPalette.length) break;
                
                const colorItem = colorPalette[colorIndex];
                
                const colorButton = new BABYLON.GUI.Rectangle();
                colorButton.width = "90px";
                colorButton.height = "90px";
                colorButton.cornerRadius = 10;
                colorButton.thickness = 3;
                colorButton.color = colorIndex === currentColorIndex ? "#4a9aff" : "#555";
                
                const r = Math.floor(colorItem.color.r * 255);
                const g = Math.floor(colorItem.color.g * 255);
                const b = Math.floor(colorItem.color.b * 255);
                colorButton.background = `rgb(${r},${g},${b})`;
                
                colorButtons.push({ button: colorButton, index: colorIndex });
                
                colorButton.onPointerEnterObservable.add(() => {
                    if (currentColorIndex !== colorIndex) {
                        colorButton.thickness = 4;
                    }
                });
                
                colorButton.onPointerOutObservable.add(() => {
                    if (currentColorIndex !== colorIndex) {
                        colorButton.thickness = 3;
                    }
                });
                
                colorButton.onPointerClickObservable.add(() => {
                    setColor(colorIndex);
                    
                    colorButtons.forEach(({ button, index }) => {
                        button.color = index === colorIndex ? "#4a9aff" : "#555";
                        button.thickness = index === colorIndex ? 4 : 3;
                    });
                });
                
                rowPanel.addControl(colorButton);
                
                if (col < colorsPerRow - 1 && colorIndex < colorPalette.length - 1) {
                    const spacer = new BABYLON.GUI.Container();
                    spacer.width = "15px";
                    rowPanel.addControl(spacer);
                }
            }
        }
        
        const thicknessSection = new BABYLON.GUI.Container();
        thicknessSection.height = "100px";
        thicknessSection.paddingTop = "20px";
        thicknessSection.paddingBottom = "20px";
        colorStack.addControl(thicknessSection);
        
        const thicknessLabel = new BABYLON.GUI.TextBlock();
        thicknessLabel.text = "Brush Thickness";
        thicknessLabel.color = "white";
        thicknessLabel.fontSize = 24;
        thicknessLabel.height = "30px";
        thicknessLabel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        thicknessSection.addControl(thicknessLabel);
        
        const thicknessSlider = new BABYLON.GUI.Slider();
        thicknessSlider.minimum = 0.005;
        thicknessSlider.maximum = 0.1;
        thicknessSlider.value = lineWidth;
        thicknessSlider.height = "20px";
        thicknessSlider.width = "300px";
        thicknessSlider.color = "#4a9aff";
        thicknessSlider.background = "#555";
        thicknessSlider.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        thicknessSection.addControl(thicknessSlider);
        
        const thicknessValue = new BABYLON.GUI.TextBlock();
        thicknessValue.text = lineWidth.toFixed(3);
        thicknessValue.color = "#aaaaaa";
        thicknessValue.fontSize = 20;
        thicknessValue.height = "25px";
        thicknessValue.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        thicknessSection.addControl(thicknessValue);
        
        thicknessSlider.onValueChangedObservable.add((value) => {
            lineWidth = value;
            thicknessValue.text = value.toFixed(3);
            updateTipIndicator();
            console.log("📏 Thickness: " + value.toFixed(3));
        });
        
        const exitButton = new BABYLON.GUI.Rectangle();
        exitButton.width = "200px";
        exitButton.height = "60px";
        exitButton.cornerRadius = 10;
        exitButton.color = "white";
        exitButton.thickness = 3;
        exitButton.background = "#2a2a2a";
        colorStack.addControl(exitButton);
        
        const exitText = new BABYLON.GUI.TextBlock();
        exitText.text = "Exit Menu";
        exitText.color = "white";
        exitText.fontSize = 28;
        exitText.fontWeight = "bold";
        exitButton.addControl(exitText);
        
        exitButton.onPointerEnterObservable.add(() => {
            exitButton.background = "#3a3a3a";
        });
        
        exitButton.onPointerOutObservable.add(() => {
            exitButton.background = "#2a2a2a";
        });
        
        exitButton.onPointerClickObservable.add(() => {
            colorPanel.isVisible = false;
            colorMenuPlane.isVisible = false;
        });
        
        // Clear All button
        const clearButton = new BABYLON.GUI.Rectangle();
        clearButton.width = "200px";
        clearButton.height = "60px";
        clearButton.cornerRadius = 10;
        clearButton.color = "#ff6b6b";
        clearButton.thickness = 3;
        clearButton.background = "#2a2a2a";
        clearButton.top = "10px";
        colorStack.addControl(clearButton);
        
        const clearText = new BABYLON.GUI.TextBlock();
        clearText.text = "Clear All";
        clearText.color = "white";
        clearText.fontSize = 28;
        clearText.fontWeight = "bold";
        clearButton.addControl(clearText);
        
        clearButton.onPointerEnterObservable.add(() => {
            clearButton.background = "#3a3a3a";
        });
        
        clearButton.onPointerOutObservable.add(() => {
            clearButton.background = "#2a2a2a";
        });
        
        clearButton.onPointerClickObservable.add(() => {
            clearAll();
        });
        
        const mainMenuButton = new BABYLON.GUI.Rectangle();
        mainMenuButton.width = "250px";
        mainMenuButton.height = "60px";
        mainMenuButton.cornerRadius = 10;
        mainMenuButton.color = "#ff6b6b";
        mainMenuButton.thickness = 3;
        mainMenuButton.background = "#2a2a2a";
        mainMenuButton.top = "10px";
        colorStack.addControl(mainMenuButton);
        
        const mainMenuText = new BABYLON.GUI.TextBlock();
        mainMenuText.text = "Back to Main Menu";
        mainMenuText.color = "white";
        mainMenuText.fontSize = 24;
        mainMenuText.fontWeight = "bold";
        mainMenuButton.addControl(mainMenuText);
        
        mainMenuButton.onPointerEnterObservable.add(() => {
            mainMenuButton.background = "#3a3a3a";
        });
        
        mainMenuButton.onPointerOutObservable.add(() => {
            mainMenuButton.background = "#2a2a2a";
        });
        
        mainMenuButton.onPointerClickObservable.add(() => {
            window.location.reload();
        });
        
        let menuOpen = false;
        menuButton.onPointerClickObservable.add(() => {
            menuOpen = !menuOpen;
            colorPanel.isVisible = menuOpen;
            colorMenuPlane.isVisible = menuOpen;
        });
        
        menuButton.onPointerEnterObservable.add(() => {
            menuButton.background = "#3a3a3aee";
        });
        
        menuButton.onPointerOutObservable.add(() => {
            menuButton.background = "#2a2a2aee";
        });
        
        console.log("=================================");
        console.log("3D ART PLAYGROUND - STARTED");
        console.log("=================================");
        console.log("RIGHT TRIGGER - Draw");
        console.log("RIGHT GRIP - Grab & Throw");
        console.log("RIGHT B - Toggle Menu");
        console.log("LEFT THUMBSTICK - Move");
        console.log("LEFT THUMBSTICK (far) - Brush size");
        console.log("RIGHT A - Undo");
        console.log("=================================");
        console.log("🎨 Default color: White");
        console.log("AR MODE: See real world");
        console.log("Green lines = detected surfaces");
        console.log("=================================");
    });
    
    console.log("=================================");
    console.log("3D ART PLAYGROUND");
    console.log("=================================");
    console.log("Click START to begin!");
    console.log("=================================");
    
    return scene;
};