import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportNoteToPDF(note, project) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  let y = margin;

  // Header
  doc.setFillColor(project?.color || '#2563EB');
  doc.rect(0, 0, pageW, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text(note.title || 'Untitled Note', margin, (y += 30));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  if (project?.name) doc.text(`Project: ${project.name}`, margin, (y += 16));
  if (project?.client) doc.text(`Client: ${project.client}`, margin, (y += 14));
  doc.text(`Created: ${new Date(note.created_at).toLocaleDateString()}`, margin, (y += 14));
  y += 12;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // Body (strip HTML)
  const bodyText = (note.body || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .trim();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);

  const lines = doc.splitTextToSize(bodyText, pageW - margin * 2);
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 14;
  }

  // Tasks
  if (note.tasks && note.tasks.length > 0) {
    y += 10;
    if (y > doc.internal.pageSize.getHeight() - margin - 40) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Checklist', margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    for (const task of note.tasks) {
      if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
      const check = task.completed ? '☑' : '☐';
      doc.text(`${check}  ${task.text}`, margin, y);
      y += 14;
    }
  }

  // Attachments list
  if (note.attachments && note.attachments.length > 0) {
    y += 10;
    if (y > doc.internal.pageSize.getHeight() - margin - 40) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Attachments', margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);

    for (const att of note.attachments) {
      if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
      doc.text(`• ${att.original_name}`, margin, y);
      y += 13;
    }
  }

  doc.save(`${(note.title || 'note').replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

export async function exportProjectToPDF(project, notes) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();

  // Cover page
  doc.setFillColor(project.color || '#2563EB');
  doc.rect(0, 0, pageW, 200, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text(project.name, margin, 100);

  if (project.client) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(project.client, margin, 128);
  }

  doc.setFontSize(11);
  doc.setTextColor(220, 220, 220);
  doc.text(`Exported ${new Date().toLocaleDateString()} · ${notes.length} notes`, margin, 158);

  // Notes
  for (const note of notes) {
    doc.addPage();
    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text(note.title || 'Untitled', margin, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(new Date(note.created_at).toLocaleDateString(), margin, y);
    y += 18;

    const bodyText = (note.body || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '').trim();

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(bodyText, pageW - margin * 2);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 14;
    }
  }

  doc.save(`${project.name.replace(/[^a-z0-9]/gi, '_')}_export.pdf`);
}
