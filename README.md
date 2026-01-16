# 3D Art Playground

A web-based 3D drawing application with physics simulation. Originally built for Meta Quest VR, now available for desktop and mobile browsers.

## Live Demo

Visit: [Your GitHub Pages URL]

## Features

- **3D Drawing**: Draw strokes in 3D space with customizable colors and brush sizes
- **Physics Simulation**: Powered by Havok Physics - grab and throw your drawings
- **9 Colors**: White, Red, Green, Blue, Yellow, Orange, Purple, Cyan, Pink
- **Cross-Platform**: Works on desktop (mouse) and mobile (touch)
- **Responsive UI**: Adapts to any screen size

## Controls

### Desktop
| Action | Control |
|--------|---------|
| Draw | Left-click + drag |
| Orbit Camera | Right-click + drag |
| Zoom | Scroll wheel |
| Grab Mode | Press `G` key |
| Draw Mode | Press `D` key |
| Orbit Mode | Press `O` key |
| Undo | `Ctrl+Z` / `Cmd+Z` |

### Mobile
| Action | Control |
|--------|---------|
| Draw | 1 finger drag |
| Orbit Camera | 2 finger drag |
| Zoom | Pinch gesture |
| Grab/Throw | Use Grab mode button |

### VR (Meta Quest)
| Action | Control |
|--------|---------|
| Draw | Right Trigger |
| Grab & Throw | Right Grip |
| Toggle Menu | Right B Button |
| Move | Left Thumbstick |
| Brush Size | Left Thumbstick (far) |
| Undo | Right A Button |

## Technology Stack

- **Babylon.js** - 3D rendering engine
- **Havok Physics** - Physics simulation
- **WebXR** - VR support (original version)
- **Vanilla JavaScript** - No framework dependencies

## Deployment to GitHub Pages

1. Create a new repository on GitHub
2. Push this folder to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - 3D Art Playground"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Go to repository **Settings** > **Pages**
4. Under "Source", select **Deploy from a branch**
5. Select **main** branch and **/ (root)** folder
6. Click **Save**
7. Your site will be available at `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## Local Development

Simply open `index.html` in a modern web browser, or use a local server:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve

# VS Code
# Use "Live Server" extension
```

Then visit `http://localhost:8080`

## Project Structure

```
arPava/
├── index.html      # Main HTML page
├── app.js          # Main application logic (web version)
├── babylon.js      # Original VR version (Meta Quest)
├── styles.css      # Responsive styles
└── README.md       # This file
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 15+
- Edge 90+

## License

MIT License - Feel free to use and modify!

## Credits

- Built with [Babylon.js](https://www.babylonjs.com/)
- Physics by [Havok](https://www.havok.com/)
