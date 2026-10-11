// Pied de page, toujours collé en bas de la fenêtre (GEN-05), comme dans la v8.

export function Footer() {
  return (
    <footer
      data-zone="pied-de-page"
      className="mt-auto border-t border-border bg-card/40 px-4 py-3 text-center text-xs text-muted-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[#d9a94e]" />
        MyBoard · local
      </span>
    </footer>
  );
}
