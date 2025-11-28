import { state } from './state.js';

export async function loadMIDI(filename) {
    const response = await fetch(`assets/midi/${filename}`);
    const arrayBuffer = await response.arrayBuffer();

    // Parse MIDI using midi-parser-js
    state.midi = MidiParser.parse(new Uint8Array(arrayBuffer));

    // Extract tempo (default to 120 BPM if not found)
    let tempo = 120;
    if (state.midi.track && state.midi.track.length > 0) {
        // Search all tracks for tempo event
        for (const track of state.midi.track) {
            const tempoEvent = track.event.find(e => e.type === 81);
            if (tempoEvent && tempoEvent.data && tempoEvent.data.length >= 3) {
                const microsecondsPerBeat = (tempoEvent.data[0] << 16) | (tempoEvent.data[1] << 8) | tempoEvent.data[2];
                tempo = 60000000 / microsecondsPerBeat;
                break;
            }
        }
    }

    // Apply speed multiplier
    tempo *= state.currentSpeed;

    // Convert MIDI ticks to seconds
    const ticksPerBeat = state.midi.timeDivision;
    const secondsPerTick = 60 / (tempo * ticksPerBeat);

    // Process all tracks
    state.notes = [];
    const activeNotes = new Map();

    state.midi.track.forEach((track, trackIndex) => {
        let currentTime = 0;

        track.event.forEach(event => {
            currentTime += event.deltaTime * secondsPerTick;

            // Note On
            if (event.type === 9 && event.data && event.data[1] > 0) {
                const noteKey = `${trackIndex}-${event.data[0]}`;
                activeNotes.set(noteKey, {
                    id: `${noteKey}-${currentTime}`,
                    midi: event.data[0],
                    velocity: event.data[1] / 127,
                    time: currentTime,
                    track: trackIndex
                });
            }
            // Note Off
            else if (event.type === 8 || (event.type === 9 && event.data && event.data[1] === 0)) {
                const noteKey = `${trackIndex}-${event.data[0]}`;
                const note = activeNotes.get(noteKey);

                if (note) {
                    note.duration = Math.max(0.05, currentTime - note.time); // Minimum 50ms duration
                    state.notes.push(note);
                    activeNotes.delete(noteKey);
                }
            }
        });
    });

    // Handle notes that never got a note-off (give them default duration)
    activeNotes.forEach(note => {
        note.duration = 0.5; // Default 500ms duration
        state.notes.push(note);
    });

    // Sort notes by time
    state.notes.sort((a, b) => a.time - b.time);

    // Calculate duration
    if (state.notes.length > 0) {
        const lastNote = state.notes[state.notes.length - 1];
        state.duration = lastNote.time + lastNote.duration;
    }

    console.log(`Loaded ${state.notes.length} notes from ${filename}`);

    // Separate melody and harmony
    separateMelodyHarmony();
}

function separateMelodyHarmony() {
    // Group notes by time window
    const timeWindow = 0.05; // 50ms window
    const groups = [];
    let currentGroup = [];
    let currentGroupTime = -1;

    state.notes.forEach(note => {
        if (currentGroupTime < 0 || Math.abs(note.time - currentGroupTime) < timeWindow) {
            currentGroup.push(note);
            currentGroupTime = note.time;
        } else {
            if (currentGroup.length > 0) {
                groups.push([...currentGroup]);
            }
            currentGroup = [note];
            currentGroupTime = note.time;
        }
    });

    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    // Separate melody (highest note in each group) from harmony
    state.melodyNotes = [];
    state.harmonyNotes = [];

    groups.forEach(group => {
        if (group.length === 1) {
            state.melodyNotes.push(group[0]);
        } else {
            // Sort by pitch
            group.sort((a, b) => b.midi - a.midi);
            state.melodyNotes.push(group[0]); // Highest note is melody
            state.harmonyNotes.push(...group.slice(1)); // Rest are harmony
        }
    });

    console.log(`Melody: ${state.melodyNotes.length} notes, Harmony: ${state.harmonyNotes.length} notes`);
}

export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
