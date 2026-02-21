// ═══════════════════════════════════════════════════════════════
// GÉNÉRATION IA — Pièce tôlerie depuis description texte
// Feature 65: "Décris ta pièce, l'IA la crée"
// ═══════════════════════════════════════════════════════════════

import type { PieceConfig, Matiere, Finition, FormeBase, TypeTrou, Pli, Trou, Encoche, Chanfrein } from './tolerie';
import { createDefaultPiece, uid } from './tolerie';

const SYSTEM_PROMPT = `Tu es un expert en tôlerie industrielle pour ascenseurs. Tu génères des pièces de tôlerie à partir de descriptions en langage naturel.

RÈGLES STRICTES :
- Réponds UNIQUEMENT en JSON valide, rien d'autre (pas de markdown, pas de commentaires)
- Toutes les dimensions en mm
- Les positions de plis sont mesurées depuis le bord gauche de la tôle développée
- Les positions de trous X/Y sont depuis le coin haut-gauche
- rayonInterne minimum = épaisseur de la tôle

MATIÈRES DISPONIBLES : acier, inox304, inox316, aluminium, galvanise
FINITIONS : brut, peinture, zingue, anodise, brosse, poli
FORMES : rectangle (platine), L (1 pli 90°), U (2 plis 90°), Z (2 plis inversés), custom
TYPES TROUS : rond, oblong, fraise, taraude

CONSTRUCTEURS ASCENSEURS connus :
- Otis: entraxe fixation standard 160×100mm, trous ∅12
- Schindler: triangle 120mm, trous ∅10
- Kone: oblongs ∅10×18, entraxe 120mm
- ThyssenKrupp: rect 140×80, trous ∅11

FORMAT DE RÉPONSE (JSON strictement) :
{
  "nom": "string",
  "matiere": "acier|inox304|inox316|aluminium|galvanise",
  "epaisseur": number,
  "finition": "brut|peinture|zingue|anodise|brosse|poli",
  "formeBase": "rectangle|L|U|Z|custom",
  "largeur": number,
  "hauteur": number,
  "brancheL": number_ou_null,
  "profondeurU": number_ou_null,
  "decalageZ": number_ou_null,
  "plis": [{"position": number, "angle": number, "rayonInterne": number, "direction": "haut|bas"}],
  "trous": [{"x": number, "y": number, "type": "rond|oblong|fraise|taraude", "diametre": number, "longueurOblong": number_ou_null}],
  "encoches": [{"x": number, "y": number, "largeur": number, "hauteur": number, "cote": "haut|bas|gauche|droite"}],
  "chanfreins": [{"coin": "hg|hd|bg|bd", "type": "chanfrein|rayon", "valeur": number}],
  "quantite": number,
  "remarques": "string"
}`;

export interface IAGenerationResult {
  success: boolean;
  piece?: PieceConfig;
  error?: string;
  raw?: string;
}

/**
 * Appelle l'API Anthropic pour générer une pièce depuis une description texte
 */
export async function genererPieceDepuisTexte(description: string): Promise<IAGenerationResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Génère la pièce tôlerie suivante en JSON:\n\n${description}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `API erreur ${response.status}: ${err}` };
    }

    const data = await response.json();
    const text = data.content
      ?.map((item: any) => (item.type === 'text' ? item.text : ''))
      .filter(Boolean)
      .join('\n') || '';

    // Nettoyer le JSON (enlever éventuels backticks markdown)
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      return { success: false, error: 'JSON invalide retourné par l\'IA', raw: clean };
    }

    // Convertir en PieceConfig
    const piece = jsonToPiece(parsed);
    return { success: true, piece, raw: clean };

  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur réseau' };
  }
}

/**
 * Convertit le JSON brut de l'IA en PieceConfig validé
 */
function jsonToPiece(j: any): PieceConfig {
  const base = createDefaultPiece();

  return {
    ...base,
    nom: j.nom || base.nom,
    matiere: validateEnum(j.matiere, ['acier', 'inox304', 'inox316', 'aluminium', 'galvanise'], 'acier') as Matiere,
    epaisseur: clamp(j.epaisseur || 2, 0.5, 20),
    finition: validateEnum(j.finition, ['brut', 'peinture', 'zingue', 'anodise', 'brosse', 'poli'], 'brut') as Finition,
    formeBase: validateEnum(j.formeBase, ['rectangle', 'L', 'U', 'Z', 'custom'], 'rectangle') as FormeBase,
    largeur: clamp(j.largeur || 200, 10, 5000),
    hauteur: clamp(j.hauteur || 100, 10, 3000),
    brancheL: j.brancheL || undefined,
    profondeurU: j.profondeurU || undefined,
    decalageZ: j.decalageZ || undefined,
    plis: (j.plis || []).map((p: any) => ({
      id: uid(),
      position: clamp(p.position || 0, 0, j.largeur || 2000),
      angle: clamp(p.angle || 90, 1, 180),
      rayonInterne: Math.max(p.rayonInterne || j.epaisseur || 2, j.epaisseur || 2),
      direction: p.direction === 'bas' ? 'bas' as const : 'haut' as const,
    })) as Pli[],
    trous: (j.trous || []).map((t: any) => ({
      id: uid(),
      x: clamp(t.x || 0, 0, j.largeur || 2000),
      y: clamp(t.y || 0, 0, j.hauteur || 1000),
      type: validateEnum(t.type, ['rond', 'oblong', 'fraise', 'taraude'], 'rond') as TypeTrou,
      diametre: clamp(t.diametre || 8, 1, 200),
      longueurOblong: t.longueurOblong || undefined,
    })) as Trou[],
    encoches: (j.encoches || []).map((e: any) => ({
      id: uid(),
      x: clamp(e.x || 0, 0, j.largeur || 2000),
      y: clamp(e.y || 0, 0, j.hauteur || 1000),
      largeur: clamp(e.largeur || 20, 1, 500),
      hauteur: clamp(e.hauteur || 10, 1, 500),
      cote: validateEnum(e.cote, ['haut', 'bas', 'gauche', 'droite'], 'haut'),
    })) as Encoche[],
    chanfreins: (j.chanfreins || []).map((c: any) => ({
      coin: validateEnum(c.coin, ['hg', 'hd', 'bg', 'bd'], 'hg'),
      type: validateEnum(c.type, ['chanfrein', 'rayon'], 'chanfrein'),
      valeur: clamp(c.valeur || 5, 0.5, 100),
    })) as Chanfrein[],
    marquages: [],
    annotations: [],
    quantite: clamp(j.quantite || 1, 1, 9999),
    remarques: j.remarques || '',
    statut: 'brouillon',
    statut_historique: [{ statut: 'brouillon', date: new Date().toISOString() }],
    reference: `IA-${Date.now().toString(36).toUpperCase().slice(-6)}`,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function validateEnum<T extends string>(v: string, opts: T[], fallback: T): T {
  return opts.includes(v as T) ? (v as T) : fallback;
}

// ═══ Exemples de descriptions ═══

export const EXEMPLES_IA: { label: string; description: string }[] = [
  {
    label: 'Platine moteur Otis',
    description: 'Platine de fixation moteur Otis Gen2, acier galvanisé 3mm, 200×150mm, 4 trous ∅12 entraxe 160×100, finition zinguée',
  },
  {
    label: 'Équerre rail 80×60',
    description: 'Équerre support rail en acier 4mm, largeur totale 140mm, hauteur 60mm, 1 pli à 90° pour branche de 60mm, 2 trous oblongs ∅10×20 centrés sur chaque branche, zingué',
  },
  {
    label: 'Capot inox U',
    description: 'Capot de protection en U, inox 304 brossé 1.5mm, largeur 300mm, profondeur U 80mm, hauteur 120mm, chanfreins rayons R5 aux 4 coins',
  },
  {
    label: 'Tôle gaine avec encoches',
    description: 'Tôle de fermeture gaine ascenseur, acier galva 1.5mm, 600×400mm, 2 encoches rectangulaires 30×15 en haut pour passage câbles, 6 trous ∅8 sur 2 lignes de 3 espacés de 200mm',
  },
  {
    label: 'Platine Schindler 3 pts',
    description: 'Platine triangulaire Schindler, acier 5mm, 180×150mm, 3 trous ∅10 en triangle (entraxe 120mm), marquage référence gravé au centre, peinture époxy',
  },
];
