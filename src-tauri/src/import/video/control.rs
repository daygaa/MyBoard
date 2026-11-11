//! Contrôle du processus ffmpeg (IMP-42, IMP-43) : mis en pause et repris tel quel (fonctions de Windows
//! `NtSuspendProcess` / `NtResumeProcess`), et rattaché à un « job » Windows fermé avec MyBoard : si MyBoard est fermé
//! ou plante, ffmpeg s'arrête aussitôt (aucun processus ne reste en arrière-plan, aucun fichier provisoire tenu ouvert).

use std::process::Child;

#[cfg(windows)]
mod win {
    use std::ffi::c_void;

    pub type Handle = *mut c_void;

    #[repr(C)]
    #[derive(Default)]
    pub struct BasicLimits {
        pub per_process_user_time: i64,
        pub per_job_user_time: i64,
        pub flags: u32,
        pub min_working_set: usize,
        pub max_working_set: usize,
        pub active_process_limit: u32,
        pub affinity: usize,
        pub priority_class: u32,
        pub scheduling_class: u32,
    }

    #[repr(C)]
    #[derive(Default)]
    pub struct ExtendedLimits {
        pub basic: BasicLimits,
        pub io: [u64; 6],
        pub process_memory_limit: usize,
        pub job_memory_limit: usize,
        pub peak_process_memory: usize,
        pub peak_job_memory: usize,
    }

    pub const EXTENDED_LIMIT_INFORMATION: i32 = 9;
    pub const KILL_ON_JOB_CLOSE: u32 = 0x2000;

    #[link(name = "kernel32")]
    unsafe extern "system" {
        pub fn CreateJobObjectW(attributes: *const c_void, name: *const u16) -> Handle;
        pub fn SetInformationJobObject(job: Handle, class: i32, info: *const c_void, len: u32) -> i32;
        pub fn AssignProcessToJobObject(job: Handle, process: Handle) -> i32;
    }

    #[link(name = "ntdll")]
    unsafe extern "system" {
        pub fn NtSuspendProcess(process: Handle) -> i32;
        pub fn NtResumeProcess(process: Handle) -> i32;
    }
}

/// Rattache ffmpeg au job de MyBoard (créé une fois ; jamais fermé avant la fin de MyBoard).
#[cfg(windows)]
pub fn bind(child: &Child) {
    use std::os::windows::io::AsRawHandle;
    use std::sync::OnceLock;
    struct Job(usize);
    static JOB: OnceLock<Job> = OnceLock::new();
    let job = JOB.get_or_init(|| unsafe {
        let job = win::CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if !job.is_null() {
            let mut limits = win::ExtendedLimits::default();
            limits.basic.flags = win::KILL_ON_JOB_CLOSE;
            let size = std::mem::size_of::<win::ExtendedLimits>() as u32;
            win::SetInformationJobObject(job, win::EXTENDED_LIMIT_INFORMATION, (&raw const limits).cast(), size);
        }
        Job(job as usize)
    });
    if job.0 != 0 {
        unsafe { win::AssignProcessToJobObject(job.0 as win::Handle, child.as_raw_handle()) };
    }
}

/// Met ffmpeg en pause (`true`) ou le relance (`false`).
#[cfg(windows)]
pub fn suspend(child: &Child, paused: bool) {
    use std::os::windows::io::AsRawHandle;
    let handle = child.as_raw_handle();
    unsafe {
        if paused {
            win::NtSuspendProcess(handle);
        } else {
            win::NtResumeProcess(handle);
        }
    }
}

#[cfg(not(windows))]
pub fn bind(_child: &Child) {}

#[cfg(not(windows))]
pub fn suspend(_child: &Child, _paused: bool) {}
