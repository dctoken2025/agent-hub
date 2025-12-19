import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tipos de dialog
type DialogType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface DialogState extends DialogOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

interface DialogContextType {
  alert: (message: string, options?: Partial<DialogOptions>) => Promise<void>;
  confirm: (message: string, options?: Partial<DialogOptions>) => Promise<boolean>;
  success: (message: string, title?: string) => Promise<void>;
  error: (message: string, title?: string) => Promise<void>;
  warning: (message: string, title?: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | null>(null);

const typeConfig = {
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-100 dark:bg-green-900',
    iconColor: 'text-green-600 dark:text-green-400',
    buttonColor: 'bg-green-600 hover:bg-green-700',
    defaultTitle: 'Sucesso',
  },
  error: {
    icon: XCircle,
    iconBg: 'bg-red-100 dark:bg-red-900',
    iconColor: 'text-red-600 dark:text-red-400',
    buttonColor: 'bg-red-600 hover:bg-red-700',
    defaultTitle: 'Erro',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-orange-100 dark:bg-orange-900',
    iconColor: 'text-orange-600 dark:text-orange-400',
    buttonColor: 'bg-orange-600 hover:bg-orange-700',
    defaultTitle: 'Atenção',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100 dark:bg-blue-900',
    iconColor: 'text-blue-600 dark:text-blue-400',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    defaultTitle: 'Informação',
  },
  confirm: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100 dark:bg-amber-900',
    iconColor: 'text-amber-600 dark:text-amber-400',
    buttonColor: 'bg-primary hover:bg-primary/90',
    defaultTitle: 'Confirmar',
  },
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showDialog = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        ...options,
        isOpen: true,
        resolve,
      });
    });
  }, []);

  const closeDialog = useCallback((result: boolean) => {
    if (dialog.resolve) {
      dialog.resolve(result);
    }
    if (result && dialog.onConfirm) {
      dialog.onConfirm();
    }
    if (!result && dialog.onCancel) {
      dialog.onCancel();
    }
    setDialog((prev) => ({ ...prev, isOpen: false }));
  }, [dialog]);

  const alert = useCallback(async (message: string, options?: Partial<DialogOptions>) => {
    await showDialog({
      message,
      type: options?.type || 'info',
      title: options?.title,
      confirmText: options?.confirmText || 'OK',
    });
  }, [showDialog]);

  const confirm = useCallback(async (message: string, options?: Partial<DialogOptions>) => {
    return showDialog({
      message,
      type: 'confirm',
      title: options?.title || 'Confirmar',
      confirmText: options?.confirmText || 'Confirmar',
      cancelText: options?.cancelText || 'Cancelar',
    });
  }, [showDialog]);

  const success = useCallback(async (message: string, title?: string) => {
    await showDialog({
      message,
      type: 'success',
      title: title || 'Sucesso',
      confirmText: 'OK',
    });
  }, [showDialog]);

  const error = useCallback(async (message: string, title?: string) => {
    await showDialog({
      message,
      type: 'error',
      title: title || 'Erro',
      confirmText: 'OK',
    });
  }, [showDialog]);

  const warning = useCallback(async (message: string, title?: string) => {
    await showDialog({
      message,
      type: 'warning',
      title: title || 'Atenção',
      confirmText: 'OK',
    });
  }, [showDialog]);

  const config = typeConfig[dialog.type || 'info'];
  const Icon = config.icon;
  const isConfirmType = dialog.type === 'confirm';

  return (
    <DialogContext.Provider value={{ alert, confirm, success, error, warning }}>
      {children}
      
      {/* Dialog Modal */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => isConfirmType && closeDialog(false)}
          />
          
          {/* Dialog */}
          <div className="relative bg-card rounded-2xl border shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 fade-in duration-200">
            {/* Close button */}
            <button
              onClick={() => closeDialog(false)}
              className="absolute top-4 right-4 p-1 hover:bg-secondary rounded-lg transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            
            {/* Content */}
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className={cn("p-4 rounded-full mb-4", config.iconBg)}>
                  <Icon className={cn("h-8 w-8", config.iconColor)} />
                </div>
                
                {/* Title */}
                <h3 className="text-xl font-semibold mb-2">
                  {dialog.title || config.defaultTitle}
                </h3>
                
                {/* Message */}
                <p className="text-muted-foreground leading-relaxed">
                  {dialog.message}
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className={cn(
              "flex gap-3 p-4 border-t bg-secondary/20 rounded-b-2xl",
              isConfirmType ? "justify-end" : "justify-center"
            )}>
              {isConfirmType && (
                <button
                  onClick={() => closeDialog(false)}
                  className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium"
                >
                  {dialog.cancelText || 'Cancelar'}
                </button>
              )}
              <button
                onClick={() => closeDialog(true)}
                className={cn(
                  "px-5 py-2.5 text-white rounded-lg transition-colors font-medium min-w-[100px]",
                  config.buttonColor
                )}
              >
                {dialog.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog deve ser usado dentro de um DialogProvider');
  }
  return context;
}
