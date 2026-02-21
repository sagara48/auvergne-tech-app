// ═══════════════════════════════════════════════════════════════
// PDF EXPORTS — Fonctions par module
// ═══════════════════════════════════════════════════════════════

import { PDFBuilder, PDF_COLORS, fmtDate, fmtDateTime, safe, trunc } from './pdfBuilder';

// ═══════════════════════════════════════════════════
// 1. MISE EN SERVICE — PV officiel
// ═══════════════════════════════════════════════════

export function exportMiseEnService(mes: any) {
  const pdf = new PDFBuilder('PV de Mise en Service', mes.code);
  
  pdf.docTitle('Procès-Verbal de Mise en Service', mes.statut?.toUpperCase());
  pdf.docSubtitle(`${mes.code} — ${fmtDate(mes.date_prevue)}`);

  pdf.section('Informations générales');
  pdf.info([
    ['Code', mes.code],
    ['Date prévue', fmtDate(mes.date_prevue)],
    ['Ascenseur', mes.ascenseur?.code || '—'],
    ['Adresse', mes.ascenseur?.adresse || '—'],
    ['Technicien', mes.technicien ? `${mes.technicien.prenom} ${mes.technicien.nom}` : '—'],
    ['Étape actuelle', `${mes.etape_actuelle || 0} / 7`],
  ]);

  pdf.section('Checklist de vérification');
  pdf.checklist([
    { label: 'Préparation', checked: mes.etape1_preparation, detail: 'Dossier technique, outils, EPI' },
    { label: 'Vérification électrique', checked: mes.etape2_verification_electrique, detail: 'Alimentation, câblage, protection' },
    { label: 'Vérification mécanique', checked: mes.etape3_verification_mecanique, detail: 'Rails, guides, portes, contrepoids' },
    { label: 'Essais à vide', checked: mes.etape4_essais_vide, detail: 'Montée/descente, arrêts, nivellement' },
    { label: 'Essais en charge', checked: mes.etape5_essais_charge, detail: 'Charge nominale, surcharge, vitesse' },
    { label: 'Sécurités', checked: mes.etape6_securites, detail: 'Parachute, limiteur, détecteurs, alarme' },
    { label: 'Validation finale', checked: mes.etape7_validation, detail: 'Conformité globale, documentation' },
  ]);

  if (mes.remarques) {
    pdf.section('Remarques');
    pdf.noteBox(mes.remarques);
  }

  pdf.section('Signatures');
  pdf.signatureBlock(['Technicien', 'Responsable', 'Client']);

  pdf.save(`PV-MES-${mes.code}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 2. TRAVAUX — Rapport d'intervention
// ═══════════════════════════════════════════════════

export function exportTravaux(travaux: any) {
  const pdf = new PDFBuilder("Rapport d'Intervention", travaux.code);

  pdf.docTitle("Rapport d'Intervention", travaux.statut?.toUpperCase());
  pdf.docSubtitle(`${travaux.code} — ${travaux.titre}`);

  pdf.section('Informations');
  pdf.info([
    ['Code', travaux.code],
    ['Type', safe(travaux.type_travaux)],
    ['Priorité', safe(travaux.priorite)],
    ['Statut', safe(travaux.statut)],
    ['Client', travaux.client?.raison_sociale || '—'],
    ['Ascenseur', travaux.ascenseur?.code || '—'],
    ['Technicien', travaux.technicien ? `${travaux.technicien.prenom} ${travaux.technicien.nom}` : '—'],
    ['Progression', `${travaux.progression || 0}%`],
    ['Date début', fmtDate(travaux.date_debut)],
    ['Date fin prévue', fmtDate(travaux.date_fin_prevue)],
  ]);

  if (travaux.description) {
    pdf.section('Description');
    pdf.text(travaux.description);
  }

  // Tâches
  if (travaux.taches?.length > 0) {
    pdf.section('Tâches');
    pdf.table(
      ['#', 'Description', 'Statut', 'Remarque'],
      travaux.taches.map((t: any, i: number) => [
        String(i + 1),
        trunc(t.description, 50),
        safe(t.statut),
        trunc(t.remarque, 30),
      ])
    );
  }

  // Pièces utilisées
  if (travaux.pieces?.length > 0) {
    pdf.section('Pièces utilisées');
    pdf.table(
      ['Désignation', 'Référence', 'Qté', 'Source', 'Consommée'],
      travaux.pieces.map((p: any) => [
        trunc(p.designation, 35),
        safe(p.reference),
        String(p.quantite),
        safe(p.source),
        p.consommee ? '✓' : '—',
      ])
    );
  }

  if (travaux.devis_montant) {
    pdf.section('Montant');
    pdf.text(`Montant devis : ${travaux.devis_montant.toFixed(2)} € HT`, { bold: true, size: 11 });
  }

  pdf.section('Signatures');
  pdf.signatureBlock(['Technicien', 'Client']);

  pdf.save(`Rapport-${travaux.code}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 3. COMMANDES — Bon de commande
// ═══════════════════════════════════════════════════

export function exportCommande(commande: any) {
  const pdf = new PDFBuilder('Bon de Commande', commande.code);

  pdf.docTitle('Bon de Commande', commande.statut?.toUpperCase());
  pdf.docSubtitle(`N° ${commande.code}`);

  pdf.section('Commande');
  pdf.info([
    ['N° commande', commande.code],
    ['Date', fmtDate(commande.date_commande)],
    ['Fournisseur', safe(commande.fournisseur)],
    ['Statut', safe(commande.statut)],
    ['Demandeur', commande.technicien ? `${commande.technicien.prenom} ${commande.technicien.nom}` : '—'],
    ['Livraison prévue', fmtDate(commande.date_livraison_prevue)],
  ]);

  if (commande.lignes?.length > 0) {
    pdf.section('Articles commandés');
    const rows = commande.lignes.map((l: any) => [
      safe(l.reference),
      trunc(l.designation, 40),
      String(l.quantite),
      l.prix_unitaire ? `${l.prix_unitaire.toFixed(2)} €` : '—',
      l.prix_unitaire && l.quantite ? `${(l.prix_unitaire * l.quantite).toFixed(2)} €` : '—',
    ]);
    const total = commande.lignes.reduce((s: number, l: any) => s + (l.prix_unitaire || 0) * (l.quantite || 0), 0);
    rows.push(['', '', '', 'TOTAL HT', `${total.toFixed(2)} €`]);

    pdf.table(
      ['Référence', 'Désignation', 'Qté', 'PU HT', 'Total HT'],
      rows,
      { columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } } }
    );
  }

  if (commande.remarques) {
    pdf.section('Remarques');
    pdf.noteBox(commande.remarques);
  }

  pdf.save(`BC-${commande.code}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 4. TOURNÉES — Feuille de route
// ═══════════════════════════════════════════════════

export function exportTournee(tournee: any, interventions: any[]) {
  const pdf = new PDFBuilder('Feuille de Route', tournee.code, 'portrait');

  pdf.docTitle('Feuille de Route', tournee.frequence?.toUpperCase());
  pdf.docSubtitle(`${tournee.nom} — ${tournee.code}`);

  pdf.section('Tournée');
  pdf.info([
    ['Code', tournee.code],
    ['Secteur', safe(tournee.secteur)],
    ['Technicien', tournee.technicien ? `${tournee.technicien.prenom} ${tournee.technicien.nom}` : '—'],
    ['Nb ascenseurs', String(tournee.nb_ascenseurs)],
  ]);

  if (interventions?.length > 0) {
    pdf.section(`Interventions du jour (${interventions.length})`);
    pdf.table(
      ['#', 'Ascenseur', 'Adresse', 'Ville', 'Type', 'Heure', 'Statut'],
      interventions.map((itv: any, i: number) => [
        String(i + 1),
        safe(itv.ascenseur_code),
        trunc(itv.adresse, 30),
        safe(itv.ville),
        safe(itv.type),
        safe(itv.heure),
        safe(itv.statut),
      ])
    );
  }

  // Zone notes terrain
  pdf.section('Notes terrain');
  pdf.doc.setDrawColor(...PDF_COLORS.border);
  pdf.doc.setLineWidth(0.1);
  for (let i = 0; i < 8; i++) {
    pdf.doc.line(20, pdf.y + i * 6, pdf.pw - 20, pdf.y + i * 6);
  }
  pdf.y += 50;

  pdf.save(`FDR-${tournee.code}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 5. FEUILLES D'HEURES — Récap mensuel
// ═══════════════════════════════════════════════════

export function exportFeuilleHeures(technicien: any, semaines: any[], mois: string) {
  const pdf = new PDFBuilder("Feuille d'Heures", mois);

  pdf.docTitle("Récapitulatif d'Heures");
  pdf.docSubtitle(`${technicien.prenom} ${technicien.nom} — ${mois}`);

  // Stats globales
  const totalHeures = semaines.reduce((s, sem) => s + (sem.total_heures || 0), 0);
  const totalSup = semaines.reduce((s, sem) => s + (sem.heures_sup || 0), 0);
  const totalAstreinte = semaines.reduce((s, sem) => s + (sem.nb_astreintes || 0), 0);

  pdf.kpiRow([
    { label: 'Heures travaillées', value: `${totalHeures.toFixed(1)}h` },
    { label: 'Heures sup.', value: `${totalSup.toFixed(1)}h`, color: PDF_COLORS.warning },
    { label: 'Astreintes', value: String(totalAstreinte), color: PDF_COLORS.secondary },
    { label: 'Semaines', value: String(semaines.length) },
  ]);

  pdf.section('Détail par semaine');
  pdf.table(
    ['Semaine', 'Du', 'Au', 'Heures', 'H. Sup', 'Astreintes', 'Statut'],
    semaines.map((s: any) => [
      `S${s.numero}`,
      fmtDate(s.date_debut),
      fmtDate(s.date_fin),
      `${(s.total_heures || 0).toFixed(1)}h`,
      s.heures_sup ? `${s.heures_sup.toFixed(1)}h` : '—',
      String(s.nb_astreintes || 0),
      safe(s.statut),
    ])
  );

  pdf.section('Signatures');
  pdf.signatureBlock(['Technicien', 'Responsable']);

  pdf.save(`Heures-${technicien.nom}-${mois}.pdf`);
}

// ═══════════════════════════════════════════════════
// 6. PARC ASCENSEURS — Fiche technique
// ═══════════════════════════════════════════════════

export function exportFicheAscenseur(asc: any, pannes?: any[], visites?: any[]) {
  const pdf = new PDFBuilder('Fiche Technique Ascenseur', asc.code);

  pdf.docTitle('Fiche Technique', asc.statut?.toUpperCase());
  pdf.docSubtitle(`${asc.code} — ${asc.adresse || ''}`);

  pdf.section('Identification');
  pdf.info([
    ['Code appareil', asc.code],
    ['Adresse', safe(asc.adresse)],
    ['Ville', safe(asc.ville)],
    ['Client', asc.client?.raison_sociale || '—'],
    ['Type', safe(asc.type_ascenseur)],
    ['Marque', safe(asc.marque)],
    ['Modèle', safe(asc.modele)],
    ['Contrat', safe(asc.type_contrat)],
    ['Secteur', safe(asc.secteur)],
    ['Statut', safe(asc.statut)],
    ['Dernière visite', fmtDate(asc.derniere_visite)],
    ['Prochaine visite', fmtDate(asc.prochaine_visite)],
  ], 2);

  // Pannes récentes
  if (pannes && pannes.length > 0) {
    pdf.section(`Pannes récentes (${pannes.length})`);
    pdf.table(
      ['Date', 'Cause', 'Motif', 'Durée'],
      pannes.slice(0, 15).map((p: any) => [
        fmtDate(p.date_appel),
        trunc(safe(p.cause), 25),
        trunc(safe(p.motif), 35),
        safe(p.duree),
      ])
    );
  }

  // Visites
  if (visites && visites.length > 0) {
    pdf.section('Historique visites');
    pdf.table(
      ['Date', 'Type', 'Technicien', 'Observations'],
      visites.slice(0, 15).map((v: any) => [
        fmtDate(v.date),
        safe(v.type),
        safe(v.technicien),
        trunc(v.observations, 35),
      ])
    );
  }

  pdf.save(`Fiche-${asc.code}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 7. STOCK — État d'inventaire
// ═══════════════════════════════════════════════════

export function exportStock(articles: any[], titre = 'État du Stock') {
  const pdf = new PDFBuilder(titre, fmtDate(new Date()), 'landscape');

  pdf.docTitle(titre);
  pdf.docSubtitle(`${articles.length} articles — export du ${fmtDate(new Date())}`);

  // KPIs
  const totalArticles = articles.length;
  const enAlerte = articles.filter((a: any) => a.quantite <= (a.seuil_alerte || 0)).length;
  const valeurTotale = articles.reduce((s: number, a: any) => s + (a.quantite || 0) * (a.prix_unitaire || 0), 0);

  pdf.kpiRow([
    { label: 'Articles', value: String(totalArticles) },
    { label: 'Alertes stock bas', value: String(enAlerte), color: PDF_COLORS.error },
    { label: 'Valeur totale', value: `${valeurTotale.toFixed(0)} €` },
  ]);

  pdf.section('Inventaire détaillé');
  pdf.table(
    ['Référence', 'Désignation', 'Catégorie', 'Qté', 'Seuil', 'PU', 'Valeur', 'Emplacement'],
    articles.map((a: any) => [
      safe(a.reference),
      trunc(a.designation, 30),
      safe(a.categorie),
      String(a.quantite || 0),
      String(a.seuil_alerte || '—'),
      a.prix_unitaire ? `${a.prix_unitaire.toFixed(2)} €` : '—',
      a.prix_unitaire ? `${((a.quantite || 0) * a.prix_unitaire).toFixed(2)} €` : '—',
      safe(a.emplacement),
    ]),
    { columnStyles: { 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right' } } }
  );

  pdf.save(`Stock-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 8. PIÈCES DÉTACHÉES — Catalogue
// ═══════════════════════════════════════════════════

export function exportPieces(pieces: any[]) {
  const pdf = new PDFBuilder('Catalogue Pièces Détachées', '', 'landscape');
  
  pdf.docTitle('Catalogue Pièces Détachées');
  pdf.docSubtitle(`${pieces.length} pièces référencées`);

  pdf.table(
    ['Référence', 'Désignation', 'Marque', 'Catégorie', 'Compatible', 'Qté Stock', 'PU HT', 'Fournisseur'],
    pieces.map((p: any) => [
      safe(p.reference),
      trunc(p.designation, 30),
      safe(p.marque),
      safe(p.categorie),
      trunc(p.compatibilite, 20),
      String(p.quantite_stock || 0),
      p.prix ? `${p.prix.toFixed(2)} €` : '—',
      safe(p.fournisseur),
    ]),
    { columnStyles: { 5: { halign: 'center' }, 6: { halign: 'right' } } }
  );

  pdf.save(`Pieces-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 9. VÉHICULES — Fiche véhicule
// ═══════════════════════════════════════════════════

export function exportVehicule(vehicule: any, stockVehicule?: any[]) {
  const pdf = new PDFBuilder('Fiche Véhicule', vehicule.immatriculation);

  pdf.docTitle('Fiche Véhicule');
  pdf.docSubtitle(vehicule.immatriculation);

  pdf.section('Identification');
  pdf.info([
    ['Immatriculation', vehicule.immatriculation],
    ['Marque / Modèle', `${safe(vehicule.marque)} ${safe(vehicule.modele)}`],
    ['Année', safe(vehicule.annee)],
    ['Type', safe(vehicule.type_vehicule)],
    ['Kilométrage', `${vehicule.kilometrage?.toLocaleString() || 0} km`],
    ['Statut', safe(vehicule.statut)],
    ['Technicien attribué', vehicule.technicien ? `${vehicule.technicien.prenom} ${vehicule.technicien.nom}` : '—'],
    ['Capacité stock', safe(vehicule.capacite_stock)],
    ['Date CT', fmtDate(vehicule.date_ct)],
    ['Date assurance', fmtDate(vehicule.date_assurance)],
  ]);

  // Stock embarqué
  if (stockVehicule && stockVehicule.length > 0) {
    pdf.section(`Stock embarqué (${stockVehicule.length} articles)`);
    pdf.table(
      ['Référence', 'Désignation', 'Qté', 'Emplacement'],
      stockVehicule.map((s: any) => [
        safe(s.reference),
        trunc(s.designation, 40),
        String(s.quantite || 0),
        safe(s.emplacement),
      ])
    );
  }

  pdf.save(`Vehicule-${vehicule.immatriculation}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 10. PLANNING — Planning hebdo
// ═══════════════════════════════════════════════════

export function exportPlanning(events: any[], semaine: string, technicien?: string) {
  const pdf = new PDFBuilder('Planning', semaine, 'landscape');

  pdf.docTitle('Planning Hebdomadaire');
  pdf.docSubtitle(`${semaine}${technicien ? ' — ' + technicien : ''}`);

  if (events.length > 0) {
    pdf.table(
      ['Jour', 'Horaire', 'Type', 'Titre', 'Lieu', 'Technicien', 'Statut'],
      events.map((e: any) => [
        fmtDate(e.date, 'EEEE dd/MM'),
        `${safe(e.heure_debut)} - ${safe(e.heure_fin)}`,
        safe(e.type),
        trunc(e.titre, 30),
        trunc(e.lieu, 25),
        safe(e.technicien),
        safe(e.statut),
      ])
    );
  } else {
    pdf.text('Aucun événement planifié pour cette période.', { color: PDF_COLORS.muted });
  }

  pdf.save(`Planning-${semaine}.pdf`);
}

// ═══════════════════════════════════════════════════
// 11. DEMANDES — Fiche demande
// ═══════════════════════════════════════════════════

export function exportDemande(demande: any) {
  const pdf = new PDFBuilder('Fiche Demande', demande.code);

  pdf.docTitle('Fiche de Demande', demande.statut?.toUpperCase());
  pdf.docSubtitle(`${demande.code} — ${safe(demande.type)}`);

  pdf.section('Demande');
  pdf.info([
    ['Code', demande.code],
    ['Type', safe(demande.type)],
    ['Statut', safe(demande.statut)],
    ['Priorité', safe(demande.priorite)],
    ['Demandeur', demande.demandeur ? `${demande.demandeur.prenom} ${demande.demandeur.nom}` : '—'],
    ['Date création', fmtDate(demande.created_at)],
    ['Date souhaitée', fmtDate(demande.date_souhaitee)],
    ['Approbateur', demande.approbateur ? `${demande.approbateur.prenom} ${demande.approbateur.nom}` : '—'],
  ]);

  if (demande.description) {
    pdf.section('Description');
    pdf.text(demande.description);
  }

  if (demande.commentaire_validation) {
    pdf.section('Commentaire validation');
    pdf.noteBox(demande.commentaire_validation);
  }

  // Remboursement
  if (demande.type === 'remboursement' && demande.montant) {
    pdf.section('Remboursement');
    pdf.info([
      ['Catégorie', safe(demande.categorie_remboursement)],
      ['Montant', `${demande.montant.toFixed(2)} €`],
    ], 2);
  }

  pdf.section('Signatures');
  pdf.signatureBlock(['Demandeur', 'Responsable']);

  pdf.save(`Demande-${demande.code}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 12. NOTES — Export note
// ═══════════════════════════════════════════════════

export function exportNote(note: any) {
  const pdf = new PDFBuilder('Note', note.titre);

  pdf.docTitle(trunc(note.titre, 50));
  pdf.docSubtitle(`Catégorie : ${safe(note.categorie)} — Priorité : ${safe(note.priorite)}`);

  pdf.info([
    ['Auteur', note.auteur ? `${note.auteur.prenom} ${note.auteur.nom}` : '—'],
    ['Créée le', fmtDateTime(note.created_at)],
    ['Échéance', fmtDate(note.echeance)],
    ['Statut', safe(note.statut)],
  ]);

  if (note.contenu) {
    pdf.section('Contenu');
    pdf.text(note.contenu);
  }

  if (note.tags?.length > 0) {
    pdf.text(`Tags : ${note.tags.join(', ')}`, { color: PDF_COLORS.secondary, size: 8 });
  }

  pdf.save(`Note-${fmtDate(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 13. DOCUMENTS (GED) — Liste documents
// ═══════════════════════════════════════════════════

export function exportListeDocuments(documents: any[], context?: string) {
  const pdf = new PDFBuilder('Liste Documents', context || '', 'landscape');

  pdf.docTitle('Gestion Documentaire');
  pdf.docSubtitle(`${documents.length} documents${context ? ' — ' + context : ''}`);

  pdf.table(
    ['Nom', 'Type', 'Catégorie', 'Auteur', 'Date', 'Taille', 'Lié à'],
    documents.map((d: any) => [
      trunc(d.nom, 35),
      safe(d.type),
      safe(d.categorie),
      safe(d.auteur),
      fmtDate(d.created_at),
      safe(d.taille),
      safe(d.entite_liee),
    ])
  );

  pdf.save(`Documents-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 14. MESSAGES (CHAT) — Export conversation
// ═══════════════════════════════════════════════════

export function exportConversation(messages: any[], channelName: string) {
  const pdf = new PDFBuilder('Conversation', channelName);

  pdf.docTitle('Export Conversation');
  pdf.docSubtitle(`Canal : ${channelName} — ${messages.length} messages`);

  messages.forEach((msg: any) => {
    pdf.ensure(12);
    const d = pdf.doc;
    d.setFont('helvetica', 'bold');
    d.setFontSize(8);
    d.setTextColor(...PDF_COLORS.accent);
    d.text(`${safe(msg.auteur)}`, 20, pdf.y);
    d.setFont('helvetica', 'normal');
    d.setFontSize(7);
    d.setTextColor(...PDF_COLORS.muted);
    d.text(fmtDateTime(msg.created_at), 80, pdf.y);
    pdf.y += 4;
    pdf.text(safe(msg.contenu));
    pdf.separator();
  });

  pdf.save(`Chat-${channelName}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 15. QR CODES — Liste QR
// ═══════════════════════════════════════════════════

export function exportQRCodes(qrcodes: any[]) {
  const pdf = new PDFBuilder('QR Codes', '', 'landscape');

  pdf.docTitle('Registre QR Codes');
  pdf.docSubtitle(`${qrcodes.length} QR codes enregistrés`);

  pdf.table(
    ['ID', 'Type', 'Libellé', 'Lié à', 'Emplacement', 'Créé le', 'Dernier scan'],
    qrcodes.map((qr: any) => [
      safe(qr.code),
      safe(qr.type),
      trunc(qr.libelle, 25),
      safe(qr.entite_liee),
      trunc(qr.emplacement, 25),
      fmtDate(qr.created_at),
      fmtDate(qr.dernier_scan),
    ])
  );

  pdf.save(`QRCodes-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 16. ARCHIVES — Liste archives
// ═══════════════════════════════════════════════════

export function exportArchives(archives: any[]) {
  const pdf = new PDFBuilder('Archives', '', 'landscape');

  pdf.docTitle('Archives');
  pdf.docSubtitle(`${archives.length} éléments archivés`);

  pdf.table(
    ['Type', 'Code', 'Titre', 'Date archivage', 'Archivé par', 'Motif'],
    archives.map((a: any) => [
      safe(a.type),
      safe(a.code),
      trunc(a.titre, 30),
      fmtDate(a.date_archivage),
      safe(a.archive_par),
      trunc(a.motif, 30),
    ])
  );

  pdf.save(`Archives-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}

// ═══════════════════════════════════════════════════
// 17. DASHBOARD — Rapport synthèse
// ═══════════════════════════════════════════════════

export function exportDashboard(stats: {
  ascenseurs_total?: number;
  ascenseurs_en_panne?: number;
  travaux_en_cours?: number;
  tournees_du_jour?: number;
  alertes_stock?: number;
  interventions_mois?: number;
  taux_disponibilite?: number;
  pannes_mois?: number;
}) {
  const pdf = new PDFBuilder('Rapport de Synthèse');

  pdf.docTitle('Rapport de Synthèse');
  pdf.docSubtitle(`État au ${fmtDate(new Date(), 'dd MMMM yyyy')}`);

  pdf.kpiRow([
    { label: 'Ascenseurs', value: String(stats.ascenseurs_total || 0) },
    { label: 'En panne', value: String(stats.ascenseurs_en_panne || 0), color: PDF_COLORS.error },
    { label: 'Travaux en cours', value: String(stats.travaux_en_cours || 0), color: PDF_COLORS.warning },
    { label: 'Tournées du jour', value: String(stats.tournees_du_jour || 0) },
  ]);

  pdf.kpiRow([
    { label: 'Alertes stock', value: String(stats.alertes_stock || 0), color: PDF_COLORS.error },
    { label: 'Interventions/mois', value: String(stats.interventions_mois || 0) },
    { label: 'Taux disponibilité', value: `${(stats.taux_disponibilite || 0).toFixed(1)}%`, color: PDF_COLORS.success },
    { label: 'Pannes/mois', value: String(stats.pannes_mois || 0), color: PDF_COLORS.warning },
  ]);

  pdf.text('Ce rapport présente un état synthétique de l\'activité AuvergneTech à la date d\'export.', { size: 9, color: PDF_COLORS.secondary });

  pdf.save(`Synthese-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}
