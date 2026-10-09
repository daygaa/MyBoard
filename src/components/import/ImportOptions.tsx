"use client";

// MyBoard — Options d'import (carte avec sections).
// Phase 2 refonte :
// - imp-1 : "Compression images" → "Compresser les images"
// - imp-2 : slider qualité 20-95 (au lieu de 60-95)
// - imp-3 : "Convertir en WebP" → "Convertir les images en :" + Select (jpg/png/webp/avif/heif/jfif)
// - imp-4 : suppression mention "Prioritaire sur la compression" ;
//           les 2 options peuvent être combinées (qualité s'applique au format cible)
// - imp-5 : "Transcodage vidéo H.264" → "Convertir les vidéos en :" + Select
//           (mp4-h264 / mp4-h265 / webm / av1) avec tooltips Popover ⓘ
// - imp-6 : "Qualité vidéo" 5 paliers (segmented control) si transcodage actif
// - imp-7 : suppression de "Générer miniatures" (toujours actif)
//
// État contrôlé : reçoit `options` + `onChange` du parent (ImportFlow).
// Désactivé pendant un import en cours (`disabled`).

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Settings2,
  ImageIcon,
  Film,
  Wand2,
  Info,
} from "lucide-react";
import type { ImportOptions } from "@/lib/import-processing";

type Props = {
  options: ImportOptions;
  onChange: (next: ImportOptions) => void;
  disabled?: boolean;
};

// ---------------------------------------------------------------------------
// Configurations statiques
// ---------------------------------------------------------------------------

const IMAGE_FORMATS: { value: string; label: string }[] = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" },
  { value: "heif", label: "HEIF" },
  { value: "jfif", label: "JFIF" },
];

const VIDEO_FORMATS: {
  value: string;
  label: string;
  tooltip: string;
  default?: boolean;
}[] = [
  {
    value: "mp4-h264",
    label: "MP4 standard (H.264 + AAC)",
    tooltip: "Compatible partout, lecture native Windows/Mac/navigateurs",
    default: true,
  },
  {
    value: "mp4-h265",
    label: "MP4 - H.265 (HEVC + AAC)",
    tooltip: "Nécessite extension HEVC sur Windows (-40% taille)",
  },
  {
    value: "webm",
    label: "WebM (VP9 + Opus)",
    tooltip: "OK navigateurs, pas sur lecteurs Windows natifs (-30%)",
  },
  {
    value: "av1",
    label: "AV1 (AV1 + Opus)",
    tooltip: "Très lent à encoder, futur (-50%)",
  },
];

const VIDEO_QUALITIES: { value: number; label: string; short: string }[] = [
  { value: 0, label: "Minimale", short: "Min" },
  { value: 1, label: "Basse", short: "Basse" },
  { value: 2, label: "Moyenne", short: "Moy." },
  { value: 3, label: "Haute", short: "Haute" },
  { value: 4, label: "Maximale", short: "Max" },
];

// ---------------------------------------------------------------------------
// InfoPopover : icône ⓘ qui ouvre un Popover au clic avec un texte d'aide.
// Rendu HORS du Select (à côté du SelectTrigger) pour éviter le conflit
// Popover-dans-Popover : le Select est lui-même un Popover Radix, et un Popover
// enfant se ferme instantanément quand le Select parent perd le focus.
// ---------------------------------------------------------------------------

function InfoPopover({
  text,
  label,
  side = "top",
}: {
  text: string;
  label: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-[#d9a94e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a94e]/40"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="center"
        className="w-72 text-xs leading-relaxed text-popover-foreground"
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function ImportOptions({ options, onChange, disabled = false }: Props) {
  /** Helper : met à jour un champ sans polluer l'appelant. */
  function set<K extends keyof ImportOptions>(key: K, value: ImportOptions[K]) {
    if (disabled) return;
    onChange({ ...options, [key]: value });
  }

  // Pour le Select image : "" représente "pas de conversion"
  const imgSelectValue = options.convertImageFormat ?? "__none__";

  return (
    <Card className="flex h-full flex-col border-border bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Settings2 className="h-4 w-4 text-[#d9a94e]" />
          Options d&apos;import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ─── Compresser les images (imp-1, imp-2) ─── */}
        <section>
          <div className="flex items-start gap-3">
            <Checkbox
              id="opt-compress"
              checked={options.compressImages}
              disabled={disabled}
              onCheckedChange={(c) => set("compressImages", c === true)}
              className="mt-0.5 data-[state=checked]:border-[#d9a94e] data-[state=checked]:bg-[#d9a94e] data-[state=checked]:text-[#1a1408]"
            />
            <div className="min-w-0 flex-1">
              <Label
                htmlFor="opt-compress"
                className="flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                <ImageIcon className="h-4 w-4 text-emerald-300" />
                Compresser les images
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ré-encode JPEG / PNG / WebP à la qualité choisie.
              </p>
            </div>
          </div>
          {options.compressImages && (
            <div className="mt-3 pl-7">
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Qualité</Label>
                <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 font-mono text-xs font-medium text-[#d9a94e] tabular-nums">
                  {options.jpegQuality}
                </span>
              </div>
              <Slider
                value={[options.jpegQuality]}
                min={20}
                max={95}
                step={1}
                disabled={disabled}
                onValueChange={(v) => set("jpegQuality", v[0] ?? 85)}
                className="[&_[data-slot=slider-range]]:bg-[#d9a94e] [&_[data-slot=slider-thumb]]:border-[#d9a94e]"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>20 (compressé)</span>
                <span>95 (haute)</span>
              </div>
            </div>
          )}
        </section>

        {/* ─── Convertir les images en (imp-3, imp-4) ─── */}
        <section>
          <div className="flex items-start gap-3">
            <Checkbox
              id="opt-convert-img"
              checked={!!options.convertImageFormat}
              disabled={disabled}
              onCheckedChange={(c) =>
                set("convertImageFormat", c ? "jpg" : null)
              }
              className="mt-0.5 data-[state=checked]:border-[#d9a94e] data-[state=checked]:bg-[#d9a94e] data-[state=checked]:text-[#1a1408]"
            />
            <div className="min-w-0 flex-1">
              <Label
                htmlFor="opt-convert-img"
                className="flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                <Wand2 className="h-4 w-4 text-amber-300" />
                Convertir les images en&nbsp;:
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Convertit vers le format sélectionné. La qualité de
                compression s&apos;applique au format cible si elle est activée.
              </p>
            </div>
          </div>
          {options.convertImageFormat && (
            <div className="mt-3 pl-7">
              <Select
                value={imgSelectValue === "__none__" ? "jpg" : imgSelectValue}
                onValueChange={(v) => set("convertImageFormat", v)}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 w-full bg-background/60">
                  <SelectValue placeholder="Format cible" />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                      {f.value === "jpg" && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          défaut
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </section>

        {/* ─── Convertir les vidéos en (imp-5) ─── */}
        <section>
          <div className="flex items-start gap-3">
            <Checkbox
              id="opt-transcode"
              checked={options.transcodeVideo}
              disabled={disabled}
              onCheckedChange={(c) => set("transcodeVideo", c === true)}
              className="mt-0.5 data-[state=checked]:border-[#d9a94e] data-[state=checked]:bg-[#d9a94e] data-[state=checked]:text-[#1a1408]"
            />
            <div className="min-w-0 flex-1">
              <Label
                htmlFor="opt-transcode"
                className="flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                <Film className="h-4 w-4 text-amber-300" />
                Convertir les vidéos en&nbsp;:
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Transcode via ffmpeg vers le format sélectionné. Fallback sur
                l&apos;original si ffmpeg est absent.
              </p>
            </div>
          </div>
          {options.transcodeVideo && (
            <div className="mt-3 space-y-3 pl-7">
              {/* Ligne : Select format + InfoPopover (à côté, pas à l'intérieur du Select) */}
              <div className="flex items-center gap-1.5">
                <Select
                  value={options.videoFormat}
                  onValueChange={(v) => set("videoFormat", v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9 min-w-0 flex-1 bg-background/60">
                    <SelectValue placeholder="Format vidéo" />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        <span className="flex flex-1 items-center gap-1.5 truncate">
                          <span className="truncate">{f.label}</span>
                          {f.default && (
                            <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#d9a94e]">
                              défaut
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <InfoPopover
                  text={
                    VIDEO_FORMATS.find((f) => f.value === options.videoFormat)
                      ?.tooltip ?? "Sélectionnez un format vidéo pour afficher son aide."
                  }
                  label={`Aide sur ${
                    VIDEO_FORMATS.find((f) => f.value === options.videoFormat)?.label ?? "format vidéo"
                  }`}
                  side="bottom"
                />
              </div>

              {/* imp-5 (P4) : Slider qualité vidéo — 5 paliers avec snapping */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    Qualité vidéo
                  </Label>
                  <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 font-mono text-xs font-medium text-[#d9a94e] tabular-nums">
                    {VIDEO_QUALITIES[options.videoQuality]?.label ?? "Moyenne"}
                  </span>
                </div>
                <Slider
                  value={[options.videoQuality]}
                  min={0}
                  max={4}
                  step={1}
                  onValueChange={(v) => {
                    const n = v[0];
                    if (typeof n === "number" && Number.isFinite(n)) {
                      set("videoQuality", Math.max(0, Math.min(4, Math.round(n))));
                    }
                  }}
                  disabled={disabled}
                  className="[&_[data-slot=slider-range]]:bg-[#d9a94e] [&_[data-slot=slider-thumb]]:border-[#d9a94e]"
                />
                {/* Libellés des 5 paliers sous le slider */}
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  {VIDEO_QUALITIES.map((q) => (
                    <span
                      key={q.value}
                      className={
                        options.videoQuality === q.value
                          ? "font-semibold text-[#d9a94e]"
                          : ""
                      }
                    >
                      {q.short}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ─── Miniatures : imp-7 supprimé (toujours actif, info seule) ─── */}
        <section className="rounded-lg border border-dashed border-border/60 bg-background/30 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-[#d9a94e]" />
            Les miniatures sont générées automatiquement pour chaque média
            (sharp pour les images, ffmpeg pour les vidéos, placeholder sinon).
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
