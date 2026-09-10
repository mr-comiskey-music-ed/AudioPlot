import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  Download,
  Printer,
  X,
  FileCheck,
  FolderDown,
  FileText,
  Loader2,
  User,
} from 'lucide-react';
import { StudioProjectState, RubricEvaluation } from '../types';
import {
  generateShareUrl,
  exportProjectJson,
  printGradingReport,
  exportStudioPlotToPdf,
} from '../services/shareService';

interface ShareSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: StudioProjectState;
  evaluation: RubricEvaluation;
  studentName: string;
  onUpdateStudentName: (name: string) => void;
  onOpenGoogleDriveModal?: () => void;
}

export const ShareSubmitModal: React.FC<ShareSubmitModalProps> = ({
  isOpen,
  onClose,
  project,
  evaluation,
  studentName,
  onUpdateStudentName,
  onOpenGoogleDriveModal,
}) => {
  const [copied, setCopied] = useState(false);
  const [localName, setLocalName] = useState(studentName || '');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

  useEffect(() => {
    setLocalName(studentName || '');
  }, [studentName]);

  if (!isOpen) return null;

  // Update project studentName temporarily for sharing URL generation
  const updatedProject = { ...project, studentName: localName };
  const shareUrl = generateShareUrl(updatedProject);

  const handleNameChange = (val: string) => {
    setLocalName(val);
    onUpdateStudentName(val);
  };

  const handleCopyLink = async () => {
    if (!isNameValid) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Clipboard error:', err);
    }
  };

  const handleDownloadDrivePackage = () => {
    exportProjectJson(updatedProject);
  };

  const handleExportPdf = async () => {
    if (!isNameValid || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      setPdfStatus('Capturing stage plot...');
      await exportStudioPlotToPdf(updatedProject, evaluation, {
        onProgress: (status) => setPdfStatus(status),
      });
      setPdfStatus('Downloaded!');
      setTimeout(() => {
        setIsExportingPdf(false);
        setPdfStatus(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setIsExportingPdf(false);
      setPdfStatus('Export failed');
      setTimeout(() => setPdfStatus(null), 3000);
    }
  };

  const handlePrint = () => {
    printGradingReport(updatedProject, evaluation);
  };

  const isNameValid = localName.trim().length > 0;

  return (
    <div
      id="share-submit-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div
        id="share-submit-modal-card"
        className="bg-stone-950/90 backdrop-blur-2xl border border-white/20 rounded-3xl max-w-lg w-full p-6 text-stone-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-inner backdrop-blur-md">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-100">
                Share & Export Studio Setup
              </h3>
              <p className="text-xs text-stone-400">
                Generate Share Link & Export PDF Stage Plot
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white border border-white/10 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1">
          {/* AudioPlot Share Link & Required Name Entry */}
          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-orange-400" />
                AudioPlot Share Link
              </span>
            </div>
            <p className="text-[11px] text-stone-300">
              Enter your student name below to label your shared link and exported report.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-300 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-orange-400" />
                Student Name <span className="text-orange-400">*</span>
              </label>
              <input
                id="input-share-student-name"
                type="text"
                value={localName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter your full name (required)"
                className="w-full bg-white/10 border border-white/20 focus:border-orange-400 rounded-xl px-3 py-2 text-xs text-stone-100 outline-none backdrop-blur-xs transition-all placeholder:text-stone-500"
              />
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                id="input-share-link-url"
                type="text"
                readOnly
                value={isNameValid ? shareUrl : 'Please enter student name above to generate share link...'}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-400 font-mono select-all outline-none truncate backdrop-blur-xs"
              />
              <button
                id="btn-copy-share-link"
                onClick={handleCopyLink}
                disabled={!isNameValid}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-lg cursor-pointer ${
                  !isNameValid
                    ? 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-50'
                    : copied
                    ? 'bg-emerald-500 text-stone-950 font-black shadow-emerald-950/40'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-stone-950 font-black shadow-orange-950/40'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
            {!isNameValid && (
              <p className="text-[10px] text-amber-400 font-medium italic">
                * Student name entry is required before copying the link or exporting the PDF.
              </p>
            )}
          </div>

          {/* Primary Action: Export Stage Plot & Grading Report PDF */}
          <div className="p-4 bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-transparent border border-blue-500/30 rounded-2xl space-y-2 backdrop-blur-md relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-300 flex items-center gap-1.5 uppercase tracking-wide">
                <FileText className="w-4 h-4 text-blue-400" />
                Clean PDF Stage Plot & Grade Report
              </span>
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full">
                jsPDF Vector
              </span>
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed">
              Export a publication-ready, multi-page PDF document featuring high-resolution visual stage plot snapshot, complete equipment packing manifest, 8-channel mixer patch sheet, and full diagnostic rubric breakdown.
            </p>

            <button
              id="btn-export-stage-plot-pdf"
              onClick={handleExportPdf}
              disabled={isExportingPdf || !isNameValid}
              className={`w-full py-2.5 px-4 rounded-full text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-950/40 transition-all mt-2 cursor-pointer ${
                !isNameValid
                  ? 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-50'
                  : isExportingPdf
                  ? 'bg-blue-600 text-white cursor-wait opacity-90'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white shadow-blue-500/25'
              }`}
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{pdfStatus || 'Generating Clean PDF...'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Stage Plot & Report (PDF)</span>
                </>
              )}
            </button>
            {!isNameValid && (
              <p className="text-[10px] text-amber-400 font-medium italic mt-1">
                * Please enter your student name above to enable PDF export.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-stone-200 text-xs font-bold border border-white/10 backdrop-blur-md transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
