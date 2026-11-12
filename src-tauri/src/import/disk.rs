//! Type de disque d'un dossier à importer (IMP-06, réponses B du 12/11). Mesures du 11/11 (D-068) : sur un SSD, lire 4
//! fichiers en même temps va 2,5 fois plus vite ; sur un disque dur, c'est plus lent (111 Mo/s avec 1 fil, 78 avec 4).
//! Lu en parallèle : un disque fixe (interne, ou SSD externe en USB) dont Windows dit qu'il n'a pas de « pénalité de
//! déplacement » (pas de tête de lecture à déplacer : un SSD). Tout le reste (disque dur, clé USB, carte mémoire,
//! emplacement réseau, lettre `subst`, réponse incertaine ou absente) : un fichier à la fois.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Réponses déjà obtenues pendant un import, par dossier (un volume peut être monté dans un dossier d'un autre).
#[derive(Default)]
pub struct Disks(HashMap<PathBuf, bool>);

impl Disks {
    /// Ce fichier est-il sur un SSD ?
    pub fn ssd(&mut self, file: &Path) -> bool {
        let dir = file.parent().unwrap_or(file).to_path_buf();
        *self.0.entry(dir).or_insert_with_key(|dir| is_ssd(dir))
    }
}

#[cfg(windows)]
fn is_ssd(dir: &Path) -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FILE_SHARE_READ, FILE_SHARE_WRITE, GetDriveTypeW, GetVolumeNameForVolumeMountPointW, GetVolumePathNameW, OPEN_EXISTING,
    };
    use windows_sys::Win32::System::IO::DeviceIoControl;
    use windows_sys::Win32::System::Ioctl::{
        DEVICE_SEEK_PENALTY_DESCRIPTOR, IOCTL_STORAGE_QUERY_PROPERTY, PropertyStandardQuery, STORAGE_PROPERTY_QUERY, StorageDeviceSeekPenaltyProperty,
    };
    /// `GetDriveTypeW` : disque fixe (ni amovible, ni réseau, ni lecteur de CD).
    const DRIVE_FIXED: u32 = 3;

    let wide: Vec<u16> = dir.as_os_str().encode_wide().chain([0]).collect();
    let mut mount = [0u16; 1024];
    let mut volume = [0u16; 64];
    // SAFETY : chaînes terminées par un zéro, tampons de la taille annoncée, poignée refermée.
    unsafe {
        if GetVolumePathNameW(wide.as_ptr(), mount.as_mut_ptr(), mount.len() as u32) == 0 || GetDriveTypeW(mount.as_ptr()) != DRIVE_FIXED {
            return false;
        }
        // « \\?\Volume{…}\ » : sans la barre finale, c'est le volume lui-même qu'on ouvre (une lettre `subst` n'en a pas).
        if GetVolumeNameForVolumeMountPointW(mount.as_ptr(), volume.as_mut_ptr(), volume.len() as u32) == 0 {
            return false;
        }
        let end = volume.iter().position(|&c| c == 0).unwrap_or(volume.len());
        if end > 0 && volume[end - 1] == u16::from(b'\\') {
            volume[end - 1] = 0;
        }
        // Aucun droit demandé : on interroge le disque sans rien lire ni écrire.
        let handle = CreateFileW(volume.as_ptr(), 0, FILE_SHARE_READ | FILE_SHARE_WRITE, std::ptr::null(), OPEN_EXISTING, 0, std::ptr::null_mut());
        if handle == INVALID_HANDLE_VALUE {
            return false;
        }
        let query = STORAGE_PROPERTY_QUERY { PropertyId: StorageDeviceSeekPenaltyProperty, QueryType: PropertyStandardQuery, AdditionalParameters: [0] };
        let mut answer = DEVICE_SEEK_PENALTY_DESCRIPTOR { Version: 0, Size: 0, IncursSeekPenalty: true };
        let mut returned = 0u32;
        let ok = DeviceIoControl(
            handle,
            IOCTL_STORAGE_QUERY_PROPERTY,
            (&raw const query).cast(),
            size_of::<STORAGE_PROPERTY_QUERY>() as u32,
            (&raw mut answer).cast(),
            size_of::<DEVICE_SEEK_PENALTY_DESCRIPTOR>() as u32,
            &mut returned,
            std::ptr::null_mut(),
        ) != 0;
        CloseHandle(handle);
        ok && returned as usize >= size_of::<DEVICE_SEEK_PENALTY_DESCRIPTOR>() && !answer.IncursSeekPenalty
    }
}

#[cfg(not(windows))]
fn is_ssd(_dir: &Path) -> bool {
    false
}
