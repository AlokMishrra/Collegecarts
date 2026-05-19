import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Shield, 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  FileText,
  Phone
} from 'lucide-react';
import { 
  sendAadhaarOTP, 
  verifyAadhaarOTP, 
  verifyPAN, 
  updateEmployeeKYC 
} from '@/services/kycVerificationService';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';

export default function KYCVerificationDialog({ open, onClose, onSuccess }) {
  const { employee, updateEmployee } = useEmployeeAuth();
  const [step, setStep] = useState(1); // 1: intro, 2: aadhaar, 3: aadhaar-otp, 4: pan, 5: success
  const [loading, setLoading] = useState(false);
  
  // Aadhaar state
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarOTP, setAadhaarOTP] = useState('');
  const [aadhaarClientId, setAadhaarClientId] = useState('');
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarData, setAadhaarData] = useState(null);
  
  // PAN state
  const [panNumber, setPanNumber] = useState('');
  const [panVerified, setPanVerified] = useState(false);
  const [panData, setPanData] = useState(null);

  const formatAadhaar = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleSendAadhaarOTP = async () => {
    const cleanAadhaar = aadhaarNumber.replace(/\s/g, '');
    if (cleanAadhaar.length !== 12) {
      toast.error('Please enter a valid 12-digit Aadhaar number');
      return;
    }

    setLoading(true);
    const result = await sendAadhaarOTP(cleanAadhaar, employee.id);
    setLoading(false);

    if (result.success) {
      setAadhaarClientId(result.clientId);
      setStep(3);
      toast.success(result.message || 'OTP sent to your Aadhaar-linked mobile');
      if (result.isDemo) {
        toast.info('Demo mode: Use OTP 123456');
      }
    } else {
      toast.error(result.error);
    }
  };

  const handleVerifyAadhaarOTP = async () => {
    if (aadhaarOTP.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    const result = await verifyAadhaarOTP(aadhaarClientId, aadhaarOTP, employee.id);
    setLoading(false);

    if (result.success) {
      setAadhaarVerified(true);
      setAadhaarData(result.data);
      toast.success('Aadhaar verified successfully');
      setStep(4); // Move to PAN
    } else {
      toast.error(result.error);
    }
  };

  const handleVerifyPAN = async () => {
    const cleanPAN = panNumber.toUpperCase().trim();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPAN)) {
      toast.error('Please enter a valid PAN number (e.g., ABCDE1234F)');
      return;
    }

    setLoading(true);
    const result = await verifyPAN(cleanPAN, employee.id);
    setLoading(false);

    if (result.success) {
      setPanVerified(true);
      setPanData(result.data);
      toast.success('PAN verified successfully');
      
      // Save KYC data
      await saveKYCData(cleanPAN);
    } else {
      toast.error(result.error);
    }
  };

  const saveKYCData = async (panNum) => {
    setLoading(true);
    const cleanAadhaar = aadhaarNumber.replace(/\s/g, '');
    
    const kycUpdate = {
      aadhaar_number: cleanAadhaar,
      aadhaar_verified: true,
      aadhaar_name: aadhaarData?.full_name || '',
      pan_number: panNum,
      pan_verified: true,
      pan_name: panData?.full_name || '',
      kyc_status: 'submitted',
      kyc_documents: {
        aadhaar_verified_at: new Date().toISOString(),
        pan_verified_at: new Date().toISOString(),
        aadhaar_name: aadhaarData?.full_name,
        pan_name: panData?.full_name
      }
    };

    const result = await updateEmployeeKYC(employee.id, kycUpdate);
    setLoading(false);

    if (result.success) {
      setStep(5);
      updateEmployee({ kyc_status: 'submitted', ...kycUpdate });
      if (onSuccess) onSuccess();
    } else {
      toast.error('Failed to save KYC data. Please try again.');
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Complete Your KYC Verification</h3>
              <p className="text-sm text-gray-600">
                To ensure security and enable salary payments, please verify your identity using Aadhaar and PAN card.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">1</div>
                <div>
                  <p className="font-medium text-sm">Aadhaar Verification</p>
                  <p className="text-xs text-gray-500">OTP sent to Aadhaar-linked mobile</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">2</div>
                <div>
                  <p className="font-medium text-sm">PAN Verification</p>
                  <p className="text-xs text-gray-500">Instant PAN card validation</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSkip} className="flex-1">
                Skip for Now
              </Button>
              <Button onClick={() => setStep(2)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                Start Verification <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Aadhaar Verification</h3>
                <p className="text-xs text-gray-500">Enter your 12-digit Aadhaar number</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aadhaar">Aadhaar Number</Label>
              <Input
                id="aadhaar"
                placeholder="XXXX XXXX XXXX"
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(formatAadhaar(e.target.value))}
                maxLength={14}
                className="text-lg tracking-wider font-mono"
              />
              <p className="text-xs text-gray-500">
                An OTP will be sent to your Aadhaar-linked mobile number
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button 
                onClick={handleSendAadhaarOTP} 
                disabled={loading || aadhaarNumber.replace(/\s/g, '').length !== 12}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
                Send OTP
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Enter OTP</h3>
                <p className="text-xs text-gray-500">OTP sent to your Aadhaar-linked mobile</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp">6-Digit OTP</Label>
              <Input
                id="otp"
                placeholder="Enter OTP"
                value={aadhaarOTP}
                onChange={(e) => setAadhaarOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-lg tracking-[0.5em] font-mono text-center"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setStep(2); setAadhaarOTP(''); }}>
                Back
              </Button>
              <Button 
                onClick={handleVerifyAadhaarOTP} 
                disabled={loading || aadhaarOTP.length !== 6}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Verify OTP
              </Button>
            </div>

            <button 
              onClick={handleSendAadhaarOTP} 
              className="text-sm text-emerald-600 hover:underline w-full text-center"
              disabled={loading}
            >
              Resend OTP
            </button>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            {aadhaarVerified && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-700">Aadhaar verified: {aadhaarData?.full_name}</span>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold">PAN Verification</h3>
                <p className="text-xs text-gray-500">Enter your 10-character PAN number</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pan">PAN Number</Label>
              <Input
                id="pan"
                placeholder="ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                maxLength={10}
                className="text-lg tracking-wider font-mono uppercase"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button 
                onClick={handleVerifyPAN} 
                disabled={loading || panNumber.length !== 10}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Verify PAN
              </Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-green-700">KYC Submitted Successfully</h3>
            <p className="text-sm text-gray-600">
              Your documents have been verified. Admin will review and approve your KYC shortly.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Aadhaar</span>
                <Badge className="bg-green-100 text-green-700">Verified</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">PAN</span>
                <Badge className="bg-green-100 text-green-700">Verified</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <Badge className="bg-yellow-100 text-yellow-700">Pending Approval</Badge>
              </div>
            </div>

            <Button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Done
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            KYC Verification
          </DialogTitle>
          {step < 5 && (
            <DialogDescription>
              Step {Math.min(step, 4)} of 4 - Identity Verification
            </DialogDescription>
          )}
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
