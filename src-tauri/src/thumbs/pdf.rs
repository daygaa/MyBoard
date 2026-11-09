//! Miniature d'un PDF (LIB-17) : la 1re page, rendue par le moteur PDF de Windows (`Windows.Data.Pdf`,
//! présent dans Windows 10 et 11 : rien à installer ni à fournir avec MyBoard).

use std::cell::Cell;
use std::path::Path;

use image::DynamicImage;
use windows::Data::Pdf::{PdfDocument, PdfPageRenderOptions};
use windows::Storage::StorageFile;
use windows::Storage::Streams::{DataReader, InMemoryRandomAccessStream};
use windows::Win32::System::Com::{COINIT_MULTITHREADED, CoInitializeEx};
use windows::core::HSTRING;

use super::image::decode;

thread_local! {
    static READY: Cell<bool> = const { Cell::new(false) };
}

/// Les API de Windows utilisées ici demandent que le fil soit prêt pour COM (une fois par fil).
fn init_thread() {
    READY.with(|ready| {
        if !ready.get() {
            // Déjà prêt dans un autre mode : l'appel échoue sans conséquence.
            let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
            ready.set(true);
        }
    });
}

/// 1re page rendue à `width` pixels de large (fond blanc) ; une page en hauteur ne garde que son haut,
/// en carré : la vignette montre le titre plutôt que le milieu de la page.
pub fn first_page(path: &Path, width: u32) -> anyhow::Result<DynamicImage> {
    init_thread();
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path))?.join()?;
    let document = PdfDocument::LoadFromFileAsync(&file)?.join()?;
    let page = document.GetPage(0)?;
    let options = PdfPageRenderOptions::new()?;
    options.SetDestinationWidth(width)?;
    let stream = InMemoryRandomAccessStream::new()?;
    page.RenderWithOptionsToStreamAsync(&stream, &options)?.join()?;
    let size = u32::try_from(stream.Size()?)?;
    let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0)?)?;
    reader.LoadAsync(size)?.join()?;
    let mut png = vec![0u8; size as usize];
    reader.ReadBytes(&mut png)?;
    let img = decode(&png)?;
    let (w, h) = (img.width(), img.height());
    Ok(if h > w { img.crop_imm(0, 0, w, w) } else { img })
}
