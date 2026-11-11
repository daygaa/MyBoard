//! Pause de l'import (IMP-42, réponses du 09/11 et du 11/11) : « Arrêter » met l'import en pause aussitôt (ffmpeg
//! compris, `video::control`), « Reprendre » repart du fichier où il s'était arrêté ; « Terminer ici » et « Annuler
//! l'import » lèvent `stop`, qui réveille aussi une pause.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Condvar, Mutex};
use std::time::Duration;

pub struct Gate {
    paused: AtomicBool,
    lock: Mutex<()>,
    wake: Condvar,
}

impl Gate {
    pub fn new() -> Self {
        Self { paused: AtomicBool::new(false), lock: Mutex::new(()), wake: Condvar::new() }
    }

    pub fn set(&self, paused: bool) {
        self.paused.store(paused, Ordering::SeqCst);
        let _guard = self.lock.lock().unwrap();
        self.wake.notify_all();
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    /// Attend la fin de la pause, ou l'arrêt de l'import (`stop`).
    pub fn wait(&self, stop: &AtomicBool) {
        let mut guard = self.lock.lock().unwrap();
        while self.is_paused() && !stop.load(Ordering::SeqCst) {
            guard = self.wake.wait_timeout(guard, Duration::from_millis(200)).unwrap().0;
        }
    }
}
