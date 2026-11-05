// Nom du son de MyBoard dans le mélangeur de volume de Windows (AUD-02, choix de l'utilisateur du 05/11) : le son des
// vidéos est produit par un processus de WebView2 (msedgewebview2.exe, son « service audio », lancé par MyBoard), que
// Windows affiche sous « MSEDGEWEBVIEW2 ». Une tâche de fond renomme ses flux « MyBoard », avec l'icône de MyBoard
// (API audio de Windows : SetDisplayName / SetIconPath, essayée le 05/11 depuis un autre processus). Elle dort tant
// que Windows ne la prévient pas : un flux est créé (1re lecture…), une sortie son apparaît ou change. Rien au repos
// (mesuré : une vérification chaque seconde coûtait 156 ms de processeur toutes les 20 s). Le nom tient tant que le
// flux existe. SteelSeries GG, lui, affiche le nom du programme : il garde « MSEDGEWEBVIEW2 » (voir AUD-02).

use std::collections::HashMap;
use std::sync::mpsc::{Sender, channel};
use std::time::Duration;

use windows::Win32::Foundation::PROPERTYKEY;
use windows::Win32::Media::Audio::{
    DEVICE_STATE, DEVICE_STATE_ACTIVE, EDataFlow, ERole, IAudioSessionControl, IAudioSessionControl2, IAudioSessionManager2, IAudioSessionNotification,
    IAudioSessionNotification_Impl, IMMDeviceEnumerator, IMMNotificationClient, IMMNotificationClient_Impl, MMDeviceEnumerator, eRender,
};
use windows::Win32::System::Com::{CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoTaskMemFree};
use windows::core::{Interface, PCWSTR, Ref, implement};
use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS};

const NAME: &str = "MyBoard";
/// Après un signal de Windows, on laisse le flux s'installer et on regroupe les signaux rapprochés.
const SETTLE: Duration = Duration::from_millis(150);

/// Ce qui réveille la tâche.
enum Wake {
    /// Une sortie son apparaît, disparaît ou change : on reprend toutes les sorties.
    Outputs,
    /// Un flux vient d'être créé sur une sortie.
    Session,
}

/// Lance la tâche de fond (une fois, au démarrage).
pub fn start() {
    // « chemin,0 » (1re icône du fichier) : avec le chemin seul, le mélangeur de Windows garde l'icône de WebView2
    // (essai avec l'utilisateur le 05/11 : chemin seul → icône de WebView2, « ,0 » → icône de MyBoard).
    let icon = std::env::current_exe().map(|p| format!("{},0", p.display())).unwrap_or_default();
    let _ = std::thread::Builder::new().name("nom-du-son".into()).spawn(move || {
        // SAFETY : COM est initialisé pour ce fil, qui garde ses objets jusqu'à la fermeture de MyBoard.
        if unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_err() {
            return;
        }
        let _ = watch(&wide(NAME), &wide(&icon));
    });
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain([0]).collect()
}

/// Inscrit la tâche auprès de Windows, renomme ce qui existe déjà, puis attend les signaux.
fn watch(name: &[u16], icon: &[u16]) -> windows::core::Result<()> {
    let (tx, rx) = channel();
    // SAFETY : appels COM classiques ; les inscriptions vivent aussi longtemps que la tâche (toute la session).
    let devices: IMMDeviceEnumerator = unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)? };
    let outputs_changed: IMMNotificationClient = OutputsChanged(tx.clone()).into();
    unsafe { devices.RegisterEndpointNotificationCallback(&outputs_changed)? };
    let session_created: IAudioSessionNotification = SessionCreated(tx).into();
    let mut managers = listen(&devices, &session_created)?;
    let mut ours = Ours::default();
    let _ = rename(&managers, name, icon, &mut ours);
    while let Ok(wake) = rx.recv() {
        std::thread::sleep(SETTLE);
        let mut outputs = matches!(wake, Wake::Outputs);
        while let Ok(more) = rx.try_recv() {
            outputs |= matches!(more, Wake::Outputs);
        }
        if outputs {
            for manager in &managers {
                // SAFETY : désinscription de l'objet inscrit plus haut sur ce même gestionnaire.
                let _ = unsafe { manager.UnregisterSessionNotification(&session_created) };
            }
            managers = listen(&devices, &session_created).unwrap_or_default();
            ours.known.clear();
        }
        let _ = rename(&managers, name, icon, &mut ours);
    }
    Ok(())
}

/// Les gestionnaires de flux des sorties son actives, chacun avec la notification « flux créé ».
fn listen(devices: &IMMDeviceEnumerator, session_created: &IAudioSessionNotification) -> windows::core::Result<Vec<IAudioSessionManager2>> {
    let mut managers = Vec::new();
    // SAFETY : appels COM classiques sur des interfaces valides.
    unsafe {
        let outputs = devices.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
        for i in 0..outputs.GetCount()? {
            let Ok(manager) = outputs.Item(i).and_then(|d| d.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)) else { continue };
            // Windows ne prévient d'un nouveau flux qu'après une première lecture de la liste des flux.
            let _ = manager.GetSessionEnumerator();
            if manager.RegisterSessionNotification(session_created).is_ok() {
                managers.push(manager);
            }
        }
    }
    Ok(managers)
}

/// Les flux des processus de MyBoard qui ne s'appellent pas encore « MyBoard ».
fn rename(managers: &[IAudioSessionManager2], name: &[u16], icon: &[u16], ours: &mut Ours) -> windows::core::Result<()> {
    // SAFETY : appels COM classiques ; la chaîne rendue par GetDisplayName est libérée.
    unsafe {
        for manager in managers {
            let sessions = manager.GetSessionEnumerator()?;
            for j in 0..sessions.GetCount()? {
                let Ok(session) = sessions.GetSession(j)?.cast::<IAudioSessionControl2>() else { continue };
                let pid = session.GetProcessId().unwrap_or(0);
                if pid == 0 || !ours.contains(pid) {
                    continue;
                }
                let current = session.GetDisplayName()?;
                let named = current.to_string().is_ok_and(|n| n == NAME);
                CoTaskMemFree(Some(current.0 as *const _));
                if !named {
                    session.SetDisplayName(PCWSTR(name.as_ptr()), std::ptr::null())?;
                    session.SetIconPath(PCWSTR(icon.as_ptr()), std::ptr::null())?;
                }
            }
        }
    }
    Ok(())
}

/// Windows prévient d'un flux créé (appelé sur un fil de Windows : on passe seulement le signal).
#[implement(IAudioSessionNotification)]
struct SessionCreated(Sender<Wake>);

impl IAudioSessionNotification_Impl for SessionCreated_Impl {
    fn OnSessionCreated(&self, _session: Ref<IAudioSessionControl>) -> windows::core::Result<()> {
        let _ = self.0.send(Wake::Session);
        Ok(())
    }
}

/// Windows prévient d'un changement des sorties son (casque branché, sortie par défaut changée…).
#[implement(IMMNotificationClient)]
struct OutputsChanged(Sender<Wake>);

impl IMMNotificationClient_Impl for OutputsChanged_Impl {
    fn OnDeviceStateChanged(&self, _id: &PCWSTR, _state: DEVICE_STATE) -> windows::core::Result<()> {
        let _ = self.0.send(Wake::Outputs);
        Ok(())
    }
    fn OnDeviceAdded(&self, _id: &PCWSTR) -> windows::core::Result<()> {
        let _ = self.0.send(Wake::Outputs);
        Ok(())
    }
    fn OnDeviceRemoved(&self, _id: &PCWSTR) -> windows::core::Result<()> {
        let _ = self.0.send(Wake::Outputs);
        Ok(())
    }
    fn OnDefaultDeviceChanged(&self, _flow: EDataFlow, _role: ERole, _id: &PCWSTR) -> windows::core::Result<()> {
        let _ = self.0.send(Wake::Outputs);
        Ok(())
    }
    fn OnPropertyValueChanged(&self, _id: &PCWSTR, _key: &PROPERTYKEY) -> windows::core::Result<()> {
        Ok(())
    }
}

/// Les processus lancés par MyBoard (WebView2 et ses processus), d'après la liste des processus de Windows.
#[derive(Default)]
struct Ours {
    known: HashMap<u32, bool>,
}

impl Ours {
    fn contains(&mut self, pid: u32) -> bool {
        if let Some(&yes) = self.known.get(&pid) {
            return yes;
        }
        let yes = descends_from(pid, std::process::id());
        self.known.insert(pid, yes);
        yes
    }
}

fn descends_from(pid: u32, root: u32) -> bool {
    let parents = parents();
    let mut current = pid;
    // WebView2 : MyBoard → navigateur → service audio ; quelques étages au plus.
    for _ in 0..16 {
        if current == root {
            return true;
        }
        match parents.get(&current) {
            Some(&parent) if parent != 0 && parent != current => current = parent,
            _ => return false,
        }
    }
    false
}

/// Numéro de processus → numéro de son parent.
fn parents() -> HashMap<u32, u32> {
    let mut out = HashMap::new();
    // SAFETY : instantané de la liste des processus, parcouru puis fermé ; la structure porte sa taille.
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return out;
        }
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
        let mut more = Process32FirstW(snapshot, &mut entry) != 0;
        while more {
            out.insert(entry.th32ProcessID, entry.th32ParentProcessID);
            more = Process32NextW(snapshot, &mut entry) != 0;
        }
        CloseHandle(snapshot);
    }
    out
}
