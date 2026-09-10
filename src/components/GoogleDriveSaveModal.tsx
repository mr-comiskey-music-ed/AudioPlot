import React, { useState, useEffect } from 'react';
import {
  X,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  HardDrive,
  Check,
  RefreshCw,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { StudioProjectState, RubricEvaluation } from '../types';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  getCurrentUser,
  subscribeAuth,
} from '../services/googleAuth';
import {
  pickGoogleDriveFolder,
  uploadFileToGoogleDrive,
  SelectedDriveFolder,
  DriveUploadResult,
} from '../services/googleDrivePickerService';
import { generateStudioPlotPdf } from '../services/pdfExportService';
import { User } from 'firebase/auth';

interface GoogleDriveSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: StudioProjectState;
  evaluation: RubricEvaluation;
}

type SaveOption = 'pdf' | 'json' | 'both';

export const GoogleDriveSaveModal: React.FC<GoogleDriveSaveModalProps> = ({
  isOpen,
  onClose,
  project,
  evaluation,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [saveOption, setSaveOption] = useState<SaveOption>('both');
  const [selectedFolder, setSelectedFolder] = useState<SelectedDriveFolder>({
    id: 'root',
    name: 'My Drive (Root)',
  });
  const [isPickingFolder, setIsPickingFolder] = useState(false);

  // Upload workflow state
  const [isConfirming, setIsConfirming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<DriveUploadResult[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Auth sync
  useEffect(() => {
    const unsubscribe = subscribeAuth((user, token) => {
      setCurrentUser(user);
      setAccessToken(token);
    });

    initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        // Not authenticated
      }
    );

    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setAuthError(err?.message || 'Google authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setCurrentUser(null);
      setAccessToken(null);
      setUploadResults([]);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleOpenFolderPicker = async () => {
    let token = accessToken;
    if (!token) {
      try {
        setIsAuthenticating(true);
        const authRes = await googleSignIn();
        if (!authRes?.accessToken) return;
        token = authRes.accessToken;
      } catch (err: any) {
        setAuthError(err?.message || 'Authentication needed to browse Google Drive.');
        return;
      } finally {
        setIsAuthenticating(false);
      }
    }

    try {
      setIsPickingFolder(true);
      const picked = await pickGoogleDriveFolder(token);
      if (picked) {
        setSelectedFolder(picked);
      }
    } catch (err: any) {
      console.error('Folder picker error:', err);
      setAuthError(err?.message || 'Unable to open Google Drive folder picker.');
    } finally {
      setIsPickingFolder(false);
    }
  };

  const getCleanBaseFilename = () => {
    const student = project.studentName?.trim().toLowerCase().replace(/\s+/g, '-') || 'assignment';
    const env = project.environment === 'recording_studio' ? 'studio' : 'stage';
    const dateStr = new Date().toISOString().slice(0, 10);
    return `AudioPlot-${student}-${env}-${dateStr}`;
  };

  const pdfFilename = `${getCleanBaseFilename()}-Report.pdf`;
  const jsonFilename = `${getCleanBaseFilename()}-plot.json`;

  const handleStartSave = () => {
    if (!accessToken) {
      handleSignIn();
      return;
    }
    // Show mandatory confirmation prompt before mutating/saving to Drive
    setIsConfirming(true);
    setUploadError(null);
  };

  const handleExecuteUpload = async () => {
    setIsConfirming(false);
    setIsUploading(true);
    setUploadError(null);
    setUploadResults([]);

    const uploaded: DriveUploadResult[] = [];
    const token = accessToken || (await getAccessToken());

    if (!token) {
      setIsUploading(false);
      setUploadError('Access token is missing. Please sign in again.');
      return;
    }

    try {
      // 1. Upload PDF if selected
      if (saveOption === 'pdf' || saveOption === 'both') {
        setUploadProgressText('Generating visual stage plot & PDF document...');
        const { blob, filename } = await generateStudioPlotPdf(project, evaluation, {
          filename: pdfFilename,
          download: false,
          onProgress: (status) => setUploadProgressText(status),
        });

        setUploadProgressText(`Uploading "${filename}" to Google Drive...`);
        const pdfResult = await uploadFileToGoogleDrive({
          accessToken: token,
          filename,
          mimeType: 'application/pdf',
          dataBlob: blob,
          folderId: selectedFolder.id,
          folderName: selectedFolder.name,
        });
        uploaded.push(pdfResult);
      }

      // 2. Upload JSON if selected
      if (saveOption === 'json' || saveOption === 'both') {
        setUploadProgressText('Serializing studio plot state JSON...');
        const projectPayload = {
          ...project,
          exportedAt: new Date().toISOString(),
          evaluationSummary: {
            percentage: evaluation.percentage,
            gradeLetter: evaluation.gradeLetter,
            score: evaluation.score,
            totalPossible: evaluation.totalPossible,
          },
        };
        const jsonBlob = new Blob([JSON.stringify(projectPayload, null, 2)], {
          type: 'application/json',
        });

        setUploadProgressText(`Uploading "${jsonFilename}" to Google Drive...`);
        const jsonResult = await uploadFileToGoogleDrive({
          accessToken: token,
          filename: jsonFilename,
          mimeType: 'application/json',
          dataBlob: jsonBlob,
          folderId: selectedFolder.id,
          folderName: selectedFolder.name,
        });
        uploaded.push(jsonResult);
      }

      setUploadResults(uploaded);
      setUploadProgressText(null);
    } catch (err: any) {
      console.error('Upload to Google Drive failed:', err);
      setUploadError(err?.message || 'Failed to upload files to Google Drive. Please verify permissions.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      id="google-drive-save-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div
        id="google-drive-save-modal-card"
        className="bg-stone-950/90 backdrop-blur-2xl border border-white/15 rounded-3xl max-w-xl w-full p-6 text-stone-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            {/* Google Drive Logo Badge */}
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-inner backdrop-blur-md">
              <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-stone-100">
                  Save to Google Drive
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Picker API
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Save your stage plot PDF reports & project state files to a specific Drive folder
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

        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Account & Auth Status Section */}
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between backdrop-blur-md">
            {currentUser && accessToken ? (
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-9 h-9 rounded-full border border-white/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    {currentUser.displayName?.[0] || currentUser.email?.[0] || 'U'}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                    <span>{currentUser.displayName || 'Google Account'}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      Connected
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-400">{currentUser.email}</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-bold text-stone-200">Google Account Connection</div>
                <div className="text-[11px] text-stone-400">
                  Sign in to browse folders and save exports directly to Google Drive
                </div>
              </div>
            )}

            <div>
              {currentUser && accessToken ? (
                <button
                  onClick={handleSignOut}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-400 hover:text-rose-300 border border-white/10 text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Sign out of Google Drive"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              ) : (
                /* Official Sign In with Google Button */
                <button
                  id="btn-google-drive-signin"
                  onClick={handleSignIn}
                  disabled={isAuthenticating}
                  className="px-4 py-2 rounded-full bg-white hover:bg-stone-100 text-stone-900 font-bold text-xs flex items-center gap-2 shadow-md shadow-white/10 transition-all cursor-pointer"
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-900" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Authentication Note:</span> {authError}
              </div>
            </div>
          )}

          {/* Section 1: Choose Files to Save */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3 backdrop-blur-md">
            <div className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center justify-between">
              <span>1. Choose Files to Export & Save</span>
              <span className="text-[10px] text-stone-400 font-normal">Select payload</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Option: Both PDF + JSON */}
              <button
                type="button"
                onClick={() => setSaveOption('both')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  saveOption === 'both'
                    ? 'bg-orange-500/20 border-orange-400 text-stone-100 ring-1 ring-orange-400 shadow-md shadow-orange-950/50'
                    : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Sparkles className={`w-4 h-4 ${saveOption === 'both' ? 'text-orange-400' : 'text-stone-400'}`} />
                  {saveOption === 'both' && <Check className="w-3.5 h-3.5 text-orange-400" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-100">Both PDF & JSON</div>
                  <div className="text-[10px] text-stone-400">Complete bundle</div>
                </div>
              </button>

              {/* Option: PDF Only */}
              <button
                type="button"
                onClick={() => setSaveOption('pdf')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  saveOption === 'pdf'
                    ? 'bg-orange-500/20 border-orange-400 text-stone-100 ring-1 ring-orange-400 shadow-md shadow-orange-950/50'
                    : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <FileText className={`w-4 h-4 ${saveOption === 'pdf' ? 'text-orange-400' : 'text-stone-400'}`} />
                  {saveOption === 'pdf' && <Check className="w-3.5 h-3.5 text-orange-400" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-100">PDF Report Only</div>
                  <div className="text-[10px] text-stone-400">Stage plot & rubric</div>
                </div>
              </button>

              {/* Option: JSON Only */}
              <button
                type="button"
                onClick={() => setSaveOption('json')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  saveOption === 'json'
                    ? 'bg-orange-500/20 border-orange-400 text-stone-100 ring-1 ring-orange-400 shadow-md shadow-orange-950/50'
                    : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <FileCode className={`w-4 h-4 ${saveOption === 'json' ? 'text-blue-400' : 'text-stone-400'}`} />
                  {saveOption === 'json' && <Check className="w-3.5 h-3.5 text-orange-400" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-100">JSON State Only</div>
                  <div className="text-[10px] text-stone-400">AudioPlot session</div>
                </div>
              </button>
            </div>

            {/* Target File Preview */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 text-[11px] font-mono text-stone-300 space-y-1">
              {(saveOption === 'pdf' || saveOption === 'both') && (
                <div className="flex items-center gap-2 text-orange-300">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{pdfFilename}</span>
                </div>
              )}
              {(saveOption === 'json' || saveOption === 'both') && (
                <div className="flex items-center gap-2 text-blue-300">
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{jsonFilename}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Destination Folder Selection (Google Drive Picker) */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3 backdrop-blur-md">
            <div className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center justify-between">
              <span>2. Destination Google Drive Folder</span>
              <span className="text-[10px] text-stone-400 font-normal">Google Picker</span>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-black/40 border border-white/10 rounded-xl">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Folder className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-100 truncate">
                    {selectedFolder.name}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono truncate">
                    ID: {selectedFolder.id}
                  </div>
                </div>
              </div>

              <button
                id="btn-open-drive-picker"
                type="button"
                onClick={handleOpenFolderPicker}
                disabled={isPickingFolder}
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-stone-200 hover:text-white border border-white/15 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                title="Browse and select a folder in your Google Drive using Google Picker"
              >
                {isPickingFolder ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Browse Drive...</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* User Confirmation Dialog Step (SKILL.md mandated confirmation dialog) */}
          {isConfirming && (
            <div className="p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl space-y-3 backdrop-blur-md animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-black">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Confirm Upload to Google Drive</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                You are about to save{' '}
                <span className="font-bold text-amber-300">
                  {saveOption === 'both' ? '2 files (PDF Report + JSON State)' : saveOption === 'pdf' ? '1 file (PDF Report)' : '1 file (JSON State)'}
                </span>{' '}
                directly into your Google Drive folder{' '}
                <span className="font-bold text-stone-100">"{selectedFolder.name}"</span>.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-drive-upload"
                  type="button"
                  onClick={handleExecuteUpload}
                  className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-black text-xs shadow-md shadow-amber-950/50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm & Save</span>
                </button>
              </div>
            </div>
          )}

          {/* Live Upload Progress Indicator */}
          {isUploading && (
            <div className="p-4 bg-blue-500/15 border border-blue-500/30 rounded-2xl flex items-center gap-3 backdrop-blur-md">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
              <div>
                <div className="text-xs font-bold text-blue-300">Uploading to Google Drive</div>
                <div className="text-[11px] text-stone-300">{uploadProgressText || 'Processing...'}</div>
              </div>
            </div>
          )}

          {/* Success Results Banner */}
          {uploadResults.length > 0 && !isUploading && (
            <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl space-y-3 backdrop-blur-md animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-extrabold">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                <span>Successfully Saved to Google Drive!</span>
              </div>
              <div className="text-[11px] text-stone-300">
                Saved {uploadResults.length} file(s) to{' '}
                <span className="font-bold text-emerald-300">{selectedFolder.name}</span>.
              </div>

              <div className="space-y-1.5 pt-1">
                {uploadResults.map((res) => (
                  <div
                    key={res.id}
                    className="p-2.5 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {res.mimeType === 'application/pdf' ? (
                        <FileText className="w-4 h-4 text-orange-400 shrink-0" />
                      ) : (
                        <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-stone-200 truncate">{res.name}</span>
                    </div>

                    <a
                      href={res.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 transition-all flex items-center gap-1 shrink-0"
                      title="Open file in Google Drive"
                    >
                      <span>Open in Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Upload Error:</span> {uploadError}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
          <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>Files save directly into your Google Drive account</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-stone-200 text-xs font-bold border border-white/10 backdrop-blur-md transition-all cursor-pointer"
            >
              {uploadResults.length > 0 ? 'Close' : 'Cancel'}
            </button>

            {!isConfirming && !isUploading && uploadResults.length === 0 && (
              <button
                id="btn-start-drive-save"
                onClick={handleStartSave}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-black text-xs shadow-lg shadow-amber-950/40 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <HardDrive className="w-4 h-4" />
                <span>Save to Google Drive</span>
              </button>
            )}

            {uploadResults.length > 0 && !isUploading && (
              <button
                onClick={() => {
                  setUploadResults([]);
                  setUploadError(null);
                }}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-stone-200 text-xs font-bold border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Save Again</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
