//! Fichier d'un média lu pendant qu'une rotation l'écrit (VIEW-60, retour 60.8 du 18/11). Avant : une lecture pouvait
//! trouver le fichier déjà tourné alors que la base donnait encore l'empreinte d'avant ; l'image lue (aperçu d'un RAW,
//! image décodée, miniature, grand aperçu) était rangée sous la mauvaise empreinte, puis resservie (un tour complet
//! ramène la même empreinte, retour 60.6) : aperçu déformé, image réelle dans un autre sens que le fichier.
//! Maintenant, une rotation attend la fin des lectures en cours du même média, et les nouvelles lectures attendent la
//! fin de l'écriture (nouvelle empreinte comprise) : ce qui est lu correspond toujours à l'empreinte de la base.
//! Règle : jamais une lecture dans une autre du même média, ni `reading` en tenant la base (sinon, blocage).

use std::collections::BTreeMap;
use std::sync::{Condvar, Mutex, MutexGuard};

#[derive(Default)]
struct Use {
    readers: usize,
    writing: bool,
    /// Rotations qui attendent : elles passent avant les nouvelles lectures (sinon, lectures enchaînées des voisines,
    /// copies… : la rotation pourrait attendre sans fin).
    waiting: usize,
}

static USES: Mutex<BTreeMap<i64, Use>> = Mutex::new(BTreeMap::new());
static CHANGED: Condvar = Condvar::new();

fn uses() -> MutexGuard<'static, BTreeMap<i64, Use>> {
    USES.lock().unwrap_or_else(|e| e.into_inner())
}

fn wait(guard: MutexGuard<'static, BTreeMap<i64, Use>>) -> MutexGuard<'static, BTreeMap<i64, Use>> {
    CHANGED.wait(guard).unwrap_or_else(|e| e.into_inner())
}

/// Lecture du fichier d'un média en cours, jusqu'à ce que la valeur soit lâchée.
pub struct Reading(i64);

/// Rotation du fichier d'un média en cours, jusqu'à ce que la valeur soit lâchée.
pub struct Writing(i64);

/// Attend qu'aucune rotation de ce média ne soit en cours ni en attente, puis le marque « en lecture ».
pub fn reading(id: i64) -> Reading {
    let mut all = uses();
    while all.get(&id).is_some_and(|u| u.writing || u.waiting > 0) {
        all = wait(all);
    }
    all.entry(id).or_default().readers += 1;
    Reading(id)
}

/// Attend la fin des lectures (et d'une autre rotation) de ce média, puis le marque « en écriture ».
pub fn writing(id: i64) -> Writing {
    let mut all = uses();
    all.entry(id).or_default().waiting += 1;
    while all.get(&id).is_some_and(|u| u.writing || u.readers > 0) {
        all = wait(all);
    }
    let u = all.entry(id).or_default();
    u.waiting -= 1;
    u.writing = true;
    Writing(id)
}

fn release(id: i64, change: impl FnOnce(&mut Use)) {
    let mut all = uses();
    if let Some(u) = all.get_mut(&id) {
        change(u);
        if u.readers == 0 && !u.writing && u.waiting == 0 {
            all.remove(&id);
        }
    }
    CHANGED.notify_all();
}

impl Drop for Reading {
    fn drop(&mut self) {
        release(self.0, |u| u.readers = u.readers.saturating_sub(1));
    }
}

impl Drop for Writing {
    fn drop(&mut self) {
        release(self.0, |u| u.writing = false);
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    #[test]
    fn la_rotation_attend_les_lectures_puis_les_bloque() {
        let id = -608;
        let first = super::reading(id);
        let written = Arc::new(AtomicBool::new(false));
        let w = written.clone();
        let writer = std::thread::spawn(move || {
            let _w = super::writing(id);
            w.store(true, Ordering::SeqCst);
            std::thread::sleep(Duration::from_millis(50));
        });
        std::thread::sleep(Duration::from_millis(50));
        assert!(!written.load(Ordering::SeqCst), "écriture pendant une lecture");
        drop(first);
        // Lecture demandée pendant l'écriture (ou son attente) : elle ne commence qu'après.
        std::thread::sleep(Duration::from_millis(10));
        let _second = super::reading(id);
        assert!(written.load(Ordering::SeqCst), "lecture avant la fin de la rotation");
        writer.join().unwrap();
    }
}
