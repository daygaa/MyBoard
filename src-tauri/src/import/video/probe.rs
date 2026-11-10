//! Lecture d'une vidéo par ffprobe (IMP-69, IMP-22) : ses flux (type, codec, format des pixels, image de couverture) et
//! sa durée (barre de progression du fichier, IMP-41).

use std::path::Path;

use anyhow::bail;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Probe {
    #[serde(default)]
    pub streams: Vec<Stream>,
    #[serde(default)]
    format: Format,
}

#[derive(Deserialize, Default)]
struct Format {
    duration: Option<String>,
}

#[derive(Deserialize)]
pub struct Stream {
    pub index: usize,
    #[serde(default)]
    pub codec_type: String,
    #[serde(default)]
    pub codec_name: String,
    #[serde(default)]
    pub pix_fmt: String,
    #[serde(default)]
    disposition: Disposition,
}

#[derive(Deserialize, Default)]
struct Disposition {
    #[serde(default)]
    attached_pic: u8,
}

impl Stream {
    /// Image de couverture (pochette), rangée comme un flux vidéo.
    pub fn is_cover(&self) -> bool {
        self.disposition.attached_pic != 0
    }

    /// Plus de 8 bits par couleur (vidéos HDR des téléphones…).
    pub fn ten_bit(&self) -> bool {
        self.pix_fmt.contains("10") || self.pix_fmt.contains("12")
    }
}

impl Probe {
    pub fn duration(&self) -> Option<f64> {
        self.format.duration.as_deref()?.parse().ok().filter(|d: &f64| *d > 0.0)
    }

    /// Flux vidéo principal (pas une image de couverture).
    pub fn main_video(&self) -> Option<&Stream> {
        self.streams.iter().find(|s| s.codec_type == "video" && !s.is_cover())
    }
}

pub fn probe(ffprobe: &Path, path: &Path) -> anyhow::Result<Probe> {
    let output = crate::ffmpeg::command(ffprobe)
        .args(["-v", "error", "-print_format", "json", "-show_streams", "-show_format"])
        .arg(path)
        .output()?;
    if !output.status.success() {
        bail!("ffprobe : {}", String::from_utf8_lossy(&output.stderr).trim());
    }
    Ok(serde_json::from_slice(&output.stdout)?)
}
