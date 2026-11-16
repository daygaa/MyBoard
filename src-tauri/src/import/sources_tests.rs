//! Essais de la liste par source (IMP-88).

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::*;
use crate::formats::Kind;

fn inner() -> Inner {
    Inner {
        snapshot: Snapshot::idle(true),
        files: Vec::new(),
        sources: Vec::new(),
        version: 0,
        unreadable: Vec::new(),
        last_tags: Vec::new(),
        last_emit: std::time::Instant::now(),
        removed: Default::default(),
        refusing: Refused::default(),
    }
}

fn add(inner: &mut Inner, path: &str, folder: bool, recursive: bool, files: &[&str]) -> u64 {
    let id = inner.next_id();
    let mut s = Source::new(id, path.into(), folder, recursive);
    (s.scanning, s.fresh) = (false, false);
    inner.sources.push(s);
    for f in files {
        inner.files.push(ScanFile { path: PathBuf::from(f), kind: Kind::Image, ext: "jpg".into(), size: 1, source: id });
    }
    id
}

fn owner(inner: &Inner, file: &str) -> u64 {
    inner.files.iter().find(|f| f.path == Path::new(file)).unwrap().source
}

/// Croix d'un fichier (comme `remove_scan_file`).
fn cross(inner: &mut Inner, file: &str) {
    inner.files.retain(|f| f.path != Path::new(file));
    inner.removed.insert(file.to_lowercase());
}

fn listed(inner: &Inner) -> HashSet<String> {
    inner.files.iter().map(|f| removed_key(&f.path)).collect()
}

fn source(inner: &Inner, id: u64) -> &Source {
    inner.sources.iter().find(|s| s.id == id).unwrap()
}

#[test]
fn sous_dossier_mis_de_cote_puis_rendu() {
    let mut inner = inner();
    let p = add(&mut inner, r"C:\a", true, false, &[r"C:\a\1.jpg"]);
    let s = add(&mut inner, r"C:\A\sous", true, false, &[r"C:\a\sous\2.jpg"]);
    let f = add(&mut inner, r"C:\a\x\3.jpg", false, false, &[r"C:\a\x\3.jpg"]);
    let other = add(&mut inner, r"C:\ab", true, true, &[r"C:\ab\4.jpg"]);
    inner.sources[0].recursive = true;
    inner.absorb_under(p);
    inner.summarize();
    assert_eq!(inner.snapshot.lines, 2, r"le dossier coché et C:\ab seulement");
    assert_eq!((owner(&inner, r"C:\a\sous\2.jpg"), owner(&inner, r"C:\a\x\3.jpg")), (p, p));
    assert_eq!(owner(&inner, r"C:\ab\4.jpg"), other);
    assert_eq!(inner.snapshot.scan.as_ref().unwrap().total, 4, "les chiffres ne bougent pas");

    inner.sources[0].recursive = false;
    inner.release(p);
    inner.summarize();
    assert_eq!(inner.snapshot.lines, 4);
    assert_eq!((owner(&inner, r"C:\a\sous\2.jpg"), owner(&inner, r"C:\a\x\3.jpg")), (s, f));
    assert_eq!(owner(&inner, r"C:\a\1.jpg"), p);
    assert!(inner.sources.iter().filter(|x| x.id != p && x.id != other).all(|x| x.scanning && !x.fresh));
}

#[test]
fn retire_avec_ce_qu_il_a_mis_de_cote() {
    let mut inner = inner();
    let p = add(&mut inner, r"C:\a", true, true, &[]);
    let s = add(&mut inner, r"C:\a\b", true, true, &[]);
    let t = add(&mut inner, r"C:\a\b\c", true, false, &[]);
    let other = add(&mut inner, r"C:\z", true, true, &[]);
    inner.absorb_under(s);
    inner.absorb_under(p);
    assert_eq!(source(&inner, t).absorbed_by, Some(s));
    assert_eq!(inner.with_absorbed(p), HashSet::from([p, s, t]));
    assert_eq!(inner.with_absorbed(other), HashSet::from([other]));
}

#[test]
fn sous_un_dossier() {
    assert!(is_under(r"C:\A\b", r"c:\a"));
    assert!(is_under(r"C:\a\b\c.jpg", r"C:\a\"));
    assert!(!is_under(r"C:\ab", r"C:\a"));
    assert!(!is_under(r"C:\a", r"C:\a"));
}

/// Q47 B : dossier ajouté de nouveau = ses fichiers retirés reviennent (sous-dossiers compris s'il est coché).
#[test]
fn dossier_ajoute_de_nouveau() {
    let mut inner = inner();
    let p = add(&mut inner, r"C:\a", true, false, &[r"C:\a\1.jpg", r"C:\a\2.jpg"]);
    cross(&mut inner, r"C:\a\2.jpg");
    inner.removed.insert(r"c:\a\sous\3.jpg".into());
    let none = HashSet::new();
    assert!(inner.add_path(r"C:\A".into(), true, false, &none), "un fichier retiré revient");
    assert!(source(&inner, p).scanning);
    assert_eq!(inner.removed, HashSet::from([r"c:\a\sous\3.jpg".to_string()]), "décochée : seuls ses fichiers directs");
    inner.sources[0].scanning = false;
    assert!(!inner.add_path(r"C:\a".into(), true, false, &none), "rien ne change : déjà dans la liste");
    assert!(inner.add_path(r"C:\a".into(), true, true, &none), "la case change");
    assert!(source(&inner, p).recursive && inner.removed.is_empty());
}

/// Q48 : sous-dossier ajouté sous un dossier coché dont des fichiers ont été retirés = sa propre ligne (partie Y),
/// jusqu'à ce que le dossier soit ajouté de nouveau, coché.
#[test]
fn sous_dossier_rendu_puis_repris() {
    let mut inner = inner();
    let p = add(&mut inner, r"C:\a", true, true, &[r"C:\a\1.jpg", r"C:\a\s\2.jpg", r"C:\a\s\3.jpg"]);
    let none = HashSet::new();
    assert!(!inner.add_path(r"C:\a\s".into(), true, true, &none), "rien de retiré : déjà dans la liste");
    cross(&mut inner, r"C:\a\s\3.jpg");
    assert!(!inner.add_path(r"C:\a\t".into(), true, true, &none), "rien de retiré sous lui");
    let l = listed(&inner);
    assert!(!inner.add_path(r"C:\a\s\2.jpg".into(), false, true, &l), "fichier encore dans la liste");
    assert!(inner.add_path(r"C:\a\s".into(), true, true, &l));
    let s = inner.sources.last().unwrap().id;
    assert!(source(&inner, s).absorbed_by.is_none() && source(&inner, s).fresh, "sa propre ligne, pas mise de côté");
    assert!(inner.removed.is_empty());
    assert_eq!(owner(&inner, r"C:\a\s\2.jpg"), p, "la partie X reste dans le dossier");
    inner.files.push(ScanFile { path: r"C:\a\s\3.jpg".into(), kind: Kind::Image, ext: "jpg".into(), size: 1, source: s });
    inner.sources.last_mut().unwrap().fresh = false;

    // Case décochée : la partie X va à la ligne du sous-dossier, qui la couvre.
    inner.sources[0].recursive = false;
    inner.release(p);
    assert_eq!(owner(&inner, r"C:\a\s\2.jpg"), s);

    // Dossier ajouté de nouveau, coché : la ligne du sous-dossier le rejoint.
    assert!(inner.add_path(r"C:\a".into(), true, true, &none));
    assert_eq!(source(&inner, s).absorbed_by, Some(p));
    assert_eq!((owner(&inner, r"C:\a\s\2.jpg"), owner(&inner, r"C:\a\s\3.jpg")), (p, p));
}

/// Q48 C : fichier retiré puis ajouté seul = sa propre ligne ; une source mise de côté retrouve la sienne.
#[test]
fn fichier_ou_source_mise_de_cote_rendus() {
    let mut inner = inner();
    let p = add(&mut inner, r"C:\a", true, true, &[r"C:\a\1.jpg", r"C:\a\s\2.jpg"]);
    let s = add(&mut inner, r"C:\a\s", true, true, &[]);
    let t = add(&mut inner, r"C:\a\s\t", true, false, &[]);
    inner.absorb_under(s);
    inner.absorb_under(p);
    cross(&mut inner, r"C:\a\1.jpg");
    let l = listed(&inner);
    assert!(inner.add_path(r"C:\A\1.jpg".into(), false, true, &l));
    assert!(inner.sources.last().unwrap().absorbed_by.is_none());

    cross(&mut inner, r"C:\a\s\2.jpg");
    assert!(inner.add_path(r"C:\a\s".into(), true, false, &l));
    let back = source(&inner, s);
    assert!(back.absorbed_by.is_none() && back.scanning && back.fresh && !back.recursive);
    assert_eq!(source(&inner, t).absorbed_by, Some(p), "ce qu'il avait mis de côté reste au dossier coché");
}

/// Retouche 9 : croix d'un sous-dossier rendu (Q48) sous un dossier coché : ses fichiers restent retirés.
#[test]
fn croix_d_une_ligne_rendue() {
    let mut inner = inner();
    add(&mut inner, r"C:\a", true, true, &[r"C:\a\1.jpg"]);
    let s = add(&mut inner, r"C:\a\s", true, true, &[r"C:\a\s\2.jpg"]);
    let z = add(&mut inner, r"C:\z", true, false, &[r"C:\z\3.jpg"]);
    inner.removed.insert(r"c:\z\4.jpg".into());
    inner.remove_source(s);
    assert!(inner.removed.contains(r"c:\a\s\2.jpg"));
    inner.remove_source(z);
    assert_eq!(inner.removed, HashSet::from([r"c:\a\s\2.jpg".to_string()]), "retraits sous un dossier retiré oubliés");
}

/// Fichiers ignorés vus par deux lignes (ligne à part sous un dossier coché) : comptés une fois.
#[test]
fn ignores_comptes_une_fois() {
    let mut inner = inner();
    add(&mut inner, r"C:\a", true, true, &[]);
    let s = add(&mut inner, r"C:\a\s", true, true, &[]);
    let f = add(&mut inner, r"C:\a\x.txt", false, false, &[]);
    let z = add(&mut inner, r"C:\z", true, false, &[]);
    for (id, n) in [(0, 3), (1, 1), (2, 1), (3, 2)] {
        inner.sources[id].ignored = n;
    }
    assert!(inner.sources.iter().map(|x| x.id).eq([inner.sources[0].id, s, f, z]));
    inner.summarize();
    assert_eq!(inner.snapshot.scan.as_ref().unwrap().ignored, 5);
}
