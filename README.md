# 🎹 Piano Visualization Game

An interactive piano rhythm game that uses hand tracking to play piano songs in real-time. Play with your hands in front of the camera!

## ✨ Features

- 🎵 **6 Piano Songs**: Kiss The Rain, River Flows In You, 7 Years, Jumping Machine 跳樓機, ni hao bu hao 你好不好, zen me le 怎麽了
- 🎸 **5 Instruments**: Piano, Violin, Guitar, Flute, Saxophone
- 👋 **Hand Tracking**: Uses MediaPipe for real-time hand detection
- 🎯 **Three Play Modes**:
  - **Fingers Mode**: Play with fingertips (5 points)
  - **Palm Mode**: Play with more fingertips (21 landmarks)
  - **Solid hand mode**: Play with entire hand 
- ⚡ **Speed Control**: 0.5x, 0.75x, and 1x
- 📊 **Scoring System**: Calculate accuracy and achieve ratings (Perfect, Great, Good, Miss)
- 🎨 **Visual Effects**: Falling notes with glow effects
- 📹 **Live Camera Feed**: Camera preview with hand tracking overlay

## 🛠️ Technologies Used

- **HTML5 Canvas**: For rendering falling notes and visualization
- **Web Audio API**: Audio playback using .wav samples per note per instrument
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

### Quick Comparison Table

| Method | Difficulty | Auto-refresh | Installation | Best For |
|--------|-----------|--------------|--------------|----------|
| Python | ⭐ Easy | ❌ No | None (usually) | Quick testing |
| VS Code Live Server | ⭐⭐ Easy | ✅ Yes | VS Code + Extension | Active development |
| Node.js http-server | ⭐⭐ Medium | ❌ No | Node.js + npm | Node developers |

**My Recommendation**:
- 🥇 **For development**: VS Code Live Server
- 🥈 **For quick test**: Python HTTP Server  


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
   - **Style**: Choose Fingers, Palm or Solid hand mode
   - **Instrument**: Select instrument sound

### Playing the Game

1. Press **Play** button (▶️)
2. Wait for **3-second countdown**
3. **Touch falling notes** with your hand when they reach the hit zone (white line)
4. **Purple notes** = melody notes (you must play these)
5. **Other colored notes** = harmony notes (played automatically)

### Tips

- **Fingers Mode**: Use 5 fingertips for precision
- **Palm Mode**: More accurate, use 21 fingertips for precision
- **Solid hand mode**: Easiest, use entire hand
- **Hand Position**: Face camera with fingers spread
- **Practice**: Start with 0.5x speed to learn timing

## 🎯 Scoring System

- **Perfect**: > 90% accuracy
- **Great**: 70-90% accuracy
- **Good**: 50-70% accuracy
- **Miss**: < 50% accuracy

Accuracy is calculated from the percentage of melody notes you successfully touched.

## 📁 File Structure

```
d:/song/
├── assets/
│   └── midi/          # MIDI song files
│     └── Kiss The Rain.mid
│     └── Yiruma -River Flows In You.mid
│     └── 7 years.mid
│     └── jumping machine.mid
│     └── ni hao bu hao.mid
│     └── zen me le.mid
│   └── soundfonts/ 
│     └── piano/        # Piano soundfont files (.wav)
│        └── C2.wav     
│        └── Cs2.wav    
│        └── etc...
│     └── violin/       # Violin soundfont files (.wav)
|         └── C2.wav     
│        └── Cs2.wav    
│        └── etc...   
│     └── guitar/      # Guitar soundfont files (.wav)
|         └── C2.wav     
│        └── Cs2.wav    
│        └── etc...
│     └── flute/       # Flute soundfont files (.wav)
|         └── C2.wav     
│        └── Cs2.wav    
│        └── etc...
│     └── saxophone/   # Saxophone soundfont files (.wav)
|         └── C2.wav     
│        └── Cs2.wav    
│        └── etc...
├── css/
│   └── style.css      # Styling and animations
├── js/
│   ├── audio.js       # Audio synthesis logic
│   ├── config.js      # Constants and configuration
│   ├── game.js        # Core game loop and logic
│   ├── input.js       # Camera and hand tracking
│   ├── main.js        # Entry point
│   ├── midi.js        # MIDI file loading and parsing
│   ├── render.js      # Canvas rendering
│   ├── state.js       # Global state management
│   └── ui.js          # UI controls and interactions
├── index.html         # Main HTML structure
├── package-lock.json  # Project dependencies
└── README.md          # This documentation
```

## 🎼 Adding New Songs

1. Prepare MIDI file (`.mid` format)
2. Place file in `d:/song/assets/midi/` folder
3. Edit `index.html`, add new option:

```html
<option value="your-song-name.mid">Song Name</option>
```

4. Refresh browser and the new song will appear in dropdown!

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