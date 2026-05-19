/**
 * KYC Verification Service
 * 
 * Uses Surepass API for Aadhaar OKYC and PAN verification.
 * 
 * SETUP:
 * 1. Sign up at https://surepass.io → Click "Get API Key"
 * 2. Login to https://dashboard.surepass.io
 * 3. Copy your Authorization Token
 * 4. Add to .env:
 *    VITE_KYC_API_KEY=your_surepass_token
 *    VITE_KYC_BASE_URL=https://kyc-api.surepass.io/api/v1
 * 
 * For sandbox/testing:
 *    VITE_KYC_BASE_URL=https://sandbox.surepass.io/api/v1
 * 
 * PRICING:
 * - Aadhaar OKYC: ~Rs 3-5 per verification
 * - PAN Verification: ~Rs 1-2 per verification
 * - Sandbox: FREE (unlimited)
 */

import { supabase } from '@/lib/supabase';

// Configuration - Surepass API
const KYC_CONFIG = {
  // Surepass API URLs:
  // Sandbox: https://sandbox.surepass.io/api/v1
  // Production: https://kyc-api.surepass.io/api/v1
  baseUrl: import.meta.env.VITE_KYC_BASE_URL || 'https://kyc-api.surepass.io/api/v1',
  token: import.meta.env.VITE_KYC_API_KEY || '',
  
  // Set to true when you have API keys configured
  isLive: !!import.meta.env.VITE_KYC_API_KEY,
};

/**
 * Aadhaar Verification - Step 1: Generate OTP
 * Sends OTP to the mobile number linked with Aadhaar
 */
export const sendAadhaarOTP = async (aadhaarNumber, employeeId) => {
  try {
    // Validate Aadhaar format
    const cleanAadhaar = aadhaarNumber.replace(/\s/g, '');
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      return { success: false, error: 'Invalid Aadhaar number. Must be 12 digits.' };
    }

    // Log the attempt
    await logKYCActivity(employeeId, 'aadhaar_otp_sent', { 
      aadhaar_last4: cleanAadhaar.slice(-4) 
    });

    if (!KYC_CONFIG.isLive) {
      // DEMO MODE - Simulate OTP sent
      // In production, replace with actual API call
      console.log('[KYC Demo] OTP would be sent to Aadhaar-linked mobile');
      return { 
        success: true, 
        clientId: 'demo_' + Date.now(),
        message: 'OTP sent to Aadhaar-linked mobile number',
        isDemo: true
      };
    }

    // PRODUCTION: Surepass Aadhaar OKYC - Generate OTP
    const response = await fetch(`${KYC_CONFIG.baseUrl}/aadhaar-v2/generate-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KYC_CONFIG.token}`
      },
      body: JSON.stringify({
        id_number: cleanAadhaar
      })
    });

    const data = await response.json();

    if (data.data?.client_id || data.success) {
      return {
        success: true,
        clientId: data.data?.client_id,
        message: 'OTP sent to Aadhaar-linked mobile number'
      };
    } else {
      return { 
        success: false, 
        error: data.message || data.message_code || 'Failed to send OTP. Please try again.' 
      };
    }
  } catch (error) {
    console.error('Aadhaar OTP error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

/**
 * Aadhaar Verification - Step 2: Verify OTP
 * Verifies the OTP and returns Aadhaar holder details
 */
export const verifyAadhaarOTP = async (clientId, otp, employeeId) => {
  try {
    if (!/^\d{6}$/.test(otp)) {
      return { success: false, error: 'Invalid OTP. Must be 6 digits.' };
    }

    if (!KYC_CONFIG.isLive) {
      // DEMO MODE - Simulate verification
      if (otp === '123456') {
        const demoResult = {
          success: true,
          data: {
            full_name: 'Demo User',
            dob: '1995-01-15',
            gender: 'M',
            address: 'Demo Address, City, State - 110001',
            photo: null
          },
          isDemo: true
        };

        await logKYCActivity(employeeId, 'aadhaar_otp_verified', { 
          status: 'success',
          isDemo: true 
        }, 'success');

        return demoResult;
      } else {
        return { success: false, error: 'Invalid OTP. Use 123456 for demo.' };
      }
    }

    // PRODUCTION: Surepass Aadhaar OKYC - Verify OTP
    const response = await fetch(`${KYC_CONFIG.baseUrl}/aadhaar-v2/submit-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KYC_CONFIG.token}`
      },
      body: JSON.stringify({
        client_id: clientId,
        otp: otp
      })
    });

    const data = await response.json();

    if (data.success || data.data?.full_name) {
      await logKYCActivity(employeeId, 'aadhaar_otp_verified', { 
        status: 'success',
        name: data.data?.full_name 
      }, 'success');

      return {
        success: true,
        data: {
          full_name: data.data?.full_name,
          dob: data.data?.dob,
          gender: data.data?.gender,
          address: data.data?.address?.full_address || data.data?.zip,
          photo: data.data?.profile_image
        }
      };
    } else {
      await logKYCActivity(employeeId, 'aadhaar_otp_verified', { 
        status: 'failed',
        error: data.message 
      }, 'failed');

      return { 
        success: false, 
        error: data.message || 'OTP verification failed. Please try again.' 
      };
    }
  } catch (error) {
    console.error('Aadhaar verify error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

/**
 * PAN Verification
 * Verifies PAN card and returns holder name
 */
export const verifyPAN = async (panNumber, employeeId) => {
  try {
    const cleanPAN = panNumber.toUpperCase().trim();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPAN)) {
      return { success: false, error: 'Invalid PAN format. Must be like ABCDE1234F.' };
    }

    await logKYCActivity(employeeId, 'pan_verification', { 
      pan_last4: cleanPAN.slice(-4) 
    });

    if (!KYC_CONFIG.isLive) {
      // DEMO MODE
      const demoResult = {
        success: true,
        data: {
          full_name: 'Demo User',
          pan_number: cleanPAN,
          status: 'VALID'
        },
        isDemo: true
      };

      await logKYCActivity(employeeId, 'pan_verified', { 
        status: 'success',
        isDemo: true 
      }, 'success');

      return demoResult;
    }

    // PRODUCTION: Surepass PAN Verification API
    const response = await fetch(`${KYC_CONFIG.baseUrl}/pan/pan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KYC_CONFIG.token}`
      },
      body: JSON.stringify({
        id_number: cleanPAN
      })
    });

    const data = await response.json();

    if (data.success || data.data?.full_name) {
      await logKYCActivity(employeeId, 'pan_verified', { 
        status: 'success',
        name: data.data?.full_name 
      }, 'success');

      return {
        success: true,
        data: {
          full_name: data.data?.full_name,
          pan_number: cleanPAN,
          status: 'VALID'
        }
      };
    } else {
      await logKYCActivity(employeeId, 'pan_verified', { 
        status: 'failed',
        error: data.message 
      }, 'failed');

      return { 
        success: false, 
        error: data.message || 'PAN verification failed.' 
      };
    }
  } catch (error) {
    console.error('PAN verify error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

/**
 * Update employee KYC status in database
 */
export const updateEmployeeKYC = async (employeeId, kycData) => {
  try {
    const { data, error } = await supabase
      .from('employee_accounts')
      .update({
        ...kycData,
        kyc_submitted_at: new Date().toISOString()
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Update KYC error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Admin: Approve employee KYC
 */
export const approveKYC = async (employeeId, adminId) => {
  try {
    const { data, error } = await supabase
      .from('employee_accounts')
      .update({
        kyc_status: 'verified',
        kyc_verified_at: new Date().toISOString(),
        kyc_verified_by: adminId
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) throw error;

    await logKYCActivity(employeeId, 'admin_approved', { 
      approved_by: adminId 
    }, 'success');

    return { success: true, data };
  } catch (error) {
    console.error('Approve KYC error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Admin: Reject employee KYC
 */
export const rejectKYC = async (employeeId, adminId, reason) => {
  try {
    const { data, error } = await supabase
      .from('employee_accounts')
      .update({
        kyc_status: 'rejected',
        kyc_rejection_reason: reason,
        kyc_verified_by: adminId
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) throw error;

    await logKYCActivity(employeeId, 'admin_rejected', { 
      rejected_by: adminId,
      reason 
    }, 'success');

    return { success: true, data };
  } catch (error) {
    console.error('Reject KYC error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Admin: Upload KYC documents for employee
 */
export const adminUploadKYC = async (employeeId, adminId, kycData) => {
  try {
    const { data, error } = await supabase
      .from('employee_accounts')
      .update({
        aadhaar_number: kycData.aadhaar_number || null,
        pan_number: kycData.pan_number || null,
        bank_account_number: kycData.bank_account_number || null,
        bank_ifsc: kycData.bank_ifsc || null,
        bank_name: kycData.bank_name || null,
        kyc_status: 'verified',
        kyc_documents: kycData.documents || {},
        kyc_verified_at: new Date().toISOString(),
        kyc_verified_by: adminId,
        aadhaar_verified: !!kycData.aadhaar_number,
        pan_verified: !!kycData.pan_number,
        bank_verified: !!kycData.bank_account_number
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) throw error;

    await logKYCActivity(employeeId, 'admin_upload', { 
      uploaded_by: adminId,
      has_aadhaar: !!kycData.aadhaar_number,
      has_pan: !!kycData.pan_number,
      has_bank: !!kycData.bank_account_number
    }, 'success');

    return { success: true, data };
  } catch (error) {
    console.error('Admin upload KYC error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Log KYC activity
 */
const logKYCActivity = async (employeeId, type, requestData = {}, status = 'pending') => {
  try {
    await supabase
      .from('employee_kyc_logs')
      .insert({
        employee_id: employeeId,
        verification_type: type,
        request_data: requestData,
        status: status
      });
  } catch (error) {
    console.error('KYC log error:', error);
  }
};
