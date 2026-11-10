//! EXIF et profil de couleurs dans un AVIF écrit par ffmpeg (IMP-67, 10/11) : ffmpeg ne les écrit pas. Un AVIF est
//! une suite de boîtes (ftyp, meta, mdat) ; la boîte meta en est la table des matières. On y ajoute :
//! - un élément « Exif » : sa description (infe), sa position (iloc), son lien vers l'image (iref 'cdsc') ; ses données
//!   (4 octets à zéro, puis l'EXIF) vont à la fin de mdat ;
//! - le profil : une propriété colr 'prof' (ipco), associée à l'image principale (ipma).
//!
//! meta grandit : toutes les positions d'iloc (dans mdat, après meta) sont décalées d'autant. Toute structure
//! inattendue : `None`, et l'AVIF est gardé tel quel. Le résultat est encore relu par ffmpeg (convert.rs).

/// Une boîte : type, début, début du contenu, fin.
struct Bx {
    kind: [u8; 4],
    start: usize,
    body: usize,
    end: usize,
}

fn boxes(d: &[u8], from: usize, to: usize) -> Option<Vec<Bx>> {
    let mut found = Vec::new();
    let mut p = from;
    while p < to {
        let size = u32::from_be_bytes(d.get(p..p + 4)?.try_into().ok()?) as usize;
        let kind: [u8; 4] = d.get(p + 4..p + 8)?.try_into().ok()?;
        let (body, end) = match size {
            0 => (p + 8, to),
            1 => (p + 16, p.checked_add(u64::from_be_bytes(d.get(p + 8..p + 16)?.try_into().ok()?) as usize)?),
            s => (p + 8, p.checked_add(s)?),
        };
        if end > to || end < body {
            return None;
        }
        found.push(Bx { kind, start: p, body, end });
        p = end;
    }
    Some(found)
}

fn boxed(kind: &[u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut b = Vec::with_capacity(payload.len() + 8);
    b.extend_from_slice(&(payload.len() as u32 + 8).to_be_bytes());
    b.extend_from_slice(kind);
    b.extend_from_slice(payload);
    b
}

/// Lecture d'entiers gros-boutistes de 0, 1, 2, 4 ou 8 octets.
struct Rd<'a> {
    d: &'a [u8],
    p: usize,
}

impl Rd<'_> {
    fn n(&mut self, size: u8) -> Option<u64> {
        let s = usize::from(size);
        let bytes = self.d.get(self.p..self.p + s)?;
        self.p += s;
        Some(bytes.iter().fold(0u64, |v, b| (v << 8) | u64::from(*b)))
    }
}

/// Écrit `v` sur `size` octets ; `None` s'il n'y tient pas.
fn put(out: &mut Vec<u8>, v: u64, size: u8) -> Option<()> {
    if size < 8 && v >> (u32::from(size) * 8) != 0 {
        return None;
    }
    out.extend_from_slice(&v.to_be_bytes()[8 - usize::from(size)..]);
    Some(())
}

struct Item {
    id: u64,
    method: u64,
    base: u64,
    extents: Vec<(u64, u64, u64)>,
}

struct Iloc {
    head: [u8; 4],
    sizes: [u8; 4],
    items: Vec<Item>,
}

fn parse_iloc(d: &[u8]) -> Option<Iloc> {
    let v = *d.first()?;
    let mut r = Rd { d, p: 4 };
    let (a, b) = (r.n(1)? as u8, r.n(1)? as u8);
    let sizes = [a >> 4, a & 15, b >> 4, if v >= 1 { b & 15 } else { 0 }];
    let [os, ls, bs, is] = sizes;
    if v > 2 || ls == 0 || (os == 0 && bs == 0) || [os, ls, bs, is].iter().any(|s| ![0, 4, 8].contains(s)) {
        return None;
    }
    let count = r.n(if v < 2 { 2 } else { 4 })?;
    let mut items = Vec::new();
    for _ in 0..count {
        let id = r.n(if v < 2 { 2 } else { 4 })?;
        let method = if v >= 1 { r.n(2)? } else { 0 };
        // Seules les positions dans le fichier (méthode 0, même fichier) sont prévues.
        if method & 15 != 0 || r.n(2)? != 0 {
            return None;
        }
        let base = r.n(bs)?;
        let mut extents = Vec::new();
        for _ in 0..r.n(2)? {
            extents.push((if is > 0 { r.n(is)? } else { 0 }, r.n(os)?, r.n(ls)?));
        }
        items.push(Item { id, method, base, extents });
    }
    Some(Iloc { head: d.get(..4)?.try_into().ok()?, sizes, items })
}

fn write_iloc(iloc: &Iloc, shift: u64, extra: Option<(u64, u64, u64)>) -> Option<Vec<u8>> {
    let v = iloc.head[0];
    let [os, ls, bs, is] = iloc.sizes;
    let mut out = iloc.head.to_vec();
    out.extend_from_slice(&[(os << 4) | ls, (bs << 4) | is]);
    let wide = if v < 2 { 2 } else { 4 };
    put(&mut out, (iloc.items.len() + usize::from(extra.is_some())) as u64, wide)?;
    let added = extra.map(|(id, pos, len)| Item { id, method: 0, base: 0, extents: vec![(0, pos, len)] });
    for (item, new) in iloc.items.iter().map(|i| (i, false)).chain(added.iter().map(|i| (i, true))) {
        put(&mut out, item.id, wide)?;
        if v >= 1 {
            put(&mut out, item.method, 2)?;
        }
        put(&mut out, 0, 2)?;
        // Position = base + décalage de l'extent : on décale la base si elle existe, sinon chaque extent.
        let moved = |x: u64| if new { x } else { x + shift };
        let (base, extents): (u64, Vec<(u64, u64, u64)>) = if bs > 0 {
            if new { (item.extents[0].1, vec![(0, 0, item.extents[0].2)]) } else { (moved(item.base), item.extents.clone()) }
        } else {
            (0, item.extents.iter().map(|&(i, o, l)| (i, moved(o), l)).collect())
        };
        put(&mut out, base, bs)?;
        put(&mut out, extents.len() as u64, 2)?;
        for (i, o, l) in extents {
            if is > 0 {
                put(&mut out, i, is)?;
            }
            put(&mut out, o, os)?;
            put(&mut out, l, ls)?;
        }
    }
    Some(boxed(b"iloc", &out))
}

/// Association de la propriété `index` à l'élément `item` dans ipma.
fn add_association(d: &[u8], item: u64, index: u64) -> Option<Vec<u8>> {
    let (v, wide_index) = (*d.first()?, d.get(3)? & 1 == 1);
    let mut r = Rd { d, p: 8 };
    let count = Rd { d, p: 4 }.n(4)?;
    let mut out = d.get(..8)?.to_vec();
    let mut done = false;
    for _ in 0..count {
        let start = r.p;
        let id = r.n(if v < 1 { 2 } else { 4 })?;
        let n = r.n(1)?;
        let header = r.p - 1;
        r.p += n as usize * if wide_index { 2 } else { 1 };
        let entry = d.get(start..r.p)?;
        if id == item && n < 255 {
            out.extend_from_slice(&entry[..header - start]);
            out.push(n as u8 + 1);
            out.extend_from_slice(&entry[header - start + 1..]);
            put(&mut out, index, if wide_index { 2 } else { 1 })?;
            if index > if wide_index { 0x7FFF } else { 0x7F } {
                return None;
            }
            done = true;
        } else {
            out.extend_from_slice(entry);
        }
    }
    done.then(|| boxed(b"ipma", &out))
}

/// Ajoute l'EXIF (TIFF, commençant par « II » ou « MM ») et le profil de couleurs ; `None` : rien à ajouter ou
/// structure inattendue.
pub fn add(avif: &[u8], exif: Option<&[u8]>, icc: Option<&[u8]>) -> Option<Vec<u8>> {
    let exif = exif.filter(|e| e.starts_with(b"II*\0") || e.starts_with(b"MM\0*"));
    let top = boxes(avif, 0, avif.len())?;
    let mdat = top.last().filter(|b| &b.kind == b"mdat")?;
    let meta = top.iter().find(|b| &b.kind == b"meta" && b.body == b.start + 8)?;
    if top.iter().filter(|b| &b.kind == b"mdat").count() != 1 || meta.end > mdat.start {
        return None;
    }
    let children = boxes(avif, meta.body + 4, meta.end)?;
    let body = |kind: &[u8; 4]| children.iter().find(|b| &b.kind == kind).map(|b| &avif[b.body..b.end]);
    let pitm = body(b"pitm")?;
    let primary = Rd { d: pitm, p: 4 }.n(if pitm[0] == 0 { 2 } else { 4 })?;
    let iloc = parse_iloc(body(b"iloc")?)?;
    let positions = iloc.items.iter().flat_map(|i| i.extents.iter().map(move |e| i.base + e.1));
    if positions.into_iter().any(|p| p < meta.end as u64) {
        return None;
    }
    let iprp = children.iter().find(|b| &b.kind == b"iprp")?;
    let props = boxes(avif, iprp.body, iprp.end)?;
    let ipco = props.iter().find(|b| &b.kind == b"ipco")?;
    let ipco_children = boxes(avif, ipco.body, ipco.end)?;
    let has_icc = ipco_children.iter().any(|b| &b.kind == b"colr" && matches!(avif.get(b.body..b.body + 4), Some(b"prof" | b"rICC")));
    let icc = icc.filter(|_| !has_icc);
    if (exif.is_none() && icc.is_none()) || props.iter().filter(|b| &b.kind == b"ipma").count() != 1 {
        return None;
    }
    let exif_id = iloc.items.iter().map(|i| i.id).max()? + 1;
    if exif_id > 0xFFFF {
        return None;
    }

    // Nouvelle boîte meta ; sa taille ne dépend pas des positions : construite une fois pour la mesurer.
    let build = |shift: u64, exif_pos: u64| -> Option<Vec<u8>> {
        let mut out = avif[meta.body..meta.body + 4].to_vec();
        let cdsc = || {
            let mut c = Vec::new();
            put(&mut c, exif_id, 2)?;
            put(&mut c, 1, 2)?;
            put(&mut c, primary, 2)?;
            Some(boxed(b"cdsc", &c))
        };
        for child in &children {
            let raw = &avif[child.start..child.end];
            match &child.kind {
                b"iloc" => out.extend(write_iloc(&iloc, shift, exif.map(|e| (exif_id, exif_pos, e.len() as u64 + 4)))?),
                b"iinf" if exif.is_some() => {
                    let d = &avif[child.body..child.end];
                    let wide = if d[0] == 0 { 2 } else { 4 };
                    let mut b = d[..4].to_vec();
                    put(&mut b, Rd { d, p: 4 }.n(wide)? + 1, wide)?;
                    b.extend_from_slice(&d[4 + usize::from(wide)..]);
                    let mut infe = vec![2, 0, 0, 0];
                    put(&mut infe, exif_id, 2)?;
                    infe.extend_from_slice(&[0, 0]);
                    infe.extend_from_slice(b"Exif\0");
                    b.extend(boxed(b"infe", &infe));
                    out.extend(boxed(b"iinf", &b));
                    if body(b"iref").is_none() {
                        out.extend(boxed(b"iref", &[[0, 0, 0, 0].as_slice(), &cdsc()?].concat()));
                    }
                }
                b"iref" if exif.is_some() => {
                    if avif[child.body] != 0 {
                        return None;
                    }
                    out.extend(boxed(b"iref", &[&avif[child.body..child.end], &cdsc()?].concat()));
                }
                b"iprp" if icc.is_some() => {
                    let mut p = Vec::new();
                    for prop in &props {
                        if &prop.kind == b"ipco" {
                            let colr = boxed(b"colr", &[b"prof".as_slice(), icc?].concat());
                            p.extend(boxed(b"ipco", &[&avif[ipco.body..ipco.end], &colr].concat()));
                        } else if &prop.kind == b"ipma" {
                            p.extend(add_association(&avif[prop.body..prop.end], primary, ipco_children.len() as u64 + 1)?);
                        } else {
                            p.extend_from_slice(&avif[prop.start..prop.end]);
                        }
                    }
                    out.extend(boxed(b"iprp", &p));
                }
                _ => out.extend_from_slice(raw),
            }
        }
        Some(boxed(b"meta", &out))
    };
    let shift = build(0, 0)?.len().checked_sub(meta.end - meta.start)? as u64;
    let exif_pos = avif.len() as u64 + shift;
    let new_meta = build(shift, exif_pos)?;

    let payload = exif.map(|e| [[0u8; 4].as_slice(), e].concat()).unwrap_or_default();
    let mut file = Vec::with_capacity(avif.len() + new_meta.len() + payload.len());
    file.extend_from_slice(&avif[..meta.start]);
    file.extend(new_meta);
    file.extend_from_slice(&avif[meta.end..mdat.start]);
    let header = &avif[mdat.start..mdat.body];
    match u32::from_be_bytes(header[..4].try_into().ok()?) {
        0 => file.extend_from_slice(header),
        1 => {
            file.extend_from_slice(&header[..8]);
            file.extend_from_slice(&((mdat.end - mdat.start + payload.len()) as u64).to_be_bytes());
        }
        size => {
            file.extend_from_slice(&u32::try_from(size as usize + payload.len()).ok()?.to_be_bytes());
            file.extend_from_slice(&header[4..]);
        }
    }
    file.extend_from_slice(&avif[mdat.body..]);
    file.extend(payload);
    Some(file)
}
