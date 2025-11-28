export const state = {
    midi: null,
    synth: null,
    notes: [],
    melodyNotes: [],
    harmonyNotes: [],
    isPlaying: false,
    gatedPause: false,
    currentTime: 0,
    duration: 0,
    currentSpeed: 1,
    currentPlaystyle: 'fingers',
    currentSong: 'Kiss The Rain.mid',
    pianoKeys: [],
    allFingerPoints: [],
    allHandsLandmarks: [],
    playedMelodyIds: new Set(),
    touchedMelodyCount: 0,
    finalScore: 0,

    // Audio nodes
    master: null,
    compressor: null,
    limiter: null,

    // Animation
    animationFrameId: null
};
