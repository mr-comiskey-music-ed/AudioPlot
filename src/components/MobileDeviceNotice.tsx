import React, { useState, useEffect } from 'react';
import { Laptop, Tablet, Smartphone, X, Check } from 'lucide-react';

export const MobileDeviceNotice: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const isMobileScreen = window.innerWidth < 768;
    const isTouchMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) && window.innerWidth < 768;
    const dismissed = sessionStorage.getItem('studiomaster_mobile_notice_dismissed');

    if ((isMobileScreen || isTouchMobile) && !dismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    sessionStorage.setItem('studiomaster_mobile_notice_dismissed', 'true');
  };

  if (!isOpen) return null;

  return (
    <div
      id="mobile-device-warning-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-stone-900 border-2 border-orange-500/80 rounded-3xl max-w-md w-full p-6 shadow-2xl text-stone-100 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-100 p-1.5 rounded-full hover:bg-white/10 transition-colors"
          title="Dismiss Notice"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/40 mb-4 mx-auto shadow-lg shadow-orange-950/50">
          <Laptop className="w-7 h-7" />
        </div>

        <h2 className="text-lg font-black text-center text-stone-100 mb-2">
          Desktop or Chromebook Recommended
        </h2>

        <p className="text-xs text-stone-300 text-center leading-relaxed mb-5">
          This audio engineering workspace is optimized for <strong>desktop screens, student Chromebooks, and tablets</strong> with a keyboard and mouse/trackpad.
        </p>

        <div className="bg-black/50 border border-white/10 rounded-2xl p-3.5 mb-5 flex flex-col gap-2 text-xs text-stone-300">
          <div className="flex items-center gap-2.5 text-emerald-400 font-semibold">
            <Laptop className="w-4 h-4 shrink-0" />
            <span>Best experience: Chromebook or Laptop / Desktop</span>
          </div>
          <div className="flex items-center gap-2.5 text-sky-400 font-semibold">
            <Tablet className="w-4 h-4 shrink-0" />
            <span>Great: Tablet in landscape mode</span>
          </div>
          <div className="flex items-center gap-2.5 text-amber-400 font-semibold">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>Mobile phone screens may be too tight for drag-and-drop patching</span>
          </div>
        </div>

        <button
          id="btn-dismiss-mobile-notice"
          onClick={handleDismiss}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 font-black text-sm transition-all shadow-lg shadow-orange-950/60 flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>I Understand — Continue to App</span>
        </button>
      </div>
    </div>
  );
};
