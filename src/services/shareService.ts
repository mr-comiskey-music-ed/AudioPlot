import LZString from 'lz-string';
import { StudioProjectState, RubricEvaluation } from '../types';
import { getGearById } from '../data/gearCatalog';
import { exportStudioPlotToPdf, PdfExportOptions } from './pdfExportService';
import { calculateXlrCablesCount } from '../utils/cableUtils';

export { exportStudioPlotToPdf };
export type { PdfExportOptions };

export function serializeStudioProject(project: StudioProjectState): string {
  try {
    const json = JSON.stringify(project);
    return LZString.compressToEncodedURIComponent(json);
  } catch (err) {
    console.error('Error serializing studio project:', err);
    return '';
  }
}

export function deserializeStudioProject(encoded: string): StudioProjectState | null {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
    if (!decompressed) return null;
    return JSON.parse(decompressed);
  } catch (err) {
    console.error('Error deserializing studio project:', err);
    return null;
  }
}

export function generateShareUrl(project: StudioProjectState): string {
  const hash = serializeStudioProject(project);
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#plot=${hash}`;
}

export function generateGoogleClassroomShareUrl(project: StudioProjectState): string {
  const shareUrl = generateShareUrl(project);
  const title = encodeURIComponent(`Studio Setup Plot Submission: ${project.title} - ${project.studentName}`);
  return `https://classroom.google.com/share?url=${encodeURIComponent(shareUrl)}&title=${title}`;
}

export function exportProjectJson(project: StudioProjectState) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
  const downloadAnchor = document.createElement('a');
  const filename = `studio-plot-${project.studentName.toLowerCase().replace(/\s+/g, '-') || 'assignment'}-${new Date().toISOString().slice(0, 10)}.json`;
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function printGradingReport(project: StudioProjectState, evaluation: RubricEvaluation) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Derive Equipment & Packing Manifest
  const mics = project.placedGear
    .filter((item) => {
      const def = getGearById(item.gearId);
      return def?.category === 'microphone';
    })
    .map((item) => {
      const def = getGearById(item.gearId);
      const ch = project.mixerChannels.find(
        (c) => c.assignedGearInstanceId === item.instanceId || c.channelNumber === item.assignedChannel
      );
      const latchedSource = item.latchedSourceInstanceId
        ? project.placedGear.find((g) => g.instanceId === item.latchedSourceInstanceId)
        : null;
      const latchedDef = latchedSource ? getGearById(latchedSource.gearId) : null;

      return {
        name: def?.name || 'Microphone',
        model: def?.model || '',
        transducer: def?.transducerType || 'dynamic',
        polarPattern: def?.polarPattern || 'Cardioid',
        requiresPhantom: def?.requiresPhantomPower || false,
        standHeight: item.standHeight
          ? item.standHeight === 'amp_low'
            ? 'Floor / Amp Low'
            : item.standHeight === 'seated_instrument'
            ? 'Seated Boom'
            : item.standHeight === 'standing_vocal'
            ? 'Standing Vocal'
            : 'Drum Overhead Boom'
          : 'Standard Boom Stand',
        popFilter: item.hasPopFilter,
        assignedChannel: ch ? `Ch ${ch.channelNumber} (${ch.label})` : 'Unpatched',
        sourceName: latchedDef?.name || 'Assigned Source',
      };
    });

  const diBoxes = project.placedGear
    .filter((item) => {
      const def = getGearById(item.gearId);
      return def?.category === 'di_box';
    })
    .map((item) => {
      const def = getGearById(item.gearId);
      const ch = project.mixerChannels.find(
        (c) => c.assignedGearInstanceId === item.instanceId || c.channelNumber === item.assignedChannel
      );
      const latchedSource = item.latchedSourceInstanceId
        ? project.placedGear.find((g) => g.instanceId === item.latchedSourceInstanceId)
        : null;
      const latchedDef = latchedSource ? getGearById(latchedSource.gearId) : null;
      return {
        name: def?.name || 'Direct Box',
        model: def?.model || '',
        requiresPhantom: def?.requiresPhantomPower || false,
        assignedChannel: ch ? `Ch ${ch.channelNumber} (${ch.label})` : 'Unpatched',
        sourceName: latchedDef?.name || 'Direct In',
      };
    });

  const instruments = project.placedGear
    .filter((item) => {
      const def = getGearById(item.gearId);
      return def?.category === 'instrument' || def?.category === 'amplifier';
    })
    .map((item) => {
      const def = getGearById(item.gearId);
      return {
        name: def?.name || 'Instrument',
        model: def?.model || '',
        category: def?.category === 'amplifier' ? 'Amplifier' : 'Musical Instrument',
        specs: def?.specs || '',
      };
    });

  // Calculate Cable & Hardware Counts
  const xlrCablesCount = calculateXlrCablesCount(project.connections, project.mixerChannels || [], project.placedGear);
  const tsCablesCount = project.connections.filter((c) => c.cableType === 'quarter_inch').length;
  const popFiltersCount = project.placedGear.filter((g) => g.hasPopFilter).length;
  const standsCount = project.placedGear.filter((g) => {
    const def = getGearById(g.gearId);
    return def?.category === 'microphone' || def?.category === 'stand';
  }).length;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Audio Engineering Plot & Packing List - ${project.studentName || 'Student'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      padding: 36px;
      max-width: 880px;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
    }
    .grade-badge {
      background: #0f172a;
      color: #fff;
      padding: 10px 20px;
      border-radius: 8px;
      text-align: center;
    }
    .grade-score {
      font-size: 26px;
      font-weight: 900;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      background: #f8fafc;
      padding: 14px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #e2e8f0;
    }
    .meta-item strong {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
    }
    .meta-item span {
      font-size: 14px;
      font-weight: 600;
    }
    h3 {
      font-size: 15px;
      font-weight: 700;
      margin-top: 22px;
      margin-bottom: 10px;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 7px 10px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #334155;
    }
    .status-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
    }
    .status-perfect { background: #dcfce7; color: #166534; }
    .status-warning { background: #fef9c3; color: #854d0e; }
    .status-error { background: #fee2e2; color: #991b1b; }
    .status-not_applicable { background: #f1f5f9; color: #64748b; }
    .packing-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 18px;
    }
    .packing-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
    }
    .packing-qty {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
    }
    .packing-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
    }
    .signature-box {
      width: 45%;
    }
    .signature-line {
      border-bottom: 1px solid #0f172a;
      margin-top: 32px;
      margin-bottom: 4px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">AudioPlot: Setup Plot & Packing Manifest</div>
      <div class="subtitle">Audio Engineering Assignment & Stage Technical Spec (${project.environment === 'recording_studio' ? 'Studio Session' : 'Live Stage'})</div>
    </div>
    <div class="grade-badge">
      <div class="grade-score">${evaluation.percentage}%</div>
      <div>&ldquo;${evaluation.gradePhrase}&rdquo;</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <strong>Student Name</strong>
      <span>${project.studentName || 'Anonymous Student'}</span>
    </div>
    <div class="meta-item">
      <strong>Project Title</strong>
      <span>${project.title || 'Studio Recording Plot'}</span>
    </div>
    <div class="meta-item">
      <strong>Environment Mode</strong>
      <span>${project.environment === 'recording_studio' ? 'Recording Studio Suite' : 'Live Music Stage'}</span>
    </div>
    <div class="meta-item">
      <strong>Date Generated</strong>
      <span>${new Date().toLocaleDateString()}</span>
    </div>
    <div class="meta-item">
      <strong>Class / Period</strong>
      <span>${project.className || 'Audio Engineering I'}</span>
    </div>
    <div class="meta-item">
      <strong>Gear Count</strong>
      <span>${project.placedGear.length} Items Placed (${project.connections.length} Lines Patched)</span>
    </div>
  </div>

  <h3>Full Equipment & Packing Manifest</h3>
  
  <div class="packing-grid">
    <div class="packing-card">
      <div class="packing-qty">${mics.length}</div>
      <div class="packing-label">Microphones</div>
    </div>
    <div class="packing-card">
      <div class="packing-qty">${standsCount}</div>
      <div class="packing-label">Mic Stands</div>
    </div>
    <div class="packing-card">
      <div class="packing-qty">${Math.max(xlrCablesCount, mics.length)}</div>
      <div class="packing-label">XLR Mic Cables</div>
    </div>
    <div class="packing-card">
      <div class="packing-qty">${Math.max(tsCablesCount, diBoxes.length)}</div>
      <div class="packing-label">1/4" TS Cables</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 28%;">Item / Model</th>
        <th style="width: 14%;">Type / Spec</th>
        <th style="width: 12%;">Polar Pattern</th>
        <th style="width: 12%;">+48V Power</th>
        <th style="width: 18%;">Stand / Mounting</th>
        <th style="width: 16%;">Snake Patch</th>
      </tr>
    </thead>
    <tbody>
      ${
        mics.length > 0
          ? mics
              .map(
                (m) => `
        <tr>
          <td><strong>${m.name}</strong> ${m.model ? `<span style="color:#64748b; font-size:11px;">(${m.model})</span>` : ''}</td>
          <td style="text-transform: capitalize;">${m.transducer}</td>
          <td>${m.polarPattern}</td>
          <td>${m.requiresPhantom ? '<strong style="color:#b91c1c;">+48V Required</strong>' : 'No'}</td>
          <td>${m.standHeight} ${m.popFilter ? '<br><span style="color:#047857; font-size:10px; font-weight:700;">+ Pop Filter</span>' : ''}</td>
          <td><strong>${m.assignedChannel}</strong></td>
        </tr>
      `
              )
              .join('')
          : '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No microphones placed on floor.</td></tr>'
      }
      ${
        diBoxes.length > 0
          ? diBoxes
              .map(
                (d) => `
        <tr>
          <td><strong>${d.name}</strong> ${d.model ? `<span style="color:#64748b; font-size:11px;">(${d.model})</span>` : ''}</td>
          <td>Direct Box</td>
          <td>Direct In</td>
          <td>${d.requiresPhantom ? '<strong style="color:#b91c1c;">+48V Required</strong>' : 'Passive'}</td>
          <td>Floor / Stage Placement</td>
          <td><strong>${d.assignedChannel}</strong></td>
        </tr>
      `
              )
              .join('')
          : ''
      }
      ${
        instruments.length > 0
          ? instruments
              .map(
                (inst) => `
        <tr>
          <td><strong>${inst.name}</strong> ${inst.model ? `<span style="color:#64748b; font-size:11px;">(${inst.model})</span>` : ''}</td>
          <td>${inst.category}</td>
          <td>—</td>
          <td>—</td>
          <td>Stage Position</td>
          <td style="color:#64748b;">Sound Source</td>
        </tr>
      `
              )
              .join('')
          : ''
      }
    </tbody>
  </table>

  <h3>Interface / Mixer Patch Sheet</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Channel</th>
        <th style="width: 35%;">Input Source / Label</th>
        <th style="width: 20%;">+48V Phantom</th>
        <th style="width: 15%;">Pan Position</th>
        <th style="width: 15%;">Fader Level</th>
      </tr>
    </thead>
    <tbody>
      ${project.mixerChannels
        .map(
          (ch) => `
        <tr>
          <td><strong>Channel ${ch.channelNumber}</strong></td>
          <td>${ch.label || '<span style="color:#94a3b8">Unpatched</span>'}</td>
          <td>${ch.phantomPower ? '<strong style="color:#dc2626;">ACTIVE (+48V)</strong>' : 'OFF'}</td>
          <td>${ch.pan === 0 ? 'Center (C)' : ch.pan < 0 ? `L ${Math.abs(ch.pan)}%` : `R ${ch.pan}%`}</td>
          <td>${ch.fader > 70 ? `${Math.round(((ch.fader - 75) / 25) * 6)} dB` : `${Math.round(((ch.fader - 75) / 75) * 60)} dB`}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <h3>Rubric Grading Breakdown</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Criteria</th>
        <th style="width: 15%;">Score</th>
        <th style="width: 15%;">Status</th>
        <th style="width: 45%;">Feedback & Assessment</th>
      </tr>
    </thead>
    <tbody>
      ${Object.values(evaluation.categories)
        .map(
          (cat) => `
        <tr>
          <td><strong>${cat.name}</strong></td>
          <td>${cat.score} / ${cat.maxScore}</td>
          <td>
            <span class="status-tag status-${cat.status}">${cat.status.toUpperCase()}</span>
          </td>
          <td>${cat.feedback}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="signatures">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div style="font-size:11px; color:#64748b;">Instructor Signature & Verification</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div style="font-size:11px; color:#64748b;">Student Audio Engineer Signature</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
`;

  printWindow.document.write(html);
  printWindow.document.close();
}

