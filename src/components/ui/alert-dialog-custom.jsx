import React, { createContext, useContext, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";

const DialogContext = createContext();

export const DialogProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    type: 'info', // 'info', 'warning', 'success', 'error', 'confirm'
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false,
  });

  const showDialog = ({
    type = 'info',
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = false,
  }) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        type,
        title,
        message,
        confirmText,
        cancelText,
        showCancel,
        onConfirm: () => {
          setDialogState(prev => ({ ...prev, isOpen: false }));
          if (onConfirm) onConfirm();
          resolve(true);
        },
        onCancel: () => {
          setDialogState(prev => ({ ...prev, isOpen: false }));
          if (onCancel) onCancel();
          resolve(false);
        },
      });
    });
  };

  // Convenience methods
  const alert = (message, title = 'Notice') => {
    return showDialog({
      type: 'info',
      title,
      message,
      showCancel: false,
    });
  };

  const confirm = (message, title = 'Confirm') => {
    return showDialog({
      type: 'confirm',
      title,
      message,
      showCancel: true,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
    });
  };

  const success = (message, title = 'Success') => {
    return showDialog({
      type: 'success',
      title,
      message,
      showCancel: false,
    });
  };

  const error = (message, title = 'Error') => {
    return showDialog({
      type: 'error',
      title,
      message,
      showCancel: false,
    });
  };

  const warning = (message, title = 'Warning') => {
    return showDialog({
      type: 'warning',
      title,
      message,
      showCancel: false,
    });
  };

  const getIcon = () => {
    switch (dialogState.type) {
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-600" />;
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'confirm':
        return <AlertTriangle className="h-6 w-6 text-blue-600" />;
      default:
        return <Info className="h-6 w-6 text-blue-600" />;
    }
  };

  return (
    <DialogContext.Provider value={{ showDialog, alert, confirm, success, error, warning }}>
      {children}
      
      <AlertDialog open={dialogState.isOpen} onOpenChange={(open) => {
        if (!open) dialogState.onCancel?.();
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              {getIcon()}
              <AlertDialogTitle className="text-lg">
                {dialogState.title}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base pt-2">
              {dialogState.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {dialogState.showCancel && (
              <AlertDialogCancel onClick={dialogState.onCancel}>
                {dialogState.cancelText}
              </AlertDialogCancel>
            )}
            <AlertDialogAction 
              onClick={dialogState.onConfirm}
              className={
                dialogState.type === 'error' ? 'bg-red-600 hover:bg-red-700' :
                dialogState.type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                dialogState.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-emerald-600 hover:bg-emerald-700'
              }
            >
              {dialogState.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
