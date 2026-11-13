// Pied de page, toujours collé en bas de la fenêtre (GEN-05), comme dans la v8.

export function Footer() {
  return (
    <footer
      data-zone="pied-de-page"
      // garde-barre (GEN-28) : le texte reste au même endroit, barre de défilement affichée ou non.
      className="garde-barre mt-auto border-t select-text border-border bg-card/40 py-3 pl-4 text-center text-xs text-muted-foreground [--garde-base:1rem]"
    >
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[#d9a94e]" />
        MyBoard · local
      </span>
    </footer>
  );
}
