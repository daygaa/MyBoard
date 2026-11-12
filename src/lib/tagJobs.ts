// Travail en arrière-plan sur les tags (TAGM-23, réponses du 12/11) : au clic, les tags (ou les lignes de la corbeille)
// sont cachés de tout ce qui est déjà affiché, puis la demande part au cœur Rust, qui fait le travail par paquets et
// envoie l'avancement (badge). Quand tout est fini, tout ce qui montre des tags est relu, puis plus rien n'est caché.
// Au lancement, un travail interrompu par la fermeture de MyBoard reprend : ses tags sont cachés de même (Q6 A).

import { listen } from "@tauri-apps/api/event";

import { type TagJobProgress, useTagJobs, withoutPending, withoutRestoring } from "@/stores/tagJobs";
import { api, type MediaDetail, type PendingTag, type TagInfo, type TagManagerData, type TrashTag } from "./api";
import { queryClient } from "./queryClient";

/** Demandes envoyées dont la réponse n'est pas encore arrivée : la fin d'un travail ne doit pas les oublier. */
let inFlight = 0;
/** Dernière relecture de la corbeille pendant un travail (au plus une par seconde : elle peut avoir 13 000 lignes). */
let trashRead = 0;

/** Ce qui est déjà affiché perd aussitôt les tags et les lignes en attente (sans attendre une relecture). */
function filterShown() {
  const { tags } = useTagJobs.getState();
  queryClient.setQueriesData<TagManagerData>({ queryKey: ["tag-manager"] }, (d) => d && { ...d, tags: withoutPending(d.tags) });
  for (const key of ["page-tags", "autocomplete", "selection-tags"]) queryClient.setQueriesData<TagInfo[]>({ queryKey: [key] }, (d) => d && withoutPending(d));
  queryClient.setQueriesData<MediaDetail | null>({ queryKey: ["media-detail"] }, (d) => d && { ...d, tags: withoutPending(d.tags) });
  queryClient.setQueriesData<TagInfo | null>({ queryKey: ["tag"] }, (d) => (d && tags.has(d.id) ? null : d));
  queryClient.setQueriesData<TrashTag[]>({ queryKey: ["tag-trash"] }, (d) => d && withoutRestoring(d));
}

function hide(tags: Iterable<number>, names: Iterable<string>, trash: Iterable<number>) {
  const s = useTagJobs.getState();
  useTagJobs.setState({ tags: new Set([...s.tags, ...tags]), names: new Set([...s.names, ...names]), trash: new Set([...s.trash, ...trash]) });
  filterShown();
}

/** Envoie une demande ; ce qu'elle cache l'est dès le clic. */
export async function queueTagJob<T>(hideNow: () => void, call: () => Promise<T>, after: (result: T) => void): Promise<T> {
  inFlight += 1;
  hideNow();
  try {
    const result = await call();
    after(result);
    return result;
  } finally {
    inFlight -= 1;
  }
}

export const hideTags = (ids: number[]) => hide(ids, [], []);
export const hidePending = (pending: PendingTag[]) => hide(pending.map((t) => t.id), pending.map((t) => t.name), []);
export const hideTrash = (ids: number[]) => hide([], [], ids);

/** Ce qui attend encore dans le cœur Rust (au lancement, et à la fin d'un travail). */
async function sync() {
  const state = await api.tagJobsState();
  useTagJobs.setState({
    tags: new Set(state.tags.map((t) => t.id)),
    names: new Set(state.tags.map((t) => t.name)),
    trash: new Set(state.trash),
    progress: state.progress,
    since: state.progress ? Date.now() : 0,
  });
  filterShown();
}

/** Écoute l'avancement ; `refresh` relit tout ce qui montre des tags. Renvoie de quoi arrêter l'écoute. */
export function watchTagJobs(refresh: () => Promise<unknown>) {
  const stop = listen<TagJobProgress | null>("tag-jobs", (event) => {
    const progress = event.payload;
    if (progress) {
      const { since, progress: before } = useTagJobs.getState();
      useTagJobs.setState({ progress, since: before ? since : Date.now() });
      // La corbeille se remplit (ou se vide) au fil des paquets.
      if (Date.now() - trashRead >= 1000) {
        trashRead = Date.now();
        void queryClient.invalidateQueries({ queryKey: ["tag-trash"] });
      }
      return;
    }
    useTagJobs.setState({ progress: null, since: 0 });
    // Tout est fait : plus rien n'est caché (sauf une demande partie entre-temps), puis tout est relu (ce qui est déjà
    // affiché a perdu les tags cachés : rien ne réapparaît entre-temps ; un tag que le travail n'a pas pu traiter revient).
    void (inFlight === 0 ? sync() : Promise.resolve()).then(refresh);
  });
  void stop.then(() => sync());
  return stop;
}
