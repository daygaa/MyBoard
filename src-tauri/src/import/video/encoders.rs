//! Encodeurs vidéo (IMP-69, IMP-22) : la carte graphique quand elle sait produire le codec, sinon le processeur (réponse
//! Q4 du 10/11 ; le choix ira dans les Paramètres, SET-05). NVIDIA (NVENC), puis Intel (Quick Sync) et AMD (AMF) pour le
//! H.264 et le H.265 (IMP-72, 11/11 : réglages documentés de ffmpeg, non vérifiables sur ce PC ; un échec repasse au
//! processeur) ; l'AV1 sur Intel et AMD reste au processeur (échelles de qualité incertaines). Chaque encodeur a son échelle de
//! qualité (CRF 0–51 pour x264 et x265, 0–63 pour VP8, VP9 et AV1, CQ pour NVENC ; remarque de l'utilisateur du 11/11) :
//! une table de 5 crans par encodeur, de Minimale à Maximale (plus la valeur est basse, meilleure est l'image).

use std::path::Path;
use std::sync::Mutex;

/// Codecs vidéo que MyBoard sait réencoder (anciens formats : jamais compressés, réponse QB du 11/11).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Codec {
    H264,
    Hevc,
    Vp8,
    Vp9,
    Av1,
}

impl Codec {
    pub fn of(name: &str) -> Option<Codec> {
        Some(match name {
            "h264" => Codec::H264,
            "hevc" => Codec::Hevc,
            "vp8" => Codec::Vp8,
            "vp9" => Codec::Vp9,
            "av1" => Codec::Av1,
            _ => return None,
        })
    }

    /// Encodeurs des cartes graphiques, dans l'ordre d'essai.
    fn gpus(self) -> &'static [&'static str] {
        match self {
            Codec::H264 => &["h264_nvenc", "h264_qsv", "h264_amf"],
            Codec::Hevc => &["hevc_nvenc", "hevc_qsv", "hevc_amf"],
            Codec::Av1 => &["av1_nvenc"],
            Codec::Vp8 | Codec::Vp9 => &[],
        }
    }

    pub fn cpu(self) -> &'static str {
        match self {
            Codec::H264 => "libx264",
            Codec::Hevc => "libx265",
            Codec::Vp8 => "libvpx",
            Codec::Vp9 => "libvpx-vp9",
            Codec::Av1 => "libaom-av1",
        }
    }

    /// 10 bits gardés, sauf en H.264 (compatibilité totale, et NVENC ne sait pas l'écrire) et en VP8.
    fn keeps_ten_bit(self) -> bool {
        !matches!(self, Codec::H264 | Codec::Vp8)
    }
}

/// Encodeur à utiliser : la carte graphique si elle sait produire ce codec (essayée une fois par lancement).
pub fn choose(ffmpeg: &Path, codec: Codec) -> &'static str {
    codec.gpus().iter().copied().find(|gpu| gpu_works(ffmpeg, gpu)).unwrap_or(codec.cpu())
}

fn gpu_works(ffmpeg: &Path, encoder: &'static str) -> bool {
    static SEEN: Mutex<Vec<(&str, bool)>> = Mutex::new(Vec::new());
    if let Some((_, ok)) = SEEN.lock().unwrap().iter().find(|(e, _)| *e == encoder) {
        return *ok;
    }
    let ok = crate::ffmpeg::command(ffmpeg)
        .args(["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=0.2", "-frames:v", "2", "-c:v", encoder])
        .args(["-f", "null", "-"])
        .output()
        .is_ok_and(|o| o.status.success());
    SEEN.lock().unwrap().push((encoder, ok));
    ok
}

/// Crans Minimale, Basse, Moyenne, Haute, Maximale.
fn scale(encoder: &str) -> [u8; 5] {
    match encoder {
        "libx264" => [30, 27, 23, 20, 17],
        "h264_nvenc" | "h264_amf" => [33, 29, 25, 22, 19],
        "h264_qsv" => [30, 27, 23, 20, 17],
        "hevc_qsv" => [32, 29, 26, 23, 20],
        "libx265" => [32, 29, 26, 23, 20],
        "hevc_nvenc" | "hevc_amf" => [35, 31, 28, 25, 22],
        "av1_nvenc" => [40, 35, 30, 26, 22],
        "libvpx" => [44, 36, 28, 20, 12],
        "libvpx-vp9" => [44, 39, 34, 29, 24],
        _ => [46, 40, 34, 28, 23], // libaom-av1
    }
}

/// Arguments d'encodage du flux de sortie `out` ; `mp4` : conteneur MP4 ou MOV (étiquette « hvc1 » du H.265, lue par
/// Windows et Apple).
pub fn video_args(encoder: &str, codec: Codec, notch: u8, ten_bit: bool, out: usize, mp4: bool) -> Vec<String> {
    let q = scale(encoder)[usize::from(notch.min(4))].to_string();
    let deep = ten_bit && codec.keeps_ten_bit();
    let s = |name: &str| format!("-{name}:{out}");
    let mut a: Vec<String> = vec![s("c"), encoder.into()];
    let mut add = |pairs: &[(&str, &str)]| a.extend(pairs.iter().flat_map(|(k, v)| [s(k), (*v).to_owned()]));
    match encoder {
        "h264_nvenc" | "hevc_nvenc" | "av1_nvenc" => {
            add(&[("preset", "p5"), ("tune", "hq"), ("rc", "vbr"), ("cq", &q), ("b", "0"), ("spatial_aq", "1")]);
            add(&[("pix_fmt", if deep { "p010le" } else { "yuv420p" })]);
        }
        // Intel : qualité constante (ICQ) ; AMD : quantification constante (CQP).
        "h264_qsv" | "hevc_qsv" => add(&[("preset", "medium"), ("global_quality", &q), ("pix_fmt", if deep { "p010le" } else { "nv12" })]),
        "h264_amf" => add(&[("quality", "quality"), ("rc", "cqp"), ("qp_i", &q), ("qp_p", &q), ("qp_b", &q), ("pix_fmt", "nv12")]),
        "hevc_amf" => add(&[("quality", "quality"), ("rc", "cqp"), ("qp_i", &q), ("qp_p", &q), ("pix_fmt", if deep { "p010le" } else { "nv12" })]),
        "libx264" => add(&[("preset", "medium"), ("crf", &q), ("pix_fmt", "yuv420p")]),
        "libx265" => add(&[("preset", "fast"), ("crf", &q), ("x265-params", "log-level=error")]),
        "libvpx" => add(&[("crf", &q), ("b", "50M"), ("deadline", "good"), ("cpu-used", "4"), ("pix_fmt", "yuv420p")]),
        "libvpx-vp9" => add(&[("crf", &q), ("b", "0"), ("deadline", "good"), ("cpu-used", "4"), ("row-mt", "1")]),
        _ => add(&[("crf", &q), ("b", "0"), ("cpu-used", "6"), ("row-mt", "1")]), // libaom-av1
    }
    if !encoder.ends_with("nvenc") && !encoder.ends_with("qsv") && !encoder.ends_with("amf") && !matches!(encoder, "libx264" | "libvpx") {
        add(&[("pix_fmt", if deep { "yuv420p10le" } else { "yuv420p" })]);
    }
    if codec == Codec::Hevc && mp4 {
        add(&[("tag", "hvc1")]);
    }
    // Images par seconde gardées telles quelles, même variables (vidéos de téléphone, IMP-25).
    add(&[("fps_mode", "passthrough")]);
    a
}
