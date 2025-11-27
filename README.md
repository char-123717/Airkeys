# 🎹 Piano Visualization Game

An interactive piano rhythm game that uses hand tracking to play piano songs in real-time. Play with your hands in front of the camera!

## ✨ Features

- 🎵 **4 Piano Songs**: Kiss The Rain, River Flows In You, 7 Years, and Jumping Machine
- 🎸 **4 Instruments**: Piano, Violin, Guitar, and Saxophone
- 👋 **Hand Tracking**: Uses MediaPipe for real-time hand detection
- 🎯 **Two Play Modes**:
  - **Fingers Mode**: Play with fingertips (5 points)
  - **Palm Mode**: Play with entire hand (21 landmarks)
- ⚡ **Speed Control**: 0.5x, 0.75x, and 1x
- 📊 **Scoring System**: Calculate accuracy and achieve ratings (Perfect, Great, Good, Miss)
- 🎨 **Visual Effects**: Falling notes with glow effects
- 📹 **Live Camera Feed**: Camera preview with hand tracking overlay

## 🛠️ Technologies Used

- **HTML5 Canvas**: For rendering falling notes and visualization
- **Tone.js**: Audio synthesis and MIDI playback
- **MediaPipe Hands**: Real-time hand tracking
- **Vanilla JavaScript**: Game logic and interactions
- **CSS3**: UI styling and animations

## 📋 System Requirements

- Modern browser (Chrome, Edge, or Firefox recommended)
- Webcam
- Python 3.x (for local server)

## 🚀 Installation & Running

### Why Do I Need a Local Server?

You **cannot** run this app by simply double-clicking `index.html` due to browser security (CORS policy). Modern browsers block:
- Loading local MIDI files via `fetch()`
- Accessing camera via `getUserMedia()`
- Loading external libraries from CDN

**Solution**: Serve files through HTTP protocol using a local server.

---

### Method 1: Python HTTP Server (Easiest) ⭐

**Best for**: Quick testing, beginners, no installation needed

#### Step 1: Check if Python is Installed

Open **Command Prompt** (Windows) or **Terminal** (Mac/Linux) and type:

```bash
python --version
```

If you see something like `Python 3.x.x`, you're good to go! If not, download from [python.org](https://www.python.org/downloads/)

#### Step 2: Navigate to Project Folder

```powershell
cd d:/song
```

Or if using Mac/Linux:
```bash
cd /path/to/your/song/folder
```

#### Step 3: Start Server

```powershell
python -m http.server 8000
```

If `python` doesn't work, try:
```powershell
python3 -m http.server 8000
```

#### Step 4: Open Browser

You should see:
```
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

Open your browser and go to:
- `http://localhost:8000` OR
- `http://127.0.0.1:8000`

#### To Stop Server:
Press `Ctrl + C` in the terminal

---

### Method 2: VS Code Live Server (Best for Development) ⭐⭐⭐

**Best for**: Active development, auto-refresh, easiest workflow

#### Step 1: Install Visual Studio Code

1. Download from [code.visualstudio.com](https://code.visualstudio.com/)
2. Install normally (Next → Next → Finish)
3. Open VS Code

#### Step 2: Install Live Server Extension

**Option A: Via Extensions Panel**
1. Click **Extensions** icon on left sidebar (or press `Ctrl+Shift+X`)
2. Search for **"Live Server"** by Ritwick Dey
3. Click **Install**

**Option B: Via Quick Install**
1. Press `Ctrl+P`
2. Type: `ext install ritwickdey.LiveServer`
3. Press Enter

#### Step 3: Open Project Folder

1. File → Open Folder
2. Select `d:/song` folder
3. Click "Select Folder"

#### Step 4: Launch Live Server

**Option A: Right-click method**
1. Right-click on `index.html` in the file explorer
2. Click **"Open with Live Server"**

**Option B: Status bar method**
1. Look at bottom-right corner of VS Code
2. Click **"Go Live"** button

Browser will automatically open at `http://127.0.0.1:5500`

#### Features:
- ✅ **Auto-refresh**: Edit code → Save → Browser auto-updates!
- ✅ **No terminal needed**: Just click "Go Live"
- ✅ **Port management**: Automatically finds available port

#### To Stop Server:
Click **"Port: 5500"** at bottom-right corner

---

### Method 3: Node.js HTTP Server

**Best for**: If you already use Node.js/npm for development

#### Step 1: Install Node.js

1. Download from [nodejs.org](https://nodejs.org/)
2. Choose **LTS version** (recommended)
3. Install normally
4. Verify installation:
```bash
node --version
npm --version
```

#### Step 2: Install http-server

Open terminal and run:
```bash
npm install -g http-server
```

**What this does**: Installs a simple HTTP server globally on your system

#### Step 3: Navigate to Project

```bash
cd d:/song
```

#### Step 4: Start Server

```bash
http-server -p 8000
```

**Options you can use**:
```bash
http-server -p 8000 -o           # Auto-open browser
http-server -p 8000 -c-1         # Disable caching (good for development)
http-server -p 8000 -o -c-1      # Both options
```

You'll see:
```
Starting up http-server, serving ./
Available on:
  http://127.0.0.1:8000
```

#### To Stop Server:
Press `Ctrl + C`

---

### Method 4: Online IDE (No Installation Needed!) ☁️

**Best for**: Quick demos, sharing projects, no local setup needed

#### Option A: CodeSandbox (Recommended)

1. Go to [codesandbox.io](https://codesandbox.io)
2. Click **"Create Sandbox"**
3. Choose **"Vanilla"** template
4. Delete default files
5. **Upload your files**:
   - Drag & drop `index.html`, `style.css`, `script.js`
   - Create `public` folder
   - Upload all `.mid` files to `public` folder
6. Update MIDI paths in code:
   ```javascript
   // Change from:
   await loadMIDI('Kiss The Rain.mid');
   // To:
   await loadMIDI('/public/Kiss The Rain.mid');
   ```
7. Click **Preview** to run

**Share link**: Click "Share" button to get shareable URL!

#### Option B: StackBlitz

1. Go to [stackblitz.com](https://stackblitz.com)
2. Click **"Start a new project"**
3. Choose **"HTML/CSS/JS"**
4. Upload your files via file explorer
5. Browser automatically shows preview

**Advantage**: Runs entirely in browser, no server needed!

#### Option C: Replit

1. Go to [replit.com](https://replit.com)
2. Click **"+ Create Repl"**
3. Choose **"HTML, CSS, JS"** template
4. Upload files via "Upload file" button
5. Click **Run** button

**Bonus**: Always online! Share link with friends.

---

### Method 5: XAMPP / WAMP (Advanced)

**Best for**: If you already use these for PHP/MySQL development

#### XAMPP Setup:

1. Install [XAMPP](https://www.apachefriends.org/)
2. Copy project folder to `C:/xampp/htdocs/song`
3. Start **Apache** in XAMPP Control Panel
4. Open browser: `http://localhost/song`

#### WAMP Setup:

1. Install [WAMP](https://www.wampserver.com/)
2. Copy project folder to `C:/wamp64/www/song`
3. Start **WAMP** (icon turns green)
4. Open browser: `http://localhost/song`

---

### Quick Comparison Table

| Method | Difficulty | Auto-refresh | Installation | Best For |
|--------|-----------|--------------|--------------|----------|
| Python | ⭐ Easy | ❌ No | None (usually) | Quick testing |
| VS Code Live Server | ⭐⭐ Easy | ✅ Yes | VS Code + Extension | Active development |
| Node.js http-server | ⭐⭐ Medium | ❌ No | Node.js + npm | Node developers |
| Online IDE | ⭐ Easiest | ✅ Yes | None | Demos, sharing |
| XAMPP/WAMP | ⭐⭐⭐ Advanced | ❌ No | Large install | Full stack devs |

**My Recommendation**:
- 🥇 **For development**: VS Code Live Server
- 🥈 **For quick test**: Python HTTP Server  
- 🥉 **For sharing**: CodeSandbox

---

### 3. Open in Browser

1. Open browser (Chrome/Edge recommended)
2. Type in address bar: `http://localhost:8000` or `http://127.0.0.1:8000`
3. Allow camera access when prompted

## 🎮 How to Play

### Initial Setup

1. **Allow Camera**: Browser will request camera access permission
2. **Position**: Sit about 50-70cm from camera
3. **Lighting**: Ensure the room is well-lit
4. **Choose Settings**:
   - **Song**: Select song from dropdown
   - **Speed**: Adjust speed (start with 0.5x for beginners)
   - **Style**: Choose Fingers or Palm mode
   - **Instrument**: Select instrument sound

### Playing the Game

1. Press **Play** button (▶️)
2. Wait for **3-second countdown**
3. **Touch falling notes** with your hand when they reach the hit zone (white line)
4. **Purple notes** = melody notes (you must play these)
5. **Other colored notes** = harmony notes (played automatically)

### Tips

- **Fingers Mode**: More accurate, use fingertips for precision
- **Palm Mode**: Easier, use entire hand
- **Hand Position**: Face camera with fingers spread
- **Practice**: Start with 0.5x speed to learn timing

## 🎯 Scoring System

- **Perfect**: > 90% accuracy
- **Great**: 70-90% accuracy
- **Good**: 50-70% accuracy
- **Miss**: < 50% accuracy

Accuracy is calculated from the percentage of melody notes you successfully touched.

## 🎼 Adding New Songs

1. Prepare MIDI file (`.mid` format)
2. Place file in `d:/song/` folder
3. Edit `index.html`, add new option:

```html
<option value="your-song-name.mid">Song Name</option>
```

4. Refresh browser and the new song will appear in dropdown!

## 🔧 Troubleshooting

### Camera not appearing
- Ensure browser has camera access permission
- Try another browser (Chrome recommended)
- Check if camera is being used by another application

### Song not playing
- Check Console (F12) for errors
- Ensure MIDI file exists in correct folder
- Refresh page (F5)

### Hand tracking inaccurate
- Increase room lighting
- Maintain 50-70cm distance from camera
- Ensure hand is clearly visible
- Use background that contrasts with skin tone

### Server not running
- Ensure Python is installed: `python --version`
- Try another port if 8000 is in use: `python -m http.server 8080`
- Check for firewall blocking

## 📁 File Structure

```
d:/song/
├── index.html          # Main HTML structure
├── style.css           # Styling and animations
├── script.js           # Game logic, MIDI parsing, hand tracking
├── README.md           # This documentation
└── *.mid              # MIDI song files
```

## 📝 Important Notes

- **MIDI Files Only**: Application only supports MIDI, cannot use MP3/WAV
- **Local Server Required**: Cannot be opened directly by double-clicking HTML (CORS issue)
- **Modern Browser**: Use latest version of Chrome/Edge for best performance

## 🤝 Contributing

Feel free to fork and improve! Some development ideas:
- Add more instruments
- Multiplayer mode
- Leaderboard with local storage
- Export recording to video
- Mobile support

## 📄 License

Free to use for learning and development.

---

**Happy Playing! 🎹🎵**

If you have questions, please open an issue or contact the developer.
