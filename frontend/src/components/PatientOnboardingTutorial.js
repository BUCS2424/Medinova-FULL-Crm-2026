import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
  User,
  Phone,
  Shield,
  Heart,
  FileText,
  Stethoscope,
  Package,
  ShoppingCart,
  ClipboardList,
  CreditCard,
  FolderOpen,
  ArrowRight,
  X,
  Sparkles
} from 'lucide-react';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Your Patient Portal! 🎉',
    description: 'Let\'s take a quick tour to help you get started. This will only take a minute.',
    target: null,
    position: 'center',
    icon: Sparkles
  },
  {
    id: 'contact',
    title: 'Contact Information',
    description: 'Start by filling out your contact information. This helps us reach you about your orders and appointments.',
    target: '[data-tutorial="contact-section"]',
    position: 'right',
    icon: Phone,
    tabTarget: null // sidebar section
  },
  {
    id: 'demographics',
    title: 'Demographics',
    description: 'This is where your contact information and personal details will be displayed. Keep this up to date!',
    target: '[data-tutorial="tab-demographics"]',
    position: 'bottom',
    icon: User,
    tabTarget: 'demographics'
  },
  {
    id: 'insurance',
    title: 'Insurance Information',
    description: 'Add your insurance details here. This is important for processing your medical equipment orders.',
    target: '[data-tutorial="tab-insurance"]',
    position: 'bottom',
    icon: Shield,
    tabTarget: 'insurance'
  },
  {
    id: 'medical',
    title: 'Medical Records',
    description: 'View and manage your medical records and health information in this section.',
    target: '[data-tutorial="tab-medical"]',
    position: 'bottom',
    icon: Heart,
    tabTarget: 'medical'
  },
  {
    id: 'documents',
    title: 'Documents',
    description: 'This is where you can add or find any important documents that will be saved to your account.',
    target: '[data-tutorial="tab-documents"]',
    position: 'bottom',
    icon: FileText,
    tabTarget: 'documents'
  },
  {
    id: 'prescriptions',
    title: 'Prescriptions',
    description: 'View your current prescriptions and prescription history here.',
    target: '[data-tutorial="tab-prescriptions"]',
    position: 'bottom',
    icon: Stethoscope,
    tabTarget: 'prescriptions'
  },
  {
    id: 'items',
    title: 'Items',
    description: 'Browse and find medical equipment items that may be of interest to you.',
    target: '[data-tutorial="tab-items"]',
    position: 'bottom',
    icon: Package,
    tabTarget: 'items'
  },
  {
    id: 'orders',
    title: 'Orders',
    description: 'View your complete order history and track the status of current orders.',
    target: '[data-tutorial="tab-orders"]',
    position: 'bottom',
    icon: ShoppingCart,
    tabTarget: 'orders'
  },
  {
    id: 'notes',
    title: 'Notes',
    description: 'Communication between you and your representative will appear here. You can send messages and receive updates.',
    target: '[data-tutorial="tab-notes"]',
    position: 'bottom',
    icon: ClipboardList,
    tabTarget: 'notes'
  },
  {
    id: 'financial',
    title: 'Financial',
    description: 'If you\'re a cash client, your payment information will be stored here securely.',
    target: '[data-tutorial="tab-financial"]',
    position: 'bottom',
    icon: CreditCard,
    tabTarget: 'financial'
  },
  {
    id: 'files',
    title: 'Files',
    description: 'Access recordings from your doctor, or files that you or your doctor may upload here.',
    target: '[data-tutorial="tab-files"]',
    position: 'bottom',
    icon: FolderOpen,
    tabTarget: 'files'
  },
  {
    id: 'complete',
    title: 'You\'re All Set! ✅',
    description: 'You\'ve completed the tour! Start by updating your contact information and insurance details.',
    target: null,
    position: 'center',
    icon: Sparkles
  }
];

export default function PatientOnboardingTutorial({ 
  isOpen, 
  onClose, 
  onComplete,
  onTabChange 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [arrowDirection, setArrowDirection] = useState('left');

  const step = TUTORIAL_STEPS[currentStep];

  const calculatePosition = useCallback(() => {
    if (!step.target || step.position === 'center') {
      // Center the tooltip
      setTooltipPosition({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      });
      setArrowDirection('none');
      return;
    }

    const targetEl = document.querySelector(step.target);
    if (!targetEl) {
      // Fallback to center if target not found
      setTooltipPosition({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      });
      setArrowDirection('none');
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const padding = 16;

    let top, left, transform = '';

    switch (step.position) {
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + padding;
        transform = 'translateY(-50%)';
        setArrowDirection('left');
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - tooltipWidth - padding;
        transform = 'translateY(-50%)';
        setArrowDirection('right');
        break;
      case 'bottom':
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2;
        transform = 'translateX(-50%)';
        setArrowDirection('top');
        break;
      case 'top':
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2;
        transform = 'translateX(-50%)';
        setArrowDirection('bottom');
        break;
      default:
        top = '50%';
        left = '50%';
        transform = 'translate(-50%, -50%)';
        setArrowDirection('none');
    }

    // Keep tooltip within viewport
    if (typeof left === 'number') {
      if (left < padding) left = padding;
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }
    }
    if (typeof top === 'number') {
      if (top < padding) top = padding;
      if (top + tooltipHeight > window.innerHeight - padding) {
        top = window.innerHeight - tooltipHeight - padding;
      }
    }

    setTooltipPosition({ top, left, transform });
  }, [step]);

  useEffect(() => {
    if (!isOpen) return;

    // Highlight the target element
    if (step.target) {
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetEl.classList.add('tutorial-highlight');
        // Scroll into view if needed
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // Change tab if needed
    if (step.tabTarget && onTabChange) {
      onTabChange(step.tabTarget);
    }

    // Calculate tooltip position after a small delay for DOM updates
    const timer = setTimeout(calculatePosition, 100);

    // Recalculate on resize
    window.addEventListener('resize', calculatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePosition);
      // Remove highlight from all elements
      document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
      });
    };
  }, [isOpen, currentStep, step, calculatePosition, onTabChange]);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
    // Still mark as completed so it doesn't show again
    if (onComplete) onComplete();
  };

  const handleComplete = () => {
    onClose();
    if (onComplete) onComplete();
  };

  if (!isOpen) return null;

  const Icon = step.icon;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9998]" 
        onClick={handleSkip}
        data-testid="tutorial-overlay"
      />

      {/* Tooltip Card */}
      <Card
        className="fixed z-[9999] w-80 shadow-2xl border-2 border-primary/20 bg-white dark:bg-slate-900"
        style={{
          top: typeof tooltipPosition.top === 'number' ? `${tooltipPosition.top}px` : tooltipPosition.top,
          left: typeof tooltipPosition.left === 'number' ? `${tooltipPosition.left}px` : tooltipPosition.left,
          transform: tooltipPosition.transform
        }}
        data-testid="tutorial-tooltip"
      >
        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-t-lg overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Arrow */}
        {arrowDirection !== 'none' && (
          <div 
            className={`absolute w-3 h-3 bg-white dark:bg-slate-900 border-primary/20 transform rotate-45 ${
              arrowDirection === 'left' ? '-left-1.5 top-1/2 -translate-y-1/2 border-l border-b' :
              arrowDirection === 'right' ? '-right-1.5 top-1/2 -translate-y-1/2 border-r border-t' :
              arrowDirection === 'top' ? 'left-1/2 -top-1.5 -translate-x-1/2 border-l border-t' :
              arrowDirection === 'bottom' ? 'left-1/2 -bottom-1.5 -translate-x-1/2 border-r border-b' : ''
            }`}
          />
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{step.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={handleSkip}
              data-testid="tutorial-close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4">
            {step.description}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground"
              data-testid="tutorial-skip"
            >
              Skip Tutorial
            </Button>
            
            <div className="flex gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  data-testid="tutorial-prev"
                >
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                data-testid="tutorial-next"
              >
                {isLastStep ? 'Get Started' : 'Next'}
                {!isLastStep && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tutorial highlight styles */}
      <style>{`
        .tutorial-highlight {
          position: relative;
          z-index: 9997 !important;
          box-shadow: 0 0 0 4px rgba(var(--primary-rgb, 59, 130, 246), 0.5),
                      0 0 20px rgba(var(--primary-rgb, 59, 130, 246), 0.3) !important;
          border-radius: 8px;
          animation: tutorial-pulse 2s ease-in-out infinite;
        }
        
        @keyframes tutorial-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(var(--primary-rgb, 59, 130, 246), 0.5),
                        0 0 20px rgba(var(--primary-rgb, 59, 130, 246), 0.3);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(var(--primary-rgb, 59, 130, 246), 0.3),
                        0 0 30px rgba(var(--primary-rgb, 59, 130, 246), 0.2);
          }
        }
      `}</style>
    </>
  );
}
