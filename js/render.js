import { state } from './state.js';
import { NOTE_COLORS, WHITE_KEY_WIDTH, BLACK_KEY_WIDTH } from './config.js';
import { mapCoordinates } from './input.js';
import { formatSongTitle } from './ui.js';

const canvas = document.getElementById('notesCanvas');
const ctx = canvas.getContext('2d');

export function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

export function drawFallingNotes(getTouchedNote) {
    if (state.pianoKeys.length === 0) return;

    const lookAhead = 3;
    const lookBehind = 0.5;
    const pianoTopY = canvas.height - 140;
    const pixelsPerSecond = (canvas.height - 140) * 0.5;
    const hitZoneY = canvas.height * 0.6;
    const hitZoneTolerance = 50;

    ctx.save();
    ctx.globalAlpha = 1;

    state.notes.forEach((note) => {
        const timeDiff = note.time - state.currentTime;

        if (timeDiff > -lookBehind && timeDiff < lookAhead) {
            const keyData = state.pianoKeys.find(k => k.midi === note.midi);
            if (!keyData) return;

            const keyRect = keyData.element.getBoundingClientRect();
            const containerRect = canvas.getBoundingClientRect();
            const keyX = keyRect.left - containerRect.left + keyRect.width / 2;
            const noteY = pianoTopY - (timeDiff * pixelsPerSecond);
            const noteWidth = keyData.isWhite ? WHITE_KEY_WIDTH - 4 : BLACK_KEY_WIDTH - 2;
            const noteHeight = Math.max(10, note.duration * pixelsPerSecond);

            const colorIndex = note.midi % NOTE_COLORS.length;
            const isMelody = state.melodyNotes.some(m => m.id === note.id);
            const isPlayed = state.playedMelodyIds.has(note.id);

            ctx.fillStyle = NOTE_COLORS[colorIndex];

            if (isMelody) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = NOTE_COLORS[colorIndex];
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(keyX - noteWidth / 2, noteY - noteHeight, noteWidth, noteHeight);
            ctx.shadowBlur = 0;

            if (isMelody && !isPlayed) {
                const noteBottom = noteY;
                const noteTop = noteY - noteHeight;

                if (noteBottom >= hitZoneY - hitZoneTolerance && noteTop <= hitZoneY + hitZoneTolerance) {
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 3;

                    const pulseIntensity = 0.5 + Math.sin(Date.now() / 200) * 0.5;
                    ctx.shadowBlur = 15 + pulseIntensity * 15;
                    ctx.shadowColor = '#ffffff';

                    ctx.strokeRect(keyX - noteWidth / 2, noteY - noteHeight, noteWidth, noteHeight);
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 0.5;
                }
            }
        }
    });

    ctx.restore();
}

export function drawHitZone() {
    const hitZoneY = canvas.height * 0.6;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 100, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, hitZoneY);
    ctx.lineTo(canvas.width, hitZoneY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 255, 100, 0.8)';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('← Touch notes here →', canvas.width / 2, hitZoneY - 10);
    ctx.restore();
}

export function drawDebugInfo(getTouchedNote) {
    if (state.allFingerPoints.length === 0) return;

    ctx.save();
    const touchedNote = getTouchedNote();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';

    let debugY = 100;
    ctx.fillText(`Song: ${formatSongTitle(state.currentSong)}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Mode: ${state.currentPlaystyle}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Hands: ${state.allHandsLandmarks.length}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Points: ${state.allFingerPoints.length}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Speed: ${state.currentSpeed}x`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Touching: ${touchedNote ? touchedNote.midi : 'None'}`, 10, debugY);
    debugY += 15;
    ctx.fillText(`Status: ${state.gatedPause ? 'PAUSED' : (state.isPlaying ? 'PLAYING' : 'STOPPED')}`, 10, debugY);

    ctx.restore();
}

export function drawHandSkeleton() {
    if (state.allHandsLandmarks.length === 0) return;

    const containerRect = canvas.parentElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const offsetX = containerRect.left - canvasRect.left;
    const offsetY = containerRect.top - canvasRect.top;

    const connectors = [
        [0, 5], [0, 9], [0, 13], [0, 17],
        [5, 6], [6, 7], [7, 8],
        [9, 10], [10, 11], [11, 12],
        [13, 14], [14, 15], [15, 16],
        [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17]
    ];

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#10b981';

    state.allHandsLandmarks.forEach((landmarks) => {
        const pts = landmarks.map(p => {
            const q = mapCoordinates(p.x, p.y);
            return { x: q.x - offsetX, y: q.y - offsetY };
        });

        connectors.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(pts[a].x, pts[a].y);
            ctx.lineTo(pts[b].x, pts[b].y);
            ctx.stroke();
        });

        ctx.fillStyle = '#22d3ee';
        for (let i = 0; i < pts.length; i++) {
            ctx.beginPath();
            ctx.arc(pts[i].x, pts[i].y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';

        if (state.currentPlaystyle === 'fingers') {
            const fingertipIndices = [4, 8, 12, 16, 20];
            fingertipIndices.forEach(index => {
                ctx.beginPath();
                ctx.arc(pts[index].x, pts[index].y, 5, 0, Math.PI * 2);
                ctx.fill();
            });
        } else if (state.currentPlaystyle === 'palm') {
            for (let i = 0; i < 21; i++) {
                ctx.beginPath();
                ctx.arc(pts[i].x, pts[i].y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });

    ctx.restore();
}
