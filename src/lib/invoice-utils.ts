
'use client';

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { User } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const generateInvoicePDF = (userData: User, price: string) => {
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'dd/MM/yyyy');
  const monthYear = format(new Date(), 'MMMM yyyy', { locale: fr });
  const invoiceRef = `FAC-${format(new Date(), 'yyyyMM')}-${(userData.loginId || 'INV').toUpperCase()}`;

  // En-tête
  doc.setFontSize(22);
  doc.setTextColor(30, 77, 59); // Vert #1E4D3B
  doc.text('GROW&GO', 20, 30);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Espace de travail Collaboratif', 20, 37);
  doc.text('123 Avenue du Design', 20, 42);
  doc.text('75000 Paris, France', 20, 47);

  // Titre Facture
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.text('FACTURE', 140, 30);
  
  doc.setFontSize(9);
  doc.text(`Référence : ${invoiceRef}`, 140, 37);
  doc.text(`Date : ${dateStr}`, 140, 42);

  // Informations Client
  doc.setDrawColor(230);
  doc.line(20, 55, 190, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATAIRE :', 20, 65);
  doc.setFont('helvetica', 'normal');
  doc.text(userData.name || 'Client', 20, 72);
  doc.text(userData.companyName || userData.companyId || 'Entreprise', 20, 77);
  doc.text(userData.email || '', 20, 82);

  // Tableau
  const tableData = [
    [
      'Abonnement Espace de travail GROW&GO',
      `Accès complet - Période de ${monthYear}`,
      '1',
      `${price} €`,
      `${price} €`
    ]
  ];

  (doc as any).autoTable({
    startY: 95,
    head: [['Désignation', 'Description', 'Qté', 'Prix Unitaire', 'Total HT']],
    body: tableData,
    headStyles: { fillColor: [30, 77, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 242, 234] }, // Beige clair #F5F2EA
    margin: { left: 20, right: 20 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  // Totaux
  const priceNum = parseFloat(price.replace(',', '.'));
  const tva = priceNum * 0.20;
  const totalTTC = priceNum + tva;

  doc.setFontSize(10);
  doc.text('Total HT :', 140, finalY);
  doc.text(`${price} €`, 175, finalY, { align: 'right' });
  
  doc.text('TVA (20%) :', 140, finalY + 7);
  doc.text(`${tva.toFixed(2).replace('.', ',')} €`, 175, finalY + 7, { align: 'right' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL TTC :', 140, finalY + 16);
  doc.text(`${totalTTC.toFixed(2).replace('.', ',')} €`, 175, finalY + 16, { align: 'right' });

  // Bas de page
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('Merci pour votre confiance.', 105, 280, { align: 'center' });
  doc.text('GROW&GO Studio - SIRET 123 456 789 00012 - RCS Paris', 105, 285, { align: 'center' });

  doc.save(`${invoiceRef}.pdf`);
};
