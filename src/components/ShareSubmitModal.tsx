import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';
import { StudioProjectState, RubricEvaluation } from '../types';
import {
  exportProjectJson,
  printGradingReport,
  exportStudioPlotToPdf,
  cC,
} from '../services/shareService';
import { copyText } from '../utils/copyText';

interface ShareSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: StudioProjectState;
  evaluation: RubricEvaluation;
  studentName: string;
  onUpdateStudentName: (name: string) => void;
  onVerifyProject?: (project: StudioProjectState) => void;
  onOpenBatchGrade?: () => void;
}

export const ShareSubmitModal: React.FC<ShareSubmitModalProps> = ({
  isOpen,
  onClose,
  project,
  evaluation,
  studentName,
  onUpdateStudentName,
  onVerifyProject,
  onOpenBatchGrade,
}) => {
  const [codeCopied, setCodeCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const codeAreaRef = useRef<HTMLTextAreaElement>(null);
  const [localName, setLocalName] = useState(studentName || '');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [teacherCodeInput, setTeacherCodeInput] = useState('');
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    setLocalName(studentName || '');
  }, [studentName]);

  if (!isOpen) return null;

  const isNameValid = localName.trim().length > 0;

  // Update project studentName temporarily for the student code and PDF export
  const updatedProject = { ...project, studentName: localName };
  const studentCode = isNameValid ? String(cC(updatedProject)) : '';

  const handleNameChange = (val: string) => {
    setLocalName(val);
    onUpdateStudentName(val);
  };

  const handleCopyCode = async () => {
    if (!isNameValid || !studentCode) return;
    const ok = await copyText(studentCode);
    if (ok) {
      setCopyFailed(false);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    } else {
      // Copy was blocked: select the code so the student can press Ctrl+C.
      codeAreaRef.current?.focus();
      codeAreaRef.current?.select();
      setCopyFailed(true);
    }
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

  const handleVerifyGrade = () => {
    setVerificationError(null);
    if (!teacherCodeInput.trim()) {
      setVerificationError('Please paste a student submission code.');
      return;
    }
    const result = cC(teacherCodeInput);
    if (!result || typeof result !== 'object' || !result.project) {
      setVerificationError('Invalid or tampered student code. Please check the code and try again.');
      return;
    }
    if (onVerifyProject) {
      onVerifyProject(result.project);
    }
    setTeacherCodeInput('');
    onClose();
  };

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
                Copy Your Code & Export PDF Stage Plot
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
          {/* Student Name Entry Section */}
          {evaluation.isSandbox && (
            <div className="p-3 rounded-2xl border border-dashed border-amber-400/50 bg-amber-500/10 text-[11px] text-amber-100/90 leading-relaxed">
              <strong className="text-amber-300">Heads up: you are in the Sandbox.</strong> This code will show as
              &ldquo;not graded&rdquo;. If your teacher gave you a task, open it from the Tasks button first.
            </div>
          )}

          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl space-y-2.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-orange-400" />
                Student Name <span className="text-orange-400">*</span>
              </span>
            </div>
            <p className="text-[11px] text-stone-300">
              Enter your full name to label your student assignment code and exported report.
            </p>
            <input
              id="input-share-student-name"
              type="text"
              value={localName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter your full name (required)"
              className="w-full bg-stone-900/90 border border-white/20 focus:border-orange-400 rounded-xl px-3 py-2 text-xs text-stone-100 outline-none backdrop-blur-xs transition-all placeholder:text-stone-500"
            />
            {!isNameValid && (
              <p className="text-[10px] text-amber-400 font-medium italic">
                * Student name entry is required before copying the code or exporting the PDF.
              </p>
            )}
          </div>

          {/* Student Assignment Code Section (Google Apps Script / Classroom Compatible) */}
          <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-2xl space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-teal-400" />
                Student Assignment Code
              </span>
            </div>
            <p className="text-[11px] text-stone-300">
              Copy this code and paste it into your Google Classroom assignment or send it to your teacher.
            </p>

            <div className="space-y-2">
              <textarea
                ref={codeAreaRef}
                id="textarea-student-code"
                readOnly
                rows={3}
                value={isNameValid ? studentCode : 'Please enter student name above to generate code string...'}
                className="w-full bg-stone-900/90 border border-white/20 rounded-xl p-2.5 text-[11px] text-teal-300 font-mono select-all outline-none resize-none backdrop-blur-xs"
                placeholder="Student code string..."
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-400">
                  {!isNameValid
                    ? 'Name required'
                    : copyFailed
                    ? 'Copy was blocked here. The code is selected: press Ctrl+C to copy it.'
                    : 'Copy the whole code, start to finish.'}
                </span>
                <button
                  id="btn-copy-student-code"
                  onClick={handleCopyCode}
                  disabled={!isNameValid}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-lg cursor-pointer ${
                    !isNameValid
                      ? 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-50'
                      : codeCopied
                      ? 'bg-emerald-500 text-stone-950 font-black shadow-emerald-950/40'
                      : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-stone-950 font-black shadow-teal-950/40'
                  }`}
                >
                  {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{codeCopied ? 'Code Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
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

          {/* Teacher Code Check Section (Orange Theme) */}
          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-orange-400" />
                Teacher Code Check
              </span>
            </div>
            <p className="text-[11px] text-stone-300">
              Paste student code below to instantly verify their assignment grade and inspect their stage plot.
            </p>

            <div className="space-y-2">
              <textarea
                id="textarea-teacher-code-input"
                rows={2}
                value={teacherCodeInput}
                onChange={(e) => {
                  setTeacherCodeInput(e.target.value);
                  if (verificationError) setVerificationError(null);
                }}
                placeholder="Paste Student Code..."
                className="w-full bg-stone-900/90 border border-white/25 focus:border-orange-400 rounded-xl p-2.5 text-[11px] text-orange-300 font-mono outline-none resize-none backdrop-blur-xs placeholder:text-stone-500"
              />
              {verificationError && (
                <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{verificationError}</span>
                </p>
              )}
              <button
                id="btn-verify-student-grade"
                onClick={handleVerifyGrade}
                className="w-full py-2.5 px-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-stone-950 font-black text-xs shadow-lg shadow-orange-950/40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify Grade</span>
              </button>
              {onOpenBatchGrade && (
                <button
                  id="btn-open-batch-grade"
                  onClick={() => {
                    onOpenBatchGrade();
                    onClose();
                  }}
                  className="w-full py-2 px-4 rounded-full bg-white/5 hover:bg-white/10 border border-orange-500/40 text-orange-300 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ListChecks className="w-4 h-4" />
                  <span>Batch Grade a Whole Class</span>
                </button>
              )}
            </div>
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
