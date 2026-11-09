//! Aperçus de la liste des fichiers avant l'import (IMP-10, IMP-13) : d'abord la miniature de Windows (celle de
//! l'Explorateur : 2 à 17 ms si elle est déjà dans son cache, et bien moins de processeur que ffmpeg pour une vidéo ;
//! mesures du 09/11, D-060) ; si Windows n'en a pas, image ou PDF faits par MyBoard ; sinon l'interface garde l'icône.
//! Deux fils dédiés, au plus : la liste ne charge jamais le PC comme un import.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{Sender, SyncSender, channel, sync_channel};
use std::sync::{Arc, Mutex, OnceLock};

/// Côté demandé à Windows (la ligne de la liste montre 44 px ; marge pour les écrans à forte densité).
pub const SIDE: i32 = 128;
/// Aperçu agrandi au survol d'une miniature (IMP-59) : la taille que garde déjà le cache de l'Explorateur.
pub const LARGE: i32 = 256;
const WORKERS: usize = 2;

type Job = (PathBuf, i32, SyncSender<Option<Vec<u8>>>);
static QUEUE: OnceLock<Mutex<Sender<Job>>> = OnceLock::new();

fn queue() -> &'static Mutex<Sender<Job>> {
    QUEUE.get_or_init(|| {
        let (tx, rx) = channel::<Job>();
        let rx = Arc::new(Mutex::new(rx));
        for index in 0..WORKERS {
            let rx = rx.clone();
            let _ = std::thread::Builder::new().name(format!("apercus-import-{index}")).spawn(move || {
                crate::thumbs::lower_thread_priority();
                #[cfg(windows)]
                // Fil prêt pour COM (une fois par fil), en mode « multithread » comme les miniatures des PDF.
                let _ = unsafe { windows::Win32::System::Com::CoInitializeEx(None, windows::Win32::System::Com::COINIT_MULTITHREADED) };
                loop {
                    let job = rx.lock().unwrap().recv();
                    let Ok((path, side, reply)) = job else { break };
                    let _ = reply.send(make(&path, side));
                }
            });
        }
        Mutex::new(tx)
    })
}

/// Aperçu WebP d'un fichier de la liste, de côté `side` (`SIDE` ou `LARGE`) ; `None` : pas d'aperçu.
pub fn preview(path: &Path, side: i32) -> Option<Vec<u8>> {
    let (reply, answer) = sync_channel(1);
    queue().lock().unwrap().send((path.to_path_buf(), side, reply)).ok()?;
    answer.recv().ok().flatten()
}

fn make(path: &Path, side: i32) -> Option<Vec<u8>> {
    #[cfg(windows)]
    if let Ok(webp) = shell::thumbnail(path, side) {
        return Some(webp);
    }
    if side == SIDE { crate::thumbs::list_preview(path).ok() } else { crate::thumbs::list_preview_fit(path, side as u32).ok() }
}

#[cfg(windows)]
mod shell {
    use std::ffi::c_void;
    use std::path::Path;

    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::{
        BI_RGB, BITMAP, BITMAPINFO, BITMAPINFOHEADER, CreateCompatibleDC, DIB_RGB_COLORS, DeleteDC, DeleteObject, GetDIBits,
        GetObjectW, HBITMAP,
    };
    use windows::Win32::System::Com::IBindCtx;
    use windows::Win32::UI::Shell::{IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_THUMBNAILONLY};
    use windows::core::HSTRING;

    /// Miniature de l'Explorateur (sans l'icône du type de fichier), en WebP.
    pub fn thumbnail(path: &Path, side: i32) -> anyhow::Result<Vec<u8>> {
        // SAFETY : appels à l'Explorateur de Windows ; l'image rendue est libérée ici.
        unsafe {
            let factory: IShellItemImageFactory = SHCreateItemFromParsingName(&HSTRING::from(path), None::<&IBindCtx>)?;
            let bitmap = factory.GetImage(SIZE { cx: side, cy: side }, SIIGBF_THUMBNAILONLY)?;
            let pixels = rgba(bitmap);
            let _ = DeleteObject(bitmap.into());
            let (w, h, rgba) = pixels?;
            Ok(webp::Encoder::from_rgba(&rgba, w, h).encode(78.0).to_vec())
        }
    }

    unsafe fn rgba(bitmap: HBITMAP) -> anyhow::Result<(u32, u32, Vec<u8>)> {
        let mut info = BITMAP::default();
        let size = size_of::<BITMAP>() as i32;
        if unsafe { GetObjectW(bitmap.into(), size, Some(&mut info as *mut BITMAP as *mut c_void)) } == 0 {
            anyhow::bail!("image de Windows illisible");
        }
        let (w, h) = (info.bmWidth, info.bmHeight.abs());
        let mut header = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h, // lignes de haut en bas
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut buf = vec![0u8; (w * h * 4) as usize];
        let dc = unsafe { CreateCompatibleDC(None) };
        let lines =
            unsafe { GetDIBits(dc, bitmap, 0, h as u32, Some(buf.as_mut_ptr() as *mut c_void), &mut header, DIB_RGB_COLORS) };
        let _ = unsafe { DeleteDC(dc) };
        if lines == 0 {
            anyhow::bail!("pixels de Windows illisibles");
        }
        // Windows donne du BGRA ; une miniature sans transparence a souvent un alpha à 0 : elle est alors opaque.
        let opaque = buf.as_chunks::<4>().0.iter().all(|p| p[3] == 0);
        for p in buf.as_chunks_mut::<4>().0 {
            p.swap(0, 2);
            if opaque {
                p[3] = 255;
            }
        }
        Ok((w as u32, h as u32, buf))
    }
}
