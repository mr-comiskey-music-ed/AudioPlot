import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { StudioProjectState, RubricEvaluation, PlacedGear, CableConnection } from '../types';
import { getGearById } from '../data/gearCatalog';
import { calculateXlrCablesCount } from '../utils/cableUtils';

export interface PdfExportOptions {
  filename?: string;
  includeGradingRubric?: boolean;
  includePatchList?: boolean;
  includeEquipmentManifest?: boolean;
  onProgress?: (status: string) => void;
  download?: boolean;
}

export async function generateStudioPlotPdf(
  project: StudioProjectState,
  evaluation: RubricEvaluation,
  options: PdfExportOptions = {}
): Promise<{ doc: jsPDF; blob: Blob; filename: string }> {
  const {
    filename,
    includeGradingRubric = true,
    includePatchList = true,
    includeEquipmentManifest = true,
    onProgress,
  } = options;

  onProgress?.('Capturing visual stage plot...');

  // 1. Capture Stage Canvas Snapshot
  let canvasImageBase64: string | null = null;
  const canvasElement = document.getElementById('studio-canvas-container');

  if (canvasElement) {
    try {
      const canvas = await html2canvas(canvasElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0c0c11',
        ignoreElements: (element) => {
          if (
            element.id === 'signal-flow-hud' ||
            element.id === 'cable-hooks-dock' ||
            element.classList.contains('no-pdf-capture')
          ) {
            return true;
          }
          return false;
        },
      });
      canvasImageBase64 = canvas.toDataURL('image/png', 0.95);
    } catch (err) {
      console.warn('Canvas DOM capture error, using programmatic plot renderer fallback:', err);
    }
  }

  // Programmatic fallback if html2canvas is unavailable or blocked
  if (!canvasImageBase64) {
    try {
      const plotCanvas = document.createElement('canvas');
      plotCanvas.width = 1200;
      plotCanvas.height = 800;
      const ctx = plotCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0c0c11';
        ctx.fillRect(0, 0, plotCanvas.width, plotCanvas.height);

        const isStudio = project.environment === 'recording_studio';
        ctx.fillStyle = isStudio ? '#171310' : '#0d0c0b';
        ctx.fillRect(25, 25, plotCanvas.width - 50, plotCanvas.height - 50);

        ctx.strokeStyle = isStudio ? '#D97706' : '#6366F1';
        ctx.lineWidth = 3;
        ctx.strokeRect(25, 25, plotCanvas.width - 50, plotCanvas.height - 50);

        if (isStudio) {
          ctx.fillStyle = '#0284C7';
          ctx.globalAlpha = 0.3;
          ctx.fillRect(plotCanvas.width / 2 - 220, plotCanvas.height - 45, 440, 24);
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = '#38BDF8';
          ctx.strokeRect(plotCanvas.width / 2 - 220, plotCanvas.height - 45, 440, 24);
          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('CONTROL ROOM WINDOW', plotCanvas.width / 2, plotCanvas.height - 29);
        } else {
          ctx.fillStyle = '#71717A';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('UPSTAGE BACKDROP', plotCanvas.width / 2, 45);
          ctx.fillStyle = '#A5B4FC';
          ctx.fillText('AUDIENCE / FRONT-OF-HOUSE', plotCanvas.width / 2, plotCanvas.height - 30);
        }

        // Draw cables
        const conns = project.connections || [];
        conns.forEach((conn) => {
          const fromGear = project.placedGear.find(g => g.instanceId === conn.fromInstanceId);
          const toGear = project.placedGear.find(g => g.instanceId === conn.toInstanceId);
          if (fromGear && toGear) {
            ctx.beginPath();
            ctx.moveTo(fromGear.x + 50, fromGear.y + 35);
            ctx.lineTo(toGear.x + 50, toGear.y + 35);
            ctx.strokeStyle = conn.cableType === 'xlr' ? '#38bdf8' : conn.cableType === 'quarter_inch' ? '#f97316' : '#a855f7';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        });

        // Draw placed gear
        project.placedGear.forEach((item) => {
          const def = getGearById(item.gearId);
          const gx = item.x || 100;
          const gy = item.y || 100;
          const gw = item.customWidth || def?.size?.width || 110;
          const gh = item.customHeight || def?.size?.height || 75;

          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(gx, gy, gw, gh, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(gx, gy, gw, 22);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(def?.name ? (def.name.length > 15 ? def.name.substring(0, 13) + '...' : def.name) : item.gearId, gx + 8, gy + 15);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '10px sans-serif';
          ctx.fillText(def?.model || 'Device', gx + 8, gy + 40);

          if (item.standHeight) {
            ctx.fillStyle = '#fbbf24';
            ctx.font = '9px sans-serif';
            ctx.fillText(`Stand: ${item.standHeight}`, gx + 8, gy + 56);
          }

          const assignedCh = item.assignedChannel || project.mixerChannels.find(c => c.assignedGearInstanceId === item.instanceId)?.channelNumber;
          if (assignedCh) {
            ctx.fillStyle = '#34d399';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(`CH ${assignedCh}`, gx + gw - 45, gy + gh - 8);
          }
        });

        canvasImageBase64 = plotCanvas.toDataURL('image/png', 0.95);
      }
    } catch (fallbackErr) {
      console.warn('Programmatic plot renderer fallback error:', fallbackErr);
    }
  }

  onProgress?.('Generating PDF document...');

  // Initialize jsPDF (Portrait Letter: 8.5 x 11 inches -> 215.9 x 279.4 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~215.9 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // ~279.4 mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // ~187.9 mm
  let currentY = 14;

  // Color Palette Constants
  const colors = {
    darkNavy: [15, 23, 42] as [number, number, number], // #0f172a
    charcoal: [30, 41, 59] as [number, number, number], // #1e293b
    orangeAccent: [234, 88, 12] as [number, number, number], // #ea580c
    orangeLight: [255, 237, 213] as [number, number, number], // #ffedd5
    emerald: [5, 150, 105] as [number, number, number], // #059669
    emeraldBg: [236, 253, 245] as [number, number, number], // #ecfdf5
    amber: [217, 119, 6] as [number, number, number], // #d97706
    amberBg: [254, 243, 199] as [number, number, number], // #fef3c7
    rose: [225, 29, 72] as [number, number, number], // #e11d48
    roseBg: [255, 228, 230] as [number, number, number], // #ffe4e6
    lightGray: [248, 250, 252] as [number, number, number], // #f8fafc
    borderGray: [226, 232, 240] as [number, number, number], // #e2e8f0
    textMuted: [100, 116, 139] as [number, number, number], // #64748b
    textDark: [15, 23, 42] as [number, number, number],
  };

  // Helper: Draw Header Bar
  const drawPageHeader = (pageNum: number, totalPages: number) => {
    doc.setFillColor(...colors.darkNavy);
    doc.rect(0, 0, pageWidth, 5, 'F');
  };

  // Helper: Draw Footer Bar & Page Numbers
  const drawPageFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 9;
    doc.setDrawColor(...colors.borderGray);
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 2, pageWidth - marginX, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.textMuted);
    doc.text(
      `AudioPlot • Educational Audio Engineering Platform • Generated: ${new Date().toLocaleString()}`,
      marginX,
      footerY + 2
    );

    const pageStr = `Page ${pageNum} of ${totalPages}`;
    doc.text(pageStr, pageWidth - marginX - doc.getTextWidth(pageStr), footerY + 2);
  };

  // -------------------------------------------------------------
  // PAGE 1: Title, Metadata, Score Card, Visual Plot, Packing Totals
  // -------------------------------------------------------------
  drawPageHeader(1, 2);

  // Top Header Banner
  doc.setFillColor(...colors.darkNavy);
  doc.roundedRect(marginX, currentY, contentWidth, 24, 2, 2, 'F');

  // App Brand & Project Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const displayTitle = project.title?.trim() || 'Studio Recording Session Plot';
  doc.text(displayTitle, marginX + 6, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const envLabel =
    project.environment === 'recording_studio'
      ? 'Recording Studio Tracking Session'
      : 'Live Concert Stage Plot & PA System';
  doc.text(`AudioPlot Engineering Specification & Diagnostics • ${envLabel}`, marginX + 6, currentY + 14);

  // Score Badge in Header (Right Side)
  const isScoreA = evaluation.percentage >= 90;
  const isScoreB = evaluation.percentage >= 80 && evaluation.percentage < 90;
  const badgeColor = isScoreA ? colors.emerald : isScoreB ? colors.amber : colors.rose;

  doc.setFillColor(...badgeColor);
  doc.roundedRect(pageWidth - marginX - 38, currentY + 3.5, 33, 17, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${evaluation.percentage}% (${evaluation.gradeLetter})`, pageWidth - marginX - 21.5, currentY + 10, {
    align: 'center',
  });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('SCORE VERIFIED', pageWidth - marginX - 21.5, currentY + 15.5, { align: 'center' });

  currentY += 27;

  // Metadata Grid (4 Columns)
  doc.setFillColor(...colors.lightGray);
  doc.setDrawColor(...colors.borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  const metaColWidth = contentWidth / 4;
  const studentDisplay = project.studentName?.trim() || 'Student Engineer';
  const sessionDisplay = project.title?.trim() || 'Recording Session Plot';
  const dateDisplay = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const metadataItems = [
    { label: 'STUDENT ENGINEER', val: studentDisplay },
    { label: 'SESSION TITLE', val: sessionDisplay },
    { label: 'DATE GENERATED', val: dateDisplay },
    {
      label: 'PLOT SUMMARY',
      val: `${project.placedGear.length} Gear • ${project.connections.length} Patches`,
    },
  ];

  metadataItems.forEach((item, index) => {
    const colX = marginX + index * metaColWidth + 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...colors.textMuted);
    doc.text(item.label, colX, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.textDark);
    doc.text(doc.splitTextToSize(item.val, metaColWidth - 5)[0] || item.val, colX, currentY + 10);
  });

  currentY += 17;

  // VISUAL STAGE PLOT SNAPSHOT SECTION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...colors.textDark);
  doc.text('1. Stage & Floor Plan Layout Blueprint', marginX, currentY);

  currentY += 3;

  if (canvasImageBase64) {
    const plotBoxHeight = 85;
    doc.setDrawColor(...colors.darkNavy);
    doc.setLineWidth(0.6);
    doc.setFillColor(12, 12, 17);
    doc.roundedRect(marginX, currentY, contentWidth, plotBoxHeight, 2, 2, 'FD');

    // Add Image to PDF
    doc.addImage(
      canvasImageBase64,
      'PNG',
      marginX + 1,
      currentY + 1,
      contentWidth - 2,
      plotBoxHeight - 2,
      undefined,
      'FAST'
    );

    // Caption underneath
    currentY += plotBoxHeight + 3;
  } else {
    // Fallback if image capture is unavailable
    const emptyBoxHeight = 50;
    doc.setFillColor(...colors.lightGray);
    doc.setDrawColor(...colors.borderGray);
    doc.roundedRect(marginX, currentY, contentWidth, emptyBoxHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.textMuted);
    doc.text('Visual floor plan render generated with placed equipment nodes.', marginX + 10, currentY + 25);
    currentY += emptyBoxHeight + 3;
  }

  // Itemized Equipment Placement & Setup Manifest Table for Section 1
  if (project.placedGear.length > 0) {
    currentY += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.textDark);
    doc.text('Placed Equipment & Setup Configuration Manifest:', marginX, currentY);
    currentY += 3;

    const gearCols = [52, 45, 32, 34, 24.9]; // sum = 187.9 mm
    const gearHeaders = ['EQUIPMENT ITEM', 'MODEL / TYPE', 'CATEGORY', 'STAND & MOUNTING', 'ASSIGNED CH'];

    doc.setFillColor(...colors.charcoal);
    doc.rect(marginX, currentY, contentWidth, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);

    let curGX = marginX;
    gearHeaders.forEach((h, i) => {
      doc.text(h, curGX + 2, currentY + 3.8);
      curGX += gearCols[i];
    });

    currentY += 5.5;

    project.placedGear.forEach((g, idx) => {
      const def = getGearById(g.gearId);
      const isEven = idx % 2 === 0;
      const rowH = 6;

      if (currentY > 255) return;

      doc.setFillColor(isEven ? colors.lightGray[0] : 255, isEven ? colors.lightGray[1] : 255, isEven ? colors.lightGray[2] : 255);
      doc.rect(marginX, currentY, contentWidth, rowH, 'F');
      doc.setDrawColor(...colors.borderGray);
      doc.setLineWidth(0.2);
      doc.line(marginX, currentY + rowH, marginX + contentWidth, currentY + rowH);

      let colX = marginX;
      // Col 0: Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...colors.darkNavy);
      doc.text(doc.splitTextToSize(def?.name || g.gearId, gearCols[0] - 4)[0] || (def?.name || g.gearId), colX + 2, currentY + 4);
      colX += gearCols[0];

      // Col 1: Model
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...colors.textDark);
      doc.text(doc.splitTextToSize(def?.model || 'Standard', gearCols[1] - 4)[0] || 'Standard', colX + 2, currentY + 4);
      colX += gearCols[1];

      // Col 2: Category
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...colors.textMuted);
      doc.text(def?.category || 'gear', colX + 2, currentY + 4);
      colX += gearCols[2];

      // Col 3: Stand & Mounting
      let standStr = '—';
      if (g.standHeight) {
        standStr = g.standHeight.replace('_', ' ');
      }
      if (g.hasPopFilter) standStr += ' + Pop Filter';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...colors.textDark);
      doc.text(doc.splitTextToSize(standStr, gearCols[3] - 4)[0] || standStr, colX + 2, currentY + 4);
      colX += gearCols[3];

      // Col 4: Channel
      const assignedCh = g.assignedChannel || project.mixerChannels.find(c => c.assignedGearInstanceId === g.instanceId)?.channelNumber;
      const chStr = assignedCh ? `CH ${assignedCh}` : 'Unpatched';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(assignedCh ? colors.emerald[0] : colors.textMuted[0],
                       assignedCh ? colors.emerald[1] : colors.textMuted[1],
                       assignedCh ? colors.emerald[2] : colors.textMuted[2]);
      doc.text(chStr, colX + 2, currentY + 4);

      currentY += rowH;
    });

    currentY += 4;
  }

  // KEY PACKING & HARDWARE COUNTS CARDS
  if (includeEquipmentManifest) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...colors.textDark);
    doc.text('2. Equipment Manifest & Packing Totals', marginX, currentY);
    currentY += 3.5;

    // Calculate Counts
    const micsCount = project.placedGear.filter((g) => {
      const def = getGearById(g.gearId);
      return def?.category === 'microphone';
    }).length;

    const diCount = project.placedGear.filter((g) => {
      const def = getGearById(g.gearId);
      return def?.category === 'di_box';
    }).length;

    const standsCount = project.placedGear.filter((g) => {
      const def = getGearById(g.gearId);
      return def?.category === 'microphone' || def?.category === 'stand';
    }).length;

    const xlrCount = calculateXlrCablesCount(project.connections, project.mixerChannels || [], project.placedGear);
    const tsCount = project.connections.filter((c) => c.cableType === 'quarter_inch').length;
    const speakersCount = project.placedGear.filter((g) => {
      const def = getGearById(g.gearId);
      return def?.category === 'monitor_speaker' || g.gearId.includes('speaker') || g.gearId.includes('pa');
    }).length;

    const statBoxes = [
      { label: 'MICROPHONES', count: micsCount },
      { label: 'DIRECT BOXES', count: diCount },
      { label: 'MIC BOOM STANDS', count: standsCount },
      { label: 'XLR CABLES', count: Math.max(xlrCount, micsCount) },
      { label: '1/4" TS CABLES', count: Math.max(tsCount, diCount) },
      { label: 'MONITORS / PA', count: speakersCount },
    ];

    const boxGap = 2;
    const statBoxWidth = (contentWidth - boxGap * 5) / 6;
    const statBoxHeight = 18;

    statBoxes.forEach((stat, idx) => {
      const boxX = marginX + idx * (statBoxWidth + boxGap);
      doc.setFillColor(...colors.lightGray);
      doc.setDrawColor(...colors.borderGray);
      doc.setLineWidth(0.3);
      doc.roundedRect(boxX, currentY, statBoxWidth, statBoxHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...colors.darkNavy);
      doc.text(stat.count.toString(), boxX + statBoxWidth / 2, currentY + 7.5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(...colors.textMuted);
      const splitLabel = doc.splitTextToSize(stat.label, statBoxWidth - 2);
      doc.text(splitLabel, boxX + statBoxWidth / 2, currentY + 12.5, { align: 'center' });
    });

    currentY += statBoxHeight + 5;
  }

  // Bottom Summary Assessment Phrase Callout (Page 1)
  doc.setFillColor(isScoreA ? colors.emeraldBg[0] : isScoreB ? colors.amberBg[0] : colors.roseBg[0],
                   isScoreA ? colors.emeraldBg[1] : isScoreB ? colors.amberBg[1] : colors.roseBg[1],
                   isScoreA ? colors.emeraldBg[2] : isScoreB ? colors.amberBg[2] : colors.roseBg[2]);
  doc.setDrawColor(isScoreA ? colors.emerald[0] : isScoreB ? colors.amber[0] : colors.rose[0],
                   isScoreA ? colors.emerald[1] : isScoreB ? colors.amber[1] : colors.rose[1],
                   isScoreA ? colors.emerald[2] : isScoreB ? colors.amber[2] : colors.rose[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(isScoreA ? colors.emerald[0] : isScoreB ? colors.amber[0] : colors.rose[0],
                   isScoreA ? colors.emerald[1] : isScoreB ? colors.amber[1] : colors.rose[1],
                   isScoreA ? colors.emerald[2] : isScoreB ? colors.amber[2] : colors.rose[2]);
  doc.text(`Evaluation Summary: "${evaluation.gradePhrase}"`, marginX + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.textDark);
  const criticalCount = evaluation.criticalIssues.length;
  const positiveCount = evaluation.positives.length;
  const subText =
    criticalCount === 0
      ? `All critical engineering parameters satisfied with ${positiveCount} verified validations. Patch list & diagnostics on Page 2.`
      : `${criticalCount} item(s) need engineering attention. Review the detailed rubric and channel routing on Page 2.`;
  doc.text(subText, marginX + 4, currentY + 10.5);

  drawPageFooter(1, 2);

  // -------------------------------------------------------------
  // PAGE 2: Input / Mixer Patch List, Rubric Breakdown, Signatures
  // -------------------------------------------------------------
  doc.addPage();
  currentY = 14;
  drawPageHeader(2, 2);

  // Page 2 Header Banner
  doc.setFillColor(...colors.darkNavy);
  doc.roundedRect(marginX, currentY, contentWidth, 13, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AudioPlot Technical Specifications & Diagnostic Report', marginX + 5, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`Student: ${studentDisplay} • Project: ${displayTitle} • Date: ${dateDisplay}`, marginX + 5, currentY + 10.5);

  currentY += 17;

  // 3. INTERFACE & MIXER INPUT PATCH LIST TABLE
  if (includePatchList) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...colors.textDark);
    doc.text('3. Interface / Mixer Channel Patch List (8 Channels)', marginX, currentY);
    currentY += 3.5;

    // Table Header
    const colWidths = [16, 46, 32, 26, 38, 29.9]; // sum = 187.9 mm
    const headers = ['CH #', 'SOURCE / LABEL', 'EQUIPMENT / MODEL', '+48V POWER', 'STAND & MOUNTING', 'PAN & FADER'];

    doc.setFillColor(...colors.charcoal);
    doc.rect(marginX, currentY, contentWidth, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);

    let curColX = marginX;
    headers.forEach((h, i) => {
      doc.text(h, curColX + 2, currentY + 4.2);
      curColX += colWidths[i];
    });

    currentY += 6;

    // Render 8 Channels Rows
    project.mixerChannels.forEach((ch, idx) => {
      const rowHeight = 7;
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? colors.lightGray[0] : 255, isEven ? colors.lightGray[1] : 255, isEven ? colors.lightGray[2] : 255);
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');

      // Grid line
      doc.setDrawColor(...colors.borderGray);
      doc.setLineWidth(0.2);
      doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

      // Find assigned gear item
      const assignedGear = ch.assignedGearInstanceId
        ? project.placedGear.find((g) => g.instanceId === ch.assignedGearInstanceId)
        : project.placedGear.find((g) => g.assignedChannel === ch.channelNumber);
      const gearDef = assignedGear ? getGearById(assignedGear.gearId) : null;

      // Stand details
      let standText = '—';
      if (assignedGear) {
        if (assignedGear.standHeight) {
          const heightMap: Record<string, string> = {
            amp_low: 'Low Boom (Amp)',
            seated_instrument: 'Seated Boom',
            standing_vocal: 'Standing Boom',
            drum_overhead: 'Overhead Boom',
            clipped: 'Rim Clip',
            mounted: 'Mounted',
          };
          standText = heightMap[assignedGear.standHeight] || 'Standard Stand';
        }
        if (assignedGear.hasPopFilter) {
          standText += ' + Pop Filter';
        }
      }

      // Pan & Fader level
      const panStr = ch.pan === 0 ? 'C' : ch.pan < 0 ? `L${Math.abs(ch.pan)}%` : `R${ch.pan}%`;
      const faderDb = ch.fader >= 75 ? `+${Math.round(((ch.fader - 75) / 25) * 6)}dB` : `${Math.round(((ch.fader - 75) / 75) * 60)}dB`;
      const panFaderStr = `${panStr} • ${faderDb}`;

      let colX = marginX;

      // Col 0: Ch #
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.darkNavy);
      doc.text(`CH ${ch.channelNumber}`, colX + 2, currentY + 4.8);
      colX += colWidths[0];

      // Col 1: Label / Source
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const labelText = ch.label || 'Unassigned';
      doc.setTextColor(ch.label ? colors.darkNavy[0] : colors.textMuted[0],
                       ch.label ? colors.darkNavy[1] : colors.textMuted[1],
                       ch.label ? colors.darkNavy[2] : colors.textMuted[2]);
      doc.text(doc.splitTextToSize(labelText, colWidths[1] - 4)[0] || labelText, colX + 2, currentY + 4.8);
      colX += colWidths[1];

      // Col 2: Equipment Model
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...colors.textDark);
      const gearText = gearDef ? `${gearDef.name}${gearDef.model ? ` (${gearDef.model})` : ''}` : 'No Line Patched';
      doc.text(doc.splitTextToSize(gearText, colWidths[2] - 4)[0] || gearText, colX + 2, currentY + 4.8);
      colX += colWidths[2];

      // Col 3: +48V Power
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      if (ch.phantomPower) {
        doc.setTextColor(...colors.rose);
        doc.text('ENGAGED (+48V)', colX + 2, currentY + 4.8);
      } else {
        doc.setTextColor(...colors.textMuted);
        doc.text('Off (0V)', colX + 2, currentY + 4.8);
      }
      colX += colWidths[3];

      // Col 4: Stand & Mounting
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...colors.textDark);
      doc.text(doc.splitTextToSize(standText, colWidths[4] - 4)[0] || standText, colX + 2, currentY + 4.8);
      colX += colWidths[4];

      // Col 5: Pan & Fader
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...colors.textMuted);
      doc.text(panFaderStr, colX + 2, currentY + 4.8);

      currentY += rowHeight;
    });

    currentY += 6;
  }

  // 4. DIAGNOSTIC RUBRIC & GRADING EVALUATION BREAKDOWN
  if (includeGradingRubric) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...colors.textDark);
    doc.text('4. Diagnostic Rubric & Setup Grading Breakdown', marginX, currentY);
    currentY += 3.5;

    // Rubric Table Header
    const rubWidths = [42, 24, 20, 101.9]; // sum = 187.9 mm
    const rubHeaders = ['CRITERION', 'STATUS', 'SCORE', 'DIAGNOSTIC ASSESSMENT & FEEDBACK'];

    doc.setFillColor(...colors.charcoal);
    doc.rect(marginX, currentY, contentWidth, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);

    let curRubX = marginX;
    rubHeaders.forEach((h, i) => {
      doc.text(h, curRubX + 2, currentY + 4.2);
      curRubX += rubWidths[i];
    });

    currentY += 6;

    // Rubric Category Rows
    const categoriesList = Object.entries(evaluation.categories).filter(([_, c]) => !!c) as [
      string,
      { name: string; score: number; maxScore: number; status: 'perfect' | 'warning' | 'error' | 'not_applicable'; feedback: string }
    ][];

    categoriesList.forEach(([key, cat], idx) => {
      const isEven = idx % 2 === 0;
      const feedbackLines = doc.splitTextToSize(cat.feedback || 'Criteria assessed.', rubWidths[3] - 4);
      const rowHeight = Math.max(8, feedbackLines.length * 3.5 + 4);

      doc.setFillColor(isEven ? colors.lightGray[0] : 255, isEven ? colors.lightGray[1] : 255, isEven ? colors.lightGray[2] : 255);
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');

      // Grid line
      doc.setDrawColor(...colors.borderGray);
      doc.setLineWidth(0.2);
      doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

      let colX = marginX;

      // Criterion Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.darkNavy);
      doc.text(doc.splitTextToSize(cat.name, rubWidths[0] - 4)[0] || cat.name, colX + 2, currentY + 5);
      colX += rubWidths[0];

      // Status Badge
      const statusBadgeMap = {
        perfect: { label: 'PASS / PERFECT', color: colors.emerald, bg: colors.emeraldBg },
        warning: { label: 'WARNING', color: colors.amber, bg: colors.amberBg },
        error: { label: 'ATTENTION', color: colors.rose, bg: colors.roseBg },
        not_applicable: { label: 'N / A', color: colors.textMuted, bg: colors.lightGray },
      };
      const badge = statusBadgeMap[cat.status] || statusBadgeMap.perfect;

      doc.setFillColor(...badge.bg);
      doc.roundedRect(colX + 1.5, currentY + 1.8, rubWidths[1] - 3, 4.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(...badge.color);
      doc.text(badge.label, colX + rubWidths[1] / 2, currentY + 4.8, { align: 'center' });
      colX += rubWidths[1];

      // Score
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...colors.textDark);
      doc.text(`${cat.score} / ${cat.maxScore}`, colX + 2, currentY + 5);
      colX += rubWidths[2];

      // Feedback
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...colors.charcoal);
      doc.text(feedbackLines, colX + 2, currentY + 4.5);

      currentY += rowHeight;
    });

    currentY += 5;
  }

  // 5. INSTRUCTOR & STUDENT VERIFICATION SIGNATURE BLOCK
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...colors.textDark);
  doc.text('5. Verification & Engineering Certification', marginX, currentY);
  currentY += 3.5;

  const sigBoxWidth = (contentWidth - 6) / 2;
  const sigBoxHeight = 22;

  // Instructor Box
  doc.setFillColor(...colors.lightGray);
  doc.setDrawColor(...colors.borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, currentY, sigBoxWidth, sigBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...colors.textMuted);
  doc.text('INSTRUCTOR VERIFICATION & GRADE STAMP', marginX + 3, currentY + 4.5);

  doc.setDrawColor(...colors.textDark);
  doc.setLineWidth(0.4);
  doc.line(marginX + 4, currentY + 15, marginX + sigBoxWidth - 4, currentY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('Instructor Signature / Date', marginX + 4, currentY + 19);

  // Student Box
  const studentBoxX = marginX + sigBoxWidth + 6;
  doc.setFillColor(...colors.lightGray);
  doc.setDrawColor(...colors.borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(studentBoxX, currentY, sigBoxWidth, sigBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...colors.textMuted);
  doc.text('STUDENT AUDIO ENGINEER ATTESTATION', studentBoxX + 3, currentY + 4.5);

  doc.setDrawColor(...colors.textDark);
  doc.setLineWidth(0.4);
  doc.line(studentBoxX + 4, currentY + 15, studentBoxX + sigBoxWidth - 4, currentY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(`${studentDisplay} • Student Audio Engineer`, studentBoxX + 4, currentY + 19);

  drawPageFooter(2, 2);

  // Generate output filename
  const finalFilename =
    filename ||
    `AudioPlot-${project.studentName?.toLowerCase().replace(/\s+/g, '-') || 'assignment'}-${project.environment === 'recording_studio' ? 'studio' : 'stage'}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (options.download) {
    onProgress?.('Downloading PDF file...');
    doc.save(finalFilename);
  }

  const blob = doc.output('blob');
  return { doc, blob, filename: finalFilename };
}

export async function exportStudioPlotToPdf(
  project: StudioProjectState,
  evaluation: RubricEvaluation,
  options: PdfExportOptions = {}
): Promise<void> {
  await generateStudioPlotPdf(project, evaluation, {
    ...options,
    download: true,
  });
}
