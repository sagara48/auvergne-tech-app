# 🔗 Module Intégrations - AuvergneTech

Ce module ajoute 4 fonctionnalités cross-modules qui créent des synergies entre les différentes parties de l'application.

## 📦 Contenu

### 1. Documents Liés (GED Étendue)
**Fichier:** `src/components/integrations/DocumentsLies.tsx`

Permet d'attacher des documents à n'importe quelle entité (ascenseur, client, travaux, mise en service) avec:
- Gestion des types de documents (réglementaire, technique, administratif, photos)
- **Alertes d'expiration** automatiques (certificats, contrôles techniques)
- Upload par drag & drop
- Versioning des documents
- Vue compacte pour intégration en sidebar

**Utilisation:**
```tsx
import { DocumentsLies } from '@/components/integrations';

// Dans une fiche ascenseur
<DocumentsLies 
  entiteType="ascenseur" 
  entiteId={ascenseurId}
  codeAscenseur="ASC-0001" // optionnel, pour liaison par code
/>

// Mode compact (sidebar)
<DocumentsLies entiteType="travaux" entiteId={travauxId} compact />
```

---

### 2. Stock Véhicule avec Réapprovisionnement
**Fichier:** `src/components/integrations/StockVehiculeDetail.tsx`

Gestion avancée du stock embarqué dans les véhicules:
- **Alertes visuelles** (rupture, critique, bas)
- Génération automatique de demandes de réapprovisionnement
- Suivi du workflow: demande → validation → préparation → livraison
- Widget compact pour alertes rapides

**Utilisation:**
```tsx
import { StockVehiculeDetail, StockVehiculeWidget } from '@/components/integrations';

// Page détail véhicule
<StockVehiculeDetail vehiculeId={vehicule.id} />

// Widget alerte dans dashboard
<StockVehiculeWidget vehiculeId={vehicule.id} />
```

---

### 3. Travaux - Pièces Détaillées
**Fichier:** `src/components/integrations/TravauxPiecesEtapes.tsx`

Gestion des pièces nécessaires pour un chantier:
- Ajout depuis le stock ou manuel
- **Réservation automatique** depuis le stock dépôt
- Ajout au panier des pièces manquantes
- Suivi des statuts: à commander → réservé → commandé → reçu → installé
- Calcul automatique des coûts (prévu vs réel)

**Utilisation:**
```tsx
import { TravauxPieces } from '@/components/integrations';

// Dans le détail d'un travaux
<TravauxPieces travauxId={travaux.id} />
```

---

### 4. Travaux - Étapes avec Progression
**Fichier:** `src/components/integrations/TravauxPiecesEtapes.tsx`

Suivi détaillé des étapes d'un chantier:
- Actions rapides: Démarrer, Pause, Terminer
- Slider de progression
- Calcul automatique du pourcentage global
- Horodatage automatique (début/fin réelle)

**Utilisation:**
```tsx
import { TravauxEtapes } from '@/components/integrations';

<TravauxEtapes travauxId={travaux.id} />
```

---

## 🗄️ Migration SQL

Le fichier `supabase/migrations/integrations.sql` crée:

### Tables
| Table | Description |
|-------|-------------|
| `ged_types_documents` | Types de documents avec validité |
| `travaux_pieces` | Pièces liées aux travaux |
| `travaux_etapes` | Étapes de travaux avec progression |
| `travaux_temps` | Temps passé par étape |
| `stock_demandes_reappro` | Demandes de réapprovisionnement |
| `stock_demandes_reappro_lignes` | Lignes des demandes |

### Vues
| Vue | Description |
|-----|-------------|
| `v_documents_expiration` | Documents avec statut expiration |
| `v_travaux_avancement` | Avancement global des travaux |
| `v_alertes_stock_vehicule` | Alertes stock par véhicule |

### Fonctions RPC
| Fonction | Description |
|----------|-------------|
| `travaux_reserver_pieces(travaux_id)` | Réserve les pièces depuis le stock |
| `generer_demande_reappro(vehicule_id, technicien_id)` | Crée une demande auto |

---

## 🚀 Installation

### 1. Base de données
```bash
# Dans Supabase SQL Editor, exécuter:
supabase/migrations/integrations.sql
```

### 2. Composants React
Les fichiers sont déjà dans `src/components/integrations/`.

### 3. Imports
Ajouter dans les pages concernées:
```tsx
import { DocumentsLies, TravauxPieces, TravauxEtapes } from '@/components/integrations';
```

---

## 🔗 Schéma d'intégration

```
┌─────────────────────────────────────────────────────────────┐
│                      PARC ASCENSEURS                        │
│                            │                                │
│           ┌────────────────┼────────────────┐               │
│           ▼                ▼                ▼               │
│     ┌──────────┐    ┌──────────┐     ┌──────────┐          │
│     │ Documents│    │  Notes   │     │ Travaux  │          │
│     │   GED    │◄───│Contextuelles   │Détaillés │          │
│     └──────────┘    └──────────┘     └────┬─────┘          │
│           │                               │                 │
│           │              ┌────────────────┤                 │
│           │              ▼                ▼                 │
│           │        ┌──────────┐    ┌──────────┐            │
│           │        │  Pièces  │───▶│Commandes │            │
│           │        │ Détachées│    │          │            │
│           │        └────┬─────┘    └──────────┘            │
│           │             │                                   │
│           │             ▼                                   │
│           │     ┌──────────────┐                           │
│           └────▶│    Stock     │                           │
│                 │  Véhicules   │                           │
│                 └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Exemples d'intégration

### Fiche Ascenseur enrichie
```tsx
function FicheAscenseur({ ascenseur }) {
  return (
    <div>
      <h1>{ascenseur.code}</h1>
      
      {/* Informations de base */}
      <InfosAscenseur ascenseur={ascenseur} />
      
      {/* Documents liés avec alertes expiration */}
      <DocumentsLies 
        entiteType="ascenseur" 
        entiteId={ascenseur.id}
        codeAscenseur={ascenseur.code}
      />
      
      {/* Notes contextuelles */}
      <ContextNotes 
        contextType="ascenseur" 
        contextId={ascenseur.id} 
      />
    </div>
  );
}
```

### Détail Travaux complet
```tsx
function TravauxDetail({ travaux }) {
  return (
    <Tabs>
      <Tab label="Infos">
        <InfosTravaux travaux={travaux} />
      </Tab>
      
      <Tab label="Étapes">
        <TravauxEtapes travauxId={travaux.id} />
      </Tab>
      
      <Tab label="Pièces">
        <TravauxPieces travauxId={travaux.id} />
      </Tab>
      
      <Tab label="Documents">
        <DocumentsLies entiteType="travaux" entiteId={travaux.id} />
      </Tab>
    </Tabs>
  );
}
```

### Dashboard Véhicule
```tsx
function VehiculeCard({ vehicule }) {
  return (
    <Card>
      <h3>{vehicule.immatriculation}</h3>
      
      {/* Alerte stock si nécessaire */}
      <StockVehiculeWidget vehiculeId={vehicule.id} />
    </Card>
  );
}
```
