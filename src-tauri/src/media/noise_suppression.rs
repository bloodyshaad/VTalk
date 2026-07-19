//! Audio noise suppression pipeline.
//!
//! In production this wraps RNNoise (or the WebRTC NS module) compiled as a
//! native dependency. To keep the desktop build self-contained on every
//! platform without bundling a C library, the default implementation applies a
//! real time-domain high-pass filter plus a soft spectral-floor gate on the
//! supplied mono f32 frames. The `NoiseSuppression` struct is the integration
//! point: swap its `process_frame` body for `rnnoise_process_frame` when the
//! native library is linked.
//!
//! Filter state is maintained **per stream** (keyed by `stream_id`) rather than
//! in a single global singleton, so concurrent audio streams never leak their
//! one-pole HPF state into one another.

use std::collections::HashMap;

pub struct NoiseSuppression {
    enabled: bool,
    /// One-pole high-pass state.
    prev_input: f32,
    prev_output: f32,
    /// Cutoff coefficient for ~80Hz high-pass at the configured sample rate.
    alpha: f32,
}

impl NoiseSuppression {
    pub fn new(sample_rate: u32) -> Self {
        // High-pass corner frequency ~80 Hz.
        let rc = 1.0 / (2.0 * std::f32::consts::PI * 80.0);
        let dt = 1.0 / sample_rate as f32;
        let alpha = rc / (rc + dt);
        Self {
            enabled: true,
            prev_input: 0.0,
            prev_output: 0.0,
            alpha,
        }
    }

    /// Recompute the high-pass coefficient for a new sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: u32) {
        let rc = 1.0 / (2.0 * std::f32::consts::PI * 80.0);
        let dt = 1.0 / sample_rate as f32;
        self.alpha = rc / (rc + dt);
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Process a single frame of mono samples in [-1.0, 1.0].
    /// Applies a high-pass filter and a mild spectral-floor gate.
    pub fn process_frame(&mut self, frame: &[f32]) -> Vec<f32> {
        if !self.enabled {
            return frame.to_vec();
        }
        let mut out = Vec::with_capacity(frame.len());
        for &x in frame {
            // One-pole high-pass: y[n] = a*y[n-1] + a*(x[n] - x[n-1])
            let y = self.alpha * (self.prev_output + x - self.prev_input);
            self.prev_input = x;
            self.prev_output = y;
            // Soft gate: attenuate very low-energy (noise floor) samples.
            let gated = if y.abs() < 0.005 { y * 0.3 } else { y };
            out.push(gated.clamp(-1.0, 1.0));
        }
        out
    }
}

/// Per-stream noise-suppression state, keyed by stream id so that concurrent
/// streams do not corrupt each other's filter state. The enabled flag is shared
/// process-wide and toggled via `set_global_enabled`.
struct ProcessorRegistry {
    enabled: bool,
    sample_rate: u32,
    streams: HashMap<String, NoiseSuppression>,
}

impl ProcessorRegistry {
    fn stream_mut(&mut self, stream_id: &str) -> &mut NoiseSuppression {
        let sample_rate = self.sample_rate;
        self.streams
            .entry(stream_id.to_string())
            .or_insert_with(|| {
                let mut ns = NoiseSuppression::new(sample_rate);
                ns.set_enabled(self.enabled);
                ns
            })
    }
}

static REGISTRY: once_cell::sync::Lazy<std::sync::Mutex<ProcessorRegistry>> =
    once_cell::sync::Lazy::new(|| {
        std::sync::Mutex::new(ProcessorRegistry {
            enabled: true,
            sample_rate: 48_000,
            streams: HashMap::new(),
        })
    });

pub fn set_global_enabled(enabled: bool) {
    let mut reg = REGISTRY.lock().unwrap();
    reg.enabled = enabled;
    for ns in reg.streams.values_mut() {
        ns.set_enabled(enabled);
    }
}

pub fn set_global_sample_rate(sample_rate: u32) {
    let mut reg = REGISTRY.lock().unwrap();
    reg.sample_rate = sample_rate;
    for ns in reg.streams.values_mut() {
        ns.set_sample_rate(sample_rate);
    }
}

pub fn is_global_enabled() -> bool {
    REGISTRY.lock().unwrap().enabled
}

/// Process one frame for a given stream. `stream_id` isolates filter state.
pub fn process_audio_frame(stream_id: &str, frame: Vec<f32>) -> Vec<f32> {
    let mut reg = REGISTRY.lock().unwrap();
    reg.stream_mut(stream_id).process_frame(&frame)
}
