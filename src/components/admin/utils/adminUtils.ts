import { MasterData } from "../../../types";

export function safeHacMatch(hacA: any, hacB: any): boolean {
  if (hacA === undefined || hacA === null || hacB === undefined || hacB === null) return false;
  
  let strA = String(hacA).trim().toUpperCase();
  let strB = String(hacB).trim().toUpperCase();
  if (strA === "" || strB === "") return false;

  // 1. Direct match
  if (strA === strB) return true;

  // 2. Clear alphanumeric match
  const cleanA = strA.replace(/[^A-Z0-9]/g, '');
  const cleanB = strB.replace(/[^A-Z0-9]/g, '');
  if (cleanA === "" || cleanB === "") return false;
  if (cleanA === cleanB) return true;

  // 3. Bidirectional inclusion
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  // 4. Prefix/mid comparison by removing "MG" or similar standard prefixes
  const looseA = cleanA.startsWith("MG") ? cleanA.slice(2) : cleanA;
  const looseB = cleanB.startsWith("MG") ? cleanB.slice(2) : cleanB;
  if (looseA === looseB || looseA.includes(looseB) || looseB.includes(looseA)) return true;

  // 5. Split and check numerical similarity (e.g., 672, 673, 674)
  const partsA = strA.split(/[\s.\-_/]+/).filter(Boolean);
  const partsB = strB.split(/[\s.\-_/]+/).filter(Boolean);

  const hasNumA = partsA.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  const hasNumB = partsB.some(p => p.includes("672") || p.includes("673") || p.includes("674"));
  
  if (hasNumA && hasNumB) {
    // Check if they share a specific suffix portion (like BT1, PZ1, AM1)
    const suffixA = partsA.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    const suffixB = partsB.find(p => p !== "MG" && !p.includes("672") && !p.includes("673") && !p.includes("674"));
    if (suffixA && suffixB && (suffixA.includes(suffixB) || suffixB.includes(suffixA))) {
      return true;
    }
    // If one is just the group (e.g. 672) and the other is specific (e.g. 672-BT1)
    if (partsA.length === 1 || partsB.length === 1) {
      return true;
    }
  }

  return false;
}

export function normalizeSearchText(value: any): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function buildCauseSearchIndex(cause: any, masters: MasterData): string[] {
  const parts: string[] = [];

  // Own cause fields
  if (cause.hac) parts.push(cause.hac);
  if (cause.text) parts.push(cause.text);
  if (cause.stopType) parts.push(cause.stopType);
  if (cause.partObject) parts.push(cause.partObject);
  if (cause.causeCode) parts.push(cause.causeCode);
  if (cause.sapCause) parts.push(cause.sapCause);
  if (cause.symptomGroup) parts.push(cause.symptomGroup);
  if (cause.symptomCode) parts.push(cause.symptomCode);
  if (cause.causeGroup) parts.push(cause.causeGroup);

  // Related HAC details
  const relatedHacs = (masters.hacs || []).filter(
    (h) => h.hac === cause.hac || safeHacMatch(h.hac, cause.hac)
  );
  relatedHacs.forEach((h) => {
    if (h.hac) parts.push(h.hac);
    if (h.detail) parts.push(h.detail);
    if (h.gpoCodObjeto) parts.push(h.gpoCodObjeto);
    if (h.equipment) parts.push(h.equipment);
  });

  // Related machines/equipments (palletizers) with matching HAC
  const relatedPalletizers = (masters.palletizers || []).filter(
    (p) => p.hacId === cause.hac || safeHacMatch(p.hacId, cause.hac)
  );
  relatedPalletizers.forEach((p) => {
    if (p.name) parts.push(p.name);
    if (p.hacId) parts.push(p.hacId);
  });

  // Related baggers with matching HAC
  const relatedBaggers = (masters.baggers || []).filter(
    (b) => b.hacId === cause.hac || safeHacMatch(b.hacId, cause.hac)
  );
  relatedBaggers.forEach((b) => {
    if (b.name) parts.push(b.name);
    if (b.hacId) parts.push(b.hacId);
  });

  return parts;
}
