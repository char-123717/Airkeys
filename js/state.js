export const state = {
    // Audio
    audioContext: null,
    instrument: null,
    currentInstrument: 'acoustic_grand_piano',

    // Timing
    startTime: 0,
    pauseTime: 0,
    currentTime: 0,

    // MIDI
    midi: null,
    notes: [],
    melodyNotes: [],
    harmonyNotes: [],
    duration: 0,

    // Playback
    isPlaying: false,
    gatedPause: false,
    currentSpeed: 1,
    currentSong: 'Kiss The Rain.mid',

    // Tracking
    playedMelodyIds: new Set(),
    touchedMelodyCount: 0,
    scheduledNotes: [],

    // UI
    pianoKeys: [],

    // Hand tracking
    hands: null,
    allFingerPoints: [],
    allHandsLandmarks: [],
    currentPlaystyle: 'fingers',

    // Animation
    animationFrameId: null
};
