import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generatePayslipPDF = async (payout, employee) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper function to format currency
    const formatCurrency = (amount) => {
      return `₹${parseFloat(amount || 0).toLocaleString('en-IN', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    };

    // Helper function to get month name
    const getMonthName = (month) => {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
      return months[month - 1] || '';
    };

    // Colors
    const primaryColor = [16, 185, 129]; // Emerald
    const darkColor = [31, 41, 55]; // Gray-800
    const lightGray = [243, 244, 246]; // Gray-100

    // Header with company info and logo area
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Company Name - Left aligned
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('CollegeCart', 20, 22);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Employee Salary Slip', 20, 32);

    // Company Details - Right aligned
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CollegeCart Pvt. Ltd.', pageWidth - 20, 15, { align: 'right' });
    doc.text('Campus Address, City', pageWidth - 20, 21, { align: 'right' });
    doc.text('Email: hr@collegecart.com', pageWidth - 20, 27, { align: 'right' });
    doc.text('Phone: +91-XXXXXXXXXX', pageWidth - 20, 33, { align: 'right' });

    // Reset text color
    doc.setTextColor(...darkColor);

    // Payslip period
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Salary Slip - ${getMonthName(payout.payout_month)} ${payout.payout_year}`, pageWidth / 2, 60, { align: 'center' });

    // Employee and Payment Details Section
    let yPos = 72;
    
    // Employee Details Box - Left Side
    doc.setFillColor(...lightGray);
    doc.roundedRect(15, yPos, (pageWidth - 35) / 2, 45, 3, 3, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('EMPLOYEE DETAILS', 20, yPos + 8);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    
    doc.text('Name:', 20, yPos + 18);
    doc.text('Code:', 20, yPos + 26);
    doc.text('Department:', 20, yPos + 34);
    doc.text('Designation:', 20, yPos + 42);

    doc.setFont('helvetica', 'normal');
    const leftColValueX = 50;
    doc.text(employee.full_name || 'N/A', leftColValueX, yPos + 18);
    doc.text(employee.employee_code || 'N/A', leftColValueX, yPos + 26);
    doc.text(employee.department?.department_name || 'N/A', leftColValueX, yPos + 34);
    doc.text(employee.role?.role_name || 'N/A', leftColValueX, yPos + 42);

    // Payment Details Box - Right Side
    const rightBoxX = (pageWidth - 35) / 2 + 20;
    doc.setFillColor(...lightGray);
    doc.roundedRect(rightBoxX, yPos, (pageWidth - 35) / 2, 45, 3, 3, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('PAYMENT DETAILS', rightBoxX + 5, yPos + 8);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    
    doc.text('Payment Date:', rightBoxX + 5, yPos + 18);
    doc.text('Payment Method:', rightBoxX + 5, yPos + 26);
    doc.text('Bank Account:', rightBoxX + 5, yPos + 34);
    doc.text('Status:', rightBoxX + 5, yPos + 42);

    doc.setFont('helvetica', 'normal');
    const rightColValueX = rightBoxX + 40;
    doc.text(new Date(payout.payout_date).toLocaleDateString('en-IN'), rightColValueX, yPos + 18);
    doc.text((payout.payment_method || 'bank_transfer').replace('_', ' ').toUpperCase(), rightColValueX, yPos + 26);
    doc.text(employee.bank_account_number ? `****${employee.bank_account_number.slice(-4)}` : 'N/A', rightColValueX, yPos + 34);
    doc.text(payout.status?.toUpperCase() || 'PAID', rightColValueX, yPos + 42);

    yPos += 55;

    // Earnings Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('EARNINGS', 20, yPos);

    yPos += 5;

    const earningsData = [
      ['Basic Salary', formatCurrency(payout.basic_salary)],
      ['HRA', formatCurrency(payout.hra)],
      ['Transport Allowance', formatCurrency(payout.transport_allowance)],
      ['Other Allowances', formatCurrency(payout.other_allowances)],
      ['Bonus', formatCurrency(payout.bonus)]
    ];

    doc.autoTable({
      startY: yPos,
      head: [['Description', 'Amount']],
      body: earningsData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: { top: 3, right: 5, bottom: 3, left: 5 }
      },
      columnStyles: {
        0: { 
          cellWidth: 120,
          halign: 'left'
        },
        1: { 
          cellWidth: 60,
          halign: 'right'
        }
      },
      margin: { left: 15, right: 15 }
    });

    yPos = doc.lastAutoTable.finalY + 2;

    // Gross Salary
    doc.setFillColor(...lightGray);
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    doc.text('GROSS SALARY', 20, yPos + 7);
    doc.text(formatCurrency(payout.gross_salary), pageWidth - 20, yPos + 7, { align: 'right' });

    yPos += 15;

    // Deductions Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor([220, 38, 38]); // Red
    doc.text('DEDUCTIONS', 20, yPos);

    yPos += 5;

    const deductionsData = [
      ['PF Deduction', formatCurrency(payout.pf_deduction)],
      ['Tax Deduction (TDS)', formatCurrency(payout.tax_deduction)],
      ['Other Deductions', formatCurrency(payout.other_deductions)],
      ['Penalty', formatCurrency(payout.penalty)]
    ];

    doc.autoTable({
      startY: yPos,
      head: [['Description', 'Amount']],
      body: deductionsData,
      theme: 'grid',
      headStyles: {
        fillColor: [220, 38, 38],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: { top: 3, right: 5, bottom: 3, left: 5 }
      },
      columnStyles: {
        0: { 
          cellWidth: 120,
          halign: 'left'
        },
        1: { 
          cellWidth: 60,
          halign: 'right'
        }
      },
      margin: { left: 15, right: 15 }
    });

    yPos = doc.lastAutoTable.finalY + 2;

    // Total Deductions
    const totalDeductions = 
      parseFloat(payout.pf_deduction || 0) + 
      parseFloat(payout.tax_deduction || 0) + 
      parseFloat(payout.other_deductions || 0) + 
      parseFloat(payout.penalty || 0);

    doc.setFillColor(...lightGray);
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    doc.text('TOTAL DEDUCTIONS', 20, yPos + 7);
    doc.text(formatCurrency(totalDeductions), pageWidth - 20, yPos + 7, { align: 'right' });

    yPos += 15;

    // Net Salary (Highlighted)
    doc.setFillColor(...primaryColor);
    doc.roundedRect(15, yPos, pageWidth - 30, 15, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('NET SALARY', 20, yPos + 10);
    doc.text(formatCurrency(payout.net_salary), pageWidth - 20, yPos + 10, { align: 'right' });

    yPos += 25;

    // Notes section if available
    if (payout.notes) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      doc.text('Notes:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitNotes = doc.splitTextToSize(payout.notes, pageWidth - 40);
      doc.text(splitNotes, 20, yPos + 5);
      yPos += 5 + (splitNotes.length * 5);
    }

    // Footer - Fixed at bottom
    const footerY = pageHeight - 25;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(107, 114, 128); // Gray-500
    doc.text('This is a computer-generated payslip and does not require a signature.', pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`, pageWidth / 2, footerY + 5, { align: 'center' });
    doc.text('For any queries, please contact HR Department', pageWidth / 2, footerY + 10, { align: 'center' });

    // Save the PDF
    const fileName = `Payslip_${employee.employee_code}_${getMonthName(payout.payout_month)}_${payout.payout_year}.pdf`;
    doc.save(fileName);

    return { success: true, fileName };
  } catch (error) {
    console.error('Error generating payslip:', error);
    throw error;
  }
};
