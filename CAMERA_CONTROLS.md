# Camera & Model Location Guide

## ✅ What's Been Fixed

### Camera Setup
- **Position**: `(0, ~420, ~2450)` - positioned above and in front of the model
- **Target**: `(0, 0, 0)` - always looking at the model center
- **Far plane**: Extended to 10000 units (to see your large model)
- **FOV**: 75 degrees

### Model Information
- **Size**: ~1400 units (very large!)
- **Position**: Centered at origin `(0, 0, 0)`
- **Scale**: 4x in all axes
- **Initial rotation**: `(0, 0.5, 0)`

### Visual Helpers Added
- **Axes Helper**: Red (X), Green (Y), Blue (Z) - 500 units each
- **Grid Helper**: 2000x2000 ground plane with 20 divisions
- **OrbitControls**: Interactive camera navigation

## 🎮 How to Navigate

### OrbitControls (Mouse)
- **Left Click + Drag**: Rotate camera around model
- **Right Click + Drag**: Pan camera
- **Scroll Wheel**: Zoom in/out
- **Double Click**: Reset to default view (if enabled)

### Keyboard Shortcuts (in browser console)
```javascript
// Quick camera positions
camera.position.set(0, 500, 2000);  // Front view
camera.position.set(2000, 500, 0);  // Side view
camera.position.set(0, 2000, 0);    // Top view

// Reset camera to look at model
camera.lookAt(0, 0, 0);
controls.target.set(0, 0, 0);
```

## 📊 Debug Information

### Check Model Visibility (browser console)
```javascript
console.log('Model:', model);
console.log('Model visible:', model.visible);
console.log('Model position:', model.position);
console.log('Model scale:', model.scale);
console.log('Camera position:', camera.position);
console.log('Camera rotation:', camera.rotation);
```

### Toggle Helpers
```javascript
// To remove helpers after you locate the model
scene.remove(axesHelper);
scene.remove(gridHelper);
```

## 🔧 Troubleshooting

### Still can't see the model?
1. **Check console** for errors (F12 → Console)
2. **Look for helpers**: You should see colored axes and a grid
3. **Try zooming out**: Scroll wheel or pinch gesture
4. **Check model scale**: Console should show `scale: {x: 4, y: 4, z: 4}`
5. **Verify model loaded**: Look for "✓ Model loaded successfully!"

### Model too small/large?
Adjust scale in keyframes:
```javascript
// In script.js, find modelPositionConfig.keyframes
scale: { x: 8, y: 8, z: 8 }  // Double the size
```

### Want to disable OrbitControls?
```javascript
// Comment out in script.js
// controls.update();
```

## 📝 Next Steps

Once you locate the model:
1. Remove or hide the visual helpers (axes, grid)
2. Fine-tune the camera position for your desired view
3. Adjust model scale if needed
4. Configure the scroll animation keyframes

The model is centered at the origin and the camera is automatically pointed at it!
