//! Ce que devient une vidéo (IMP-69, IMP-22) et la liste de ses flux dans la nouvelle version : vidéo réencodée ou
//! recopiée ; pistes son recopiées, ou adaptées si le conteneur ne les accepte pas ; sous-titres en texte gardés
//! (réponse du 09/11), adaptés au conteneur ; image de couverture et polices (MKV) gardées dans le même conteneur. Les
//! flux de données (horloge, géolocalisation continue) ne sont pas repris ; les informations de la vidéo (date, lieu,
//! appareil) et les chapitres le sont (arguments dans `mod.rs`).

use super::encoders::{self, Codec};
use super::probe::{Probe, Stream};
use crate::import::compress::Squeeze;
use crate::import::plan::{VideoRequest, VideoTarget};

/// Cran « Haute » : qualité d'une conversion sans « Compresser les vidéos » (réponse QA du 11/11).
const HIGH: u8 = 3;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Family {
    /// MP4, MOV, 3GP.
    Mp4,
    Matroska,
    Webm,
    Other,
}

#[derive(Debug)]
pub struct Container {
    pub ext: String,
    pub muxer: &'static str,
    pub family: Family,
}

pub fn container_of(ext: &str) -> Option<Container> {
    let (muxer, family) = match ext {
        "mp4" | "m4v" => ("mp4", Family::Mp4),
        "mov" => ("mov", Family::Mp4),
        "3gp" => ("3gp", Family::Mp4),
        "mkv" => ("matroska", Family::Matroska),
        "webm" => ("webm", Family::Webm),
        "avi" => ("avi", Family::Other),
        "flv" => ("flv", Family::Other),
        "ts" | "m2ts" | "mts" => ("mpegts", Family::Other),
        _ => return None,
    };
    Some(Container { ext: ext.to_owned(), muxer, family })
}

#[derive(Debug)]
pub enum Job {
    /// Réencodage ; `compressed` : « Compresser les vidéos » (nom « _c ») ; `converted` : autre format que l'original.
    Encode { codec: Codec, out: Container, notch: u8, compressed: bool, converted: bool },
    /// Même codec, autre enveloppe : flux recopiés sans réencodage (réponse Q2 du 10/11), toujours gardé.
    Remux { out: Container },
}

impl Job {
    pub fn out(&self) -> &Container {
        match self {
            Job::Encode { out, .. } | Job::Remux { out } => out,
        }
    }

    /// Dans un autre conteneur que l'original : chaque flux doit y être accepté.
    fn moved(&self) -> bool {
        matches!(self, Job::Remux { .. } | Job::Encode { converted: true, .. })
    }
}

/// Que faire de cette vidéo ; `Err` : rien (`None`), ou ancien format jamais compressé (`Unsupported`, réponse QB).
pub fn plan(probe: &Probe, ext: &str, request: VideoRequest) -> Result<Job, Option<Squeeze>> {
    let Some(main) = probe.main_video() else { return Err(None) };
    let source = Codec::of(&main.codec_name);
    if let Some(target) = request.convert {
        let (codec, box_ext) = match target {
            VideoTarget::H264 => (Codec::H264, "mp4"),
            VideoTarget::H265 => (Codec::Hevc, "mp4"),
            VideoTarget::Webm => (Codec::Vp9, "webm"),
            VideoTarget::Av1 => (Codec::Av1, "mp4"),
        };
        let same_box = matches!((ext, box_ext), ("mp4" | "m4v", "mp4") | ("webm", "webm"));
        if source == Some(codec) && same_box {
            // Déjà dans le format choisi : seulement la compression, si elle est demandée.
            let notch = request.quality.ok_or(None)?;
            let out = container_of(ext).ok_or(None)?;
            return Ok(Job::Encode { codec, out, notch, compressed: true, converted: false });
        }
        let out = container_of(box_ext).ok_or(None)?;
        if source == Some(codec) && request.quality.is_none() {
            return Ok(Job::Remux { out });
        }
        let notch = request.quality.unwrap_or(HIGH);
        return Ok(Job::Encode { codec, out, notch, compressed: request.quality.is_some(), converted: true });
    }
    let notch = request.quality.ok_or(None)?;
    match (source, container_of(ext)) {
        (Some(codec), Some(out)) => Ok(Job::Encode { codec, out, notch, compressed: true, converted: false }),
        _ => Err(Some(Squeeze::Unsupported)),
    }
}

fn copy(n: usize) -> Vec<String> {
    vec![format!("-c:{n}"), "copy".into()]
}

fn codec(n: usize, name: &str, bitrate: Option<&str>) -> Vec<String> {
    let mut a = vec![format!("-c:{n}"), name.to_owned()];
    if let Some(b) = bitrate {
        a.extend([format!("-b:{n}"), b.to_owned()]);
    }
    a
}

/// Son : recopié si le conteneur l'accepte (MP4 : le plus compatible ; WebM : Opus, Vorbis), sinon réencodé.
fn audio(s: &Stream, family: Family, moved: bool, n: usize) -> Vec<String> {
    let fits = !moved
        || match family {
            Family::Mp4 => matches!(s.codec_name.as_str(), "aac" | "mp3" | "ac3" | "eac3" | "alac"),
            Family::Webm => matches!(s.codec_name.as_str(), "opus" | "vorbis"),
            _ => true,
        };
    match (fits, family) {
        (true, _) => copy(n),
        (false, Family::Webm) => codec(n, "libopus", Some("160k")),
        (false, _) => codec(n, "aac", Some("192k")),
    }
}

/// Sous-titres : recopiés dans le même conteneur ; ailleurs, seulement ceux en texte (les sous-titres en images ne vont
/// ni en MP4 ni en WebM).
fn subtitle(s: &Stream, family: Family, moved: bool, n: usize) -> Option<Vec<String>> {
    if !moved || family == Family::Matroska {
        return Some(copy(n));
    }
    let text = matches!(s.codec_name.as_str(), "subrip" | "ass" | "ssa" | "webvtt" | "mov_text" | "text");
    match family {
        Family::Mp4 if text => Some(codec(n, "mov_text", None)),
        Family::Webm if text => Some(codec(n, "webvtt", None)),
        _ => None,
    }
}

/// Arguments ffmpeg, après l'entrée : flux repris (`-map`) et leur traitement ; `encoder` : pour un réencodage.
pub fn stream_args(probe: &Probe, job: &Job, encoder: Option<&str>) -> Vec<String> {
    let family = job.out().family;
    let moved = job.moved();
    let mut args = Vec::new();
    let mut n = 0;
    for s in &probe.streams {
        let what = match s.codec_type.as_str() {
            "video" if s.is_cover() => (!moved && matches!(family, Family::Mp4 | Family::Matroska)).then(|| copy(n)),
            "video" => Some(match (job, encoder) {
                (Job::Encode { codec, notch, .. }, Some(enc)) => encoders::video_args(enc, *codec, *notch, s.ten_bit(), n, family == Family::Mp4),
                _ => copy(n),
            }),
            "audio" => Some(audio(s, family, moved, n)),
            "subtitle" => subtitle(s, family, moved, n),
            "attachment" if family == Family::Matroska => Some(copy(n)),
            _ => None,
        };
        if let Some(what) = what {
            args.extend(["-map".to_owned(), format!("0:{}", s.index)]);
            args.extend(what);
            n += 1;
        }
    }
    args
}
