// Vidéo illisible dans MyBoard (VIEW-25 ; réponses du 09/11 et du 11/11) : « Vidéo illisible dans MyBoard », boutons
// « Convertir » et « Ouvrir avec l'application par défaut » (VIEW-24). « Convertir » ouvre une pop-in : format (menu des
// formats vidéo, MP4 standard par défaut, bulles d'IMP-66), qualité (curseur à 5 crans, « Maximale » au départ : réponse
// Q5 du 11/11), case « Supprimer l'original » (2e confirmation rouge, comme IMP-28). La copie est écrite à côté de
// l'original et la fiche passe à la copie ; pendant la conversion : avancement et « Annuler » ; à la fin, la vidéo
// convertie est lue.

import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Film, Loader2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { api, EVENTS, type MediaItem, type VideoConverted, type VideoTarget } from "@/lib/api";
import { refreshLibrary } from "@/stores/deletion";
import { useViewer } from "@/stores/viewer";
import { FormatSelect, VIDEO_FORMATS } from "../import/FormatSelect";
import { VideoQualitySlider } from "../import/VideoQualitySlider";
import { OpenExternally } from "./OpenExternally";

const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]";
const RED = "bg-destructive text-white hover:bg-destructive/90";

type Choice = { target: VideoTarget; quality: number; deleteOriginal: boolean };

function ConvertDialog({ onConvert, onCancel }: { onConvert: (c: Choice) => void; onCancel: () => void }) {
  const [target, setTarget] = useState<VideoTarget>("h264");
  const [quality, setQuality] = useState(4);
  const [deleteOriginal, setDeleteOriginal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const go = () => (deleteOriginal ? setConfirm(true) : onConvert({ target, quality, deleteOriginal: false }));

  if (confirm) {
    return (
      <ConfirmDialog
        danger
        zone="visionneuse.convertir.confirmation"
        title="Êtes-vous sûr de vouloir supprimer l'original de votre stockage ?"
        message="Une fois la vidéo convertie, l'original sera effacé définitivement du disque, sans passer par la Corbeille."
        confirmLabel="Supprimer l'original"
        onCancel={() => setConfirm(false)}
        onConfirm={() => onConvert({ target, quality, deleteOriginal: true })}
      />
    );
  }
  return (
    <Modal
      open
      danger={deleteOriginal}
      zone="visionneuse.convertir"
      onClose={onCancel}
      onEnter={go}
      title="Convertir la vidéo"
      description="La copie convertie est enregistrée à côté de l'original ; la fiche (tags, favoris, dossiers) passe à la copie."
      footer={
        <>
          <Button variant="outline" onClick={onCancel} className="border-border text-foreground hover:bg-secondary hover:text-foreground">
            Annuler
          </Button>
          <Button data-zone="visionneuse.convertir.lancer" onClick={go} className={deleteOriginal ? RED : GOLD}>
            Convertir
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Format</p>
          <FormatSelect formats={VIDEO_FORMATS} value={target} onChange={setTarget} disabled={false} zone="visionneuse.convertir.format" />
        </div>
        <div>
          <VideoQualitySlider zone="visionneuse.convertir.qualite" value={quality} onChange={setQuality} />
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox data-principale data-zone="visionneuse.convertir.supprimer" checked={deleteOriginal} onCheckedChange={(c) => setDeleteOriginal(c === true)} />
          Supprimer l'original
        </label>
      </div>
    </Modal>
  );
}

/** Carte affichée à la place d'une vidéo que le lecteur intégré ne sait pas lire. */
export function UnplayableVideo({ item }: { item: MediaItem }) {
  const [dialog, setDialog] = useState(false);
  /** Avancement de la conversion en cours (0 à 1) ; `null` : aucune. */
  const [fraction, setFraction] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const progress = listen<{ id: number; fraction: number }>(EVENTS.videoConversionProgress, (e) => {
      if (e.payload.id === item.id) setFraction(e.payload.fraction);
    });
    const done = listen<VideoConverted>(EVENTS.videoConverted, (e) => {
      const d = e.payload;
      if (d.id !== item.id) return;
      setFraction(null);
      if (d.item) {
        // La fiche passe à la copie : la visionneuse la montre aussitôt (nouvelle empreinte, nouveau lecteur).
        const { index, total, show, setError } = useViewer.getState();
        show(index, d.item, total);
        void refreshLibrary();
        if (d.lostSubtitles)
          setError({ action: "Convertir", code: null, message: "La vidéo est convertie, mais ses sous-titres en images n'ont pas pu être gardés : le format choisi ne les accepte pas." });
      } else if (d.error) setMessage(`La conversion a échoué : ${d.error}`);
    });
    return () => {
      void progress.then((off) => off());
      void done.then((off) => off());
    };
  }, [item.id]);

  const start = async (choice: Choice) => {
    setDialog(false);
    setMessage(null);
    setFraction(0);
    try {
      await api.convertVideo(item.id, choice.target, choice.quality, choice.deleteOriginal);
    } catch (error) {
      setFraction(null);
      setMessage(String(error));
    }
  };

  return (
    <div data-zone="visionneuse.illisible" className="flex max-w-lg flex-col items-center rounded-xl border border-border bg-card px-8 py-10 text-center">
      <Film className="h-12 w-12 text-muted-foreground" />
      <p className="mt-4 font-semibold text-foreground">Vidéo illisible dans MyBoard</p>
      <p className="mt-1 text-sm font-medium break-all text-foreground/80 select-text">{item.fileName}</p>
      <p className="mt-2 text-sm text-muted-foreground select-text">
        Son format n'est pas pris en charge par le lecteur intégré : convertissez-la, ou ouvrez-la avec l'application par défaut.
      </p>
      {fraction !== null ? (
        <div data-zone="visionneuse.illisible.conversion" className="mt-5 w-full space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d9a94e]" />
              Conversion en cours…
            </span>
            <span className="tabular-nums">{Math.round(fraction * 100)} %</span>
          </div>
          <Progress value={fraction * 100} className="h-1.5 bg-secondary [&_[data-slot=progress-indicator]]:bg-emerald-400" />
          <Button variant="outline" onClick={() => void api.cancelVideoConversion()} className="mt-2 border-border text-foreground hover:bg-secondary hover:text-foreground">
            Annuler
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button data-zone="visionneuse.illisible.convertir" onClick={() => setDialog(true)} className={GOLD}>
            <Wand2 className="h-4 w-4" />
            Convertir
          </Button>
          <OpenExternally item={item} secondary />
        </div>
      )}
      {message && <p className="mt-3 text-sm text-rose-400 select-text">{message}</p>}
      {dialog && <ConvertDialog onConvert={(c) => void start(c)} onCancel={() => setDialog(false)} />}
    </div>
  );
}
