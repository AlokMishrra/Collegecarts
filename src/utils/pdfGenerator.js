import jsPDF from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';

export const generateStockOrderPDF = async (order, showPrices = false) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('CollegeCart', 105, 15, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Stock Order', 105, 25, { align: 'center' });
  
  // Order Number
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Order Number: ${order.order_number}`, 20, 35);
  
  // Status Badge
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const statusColors = {
    pending: [255, 193, 7],
    approved: [33, 150, 243],
    fulfilled: [76, 175, 80],
    rejected: [244, 67, 54],
    cancelled: [158, 158, 158]
  };
  const statusColor = statusColors[order.status] || [158, 158, 158];
  doc.setFillColor(...statusColor);
  doc.rect(150, 30, 40, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(order.status.toUpperCase(), 170, 36, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  
  // Order Details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let yPos = 50;
  
  doc.text('Order Details:', 20, yPos);
  yPos += 7;
  doc.text(`Requested By: ${order.employee?.full_name} (${order.employee?.employee_code})`, 20, yPos);
  yPos += 5;
  doc.text(`Department: ${order.department?.department_name || 'N/A'}`, 20, yPos);
  yPos += 5;
  doc.text(`Date: ${new Date(order.requested_date).toLocaleDateString()}`, 20, yPos);
  yPos += 5;
  doc.text(`Priority: ${order.priority}`, 20, yPos);
  yPos += 5;
  doc.text(`Type: ${order.order_type}`, 20, yPos);
  yPos += 10;
  
  // Items Table
  const tableColumns = showPrices
    ? ['Product', 'Quantity', 'Unit Price', 'Total Price']
    : ['Product', 'Quantity'];
  
  const tableRows = order.items?.map(item => {
    if (showPrices) {
      return [
        item.product_name,
        item.quantity.toString(),
        `₹${item.unit_price?.toFixed(2)}`,
        `₹${item.total_price?.toFixed(2)}`
      ];
    } else {
      return [
        item.product_name,
        item.quantity.toString()
      ];
    }
  }) || [];
  
  doc.autoTable({
    startY: yPos,
    head: [tableColumns],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9
    }
  });
  
  yPos = doc.lastAutoTable.finalY + 10;
  
  // Summary
  doc.setFont('helvetica', 'bold');
  doc.text('Summary:', 20, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Items: ${order.total_items}`, 20, yPos);
  yPos += 5;
  doc.text(`Total Quantity: ${order.total_quantity}`, 20, yPos);
  
  if (showPrices) {
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Value: ₹${order.total_value?.toFixed(2)}`, 20, yPos);
  }
  
  // Notes
  if (order.notes) {
    yPos += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 20, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(order.notes, 170);
    doc.text(splitNotes, 20, yPos);
    yPos += splitNotes.length * 5;
  }
  
  // Rejection Reason
  if (order.rejection_reason) {
    yPos += 10;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(244, 67, 54);
    doc.text('Rejection Reason:', 20, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    const splitReason = doc.splitTextToSize(order.rejection_reason, 170);
    doc.text(splitReason, 20, yPos);
    doc.setTextColor(0, 0, 0);
  }
  
  // QR Code
  try {
    const qrData = JSON.stringify({
      order_number: order.order_number,
      order_id: order.id,
      status: order.status
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);
    doc.addImage(qrCodeDataUrl, 'PNG', 160, yPos + 10, 30, 30);
  } catch (error) {
    console.error('Error generating QR code:', error);
  }
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
    
    if (!showPrices) {
      doc.setTextColor(150, 150, 150);
      doc.text('Employee Copy - Prices Hidden', 105, 285, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }
  }
  
  // Save PDF
  const fileName = `stock-order-${order.order_number}-${showPrices ? 'admin' : 'employee'}.pdf`;
  doc.save(fileName);
};

export const generateSalarySlipPDF = async (salaryLog, employee) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('CollegeCart', 105, 15, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Salary Slip', 105, 25, { align: 'center' });
  
  // Month/Year
  const salaryMonth = new Date(salaryLog.salary_month);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `For the month of ${salaryMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    105,
    35,
    { align: 'center' }
  );
  
  // Employee Details
  let yPos = 50;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Details:', 20, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${employee.full_name}`, 20, yPos);
  yPos += 5;
  doc.text(`Employee Code: ${employee.employee_code}`, 20, yPos);
  yPos += 5;
  doc.text(`Department: ${employee.department?.department_name || 'N/A'}`, 20, yPos);
  yPos += 5;
  doc.text(`Role: ${employee.role?.role_name || 'N/A'}`, 20, yPos);
  yPos += 10;
  
  // Earnings
  doc.setFont('helvetica', 'bold');
  doc.text('Earnings:', 20, yPos);
  yPos += 7;
  
  const earnings = [
    ['Base Salary', `₹${salaryLog.base_salary?.toFixed(2)}`],
    ['HRA', `₹${salaryLog.hra?.toFixed(2)}`],
    ['Allowances', `₹${salaryLog.allowances?.toFixed(2)}`],
    ['Bonus', `₹${salaryLog.bonus?.toFixed(2)}`],
    ['Incentives', `₹${salaryLog.incentives?.toFixed(2)}`],
    ['Overtime Pay', `₹${salaryLog.overtime_pay?.toFixed(2)}`]
  ];
  
  doc.autoTable({
    startY: yPos,
    head: [['Description', 'Amount']],
    body: earnings,
    theme: 'plain',
    styles: {
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 60, halign: 'right' }
    }
  });
  
  yPos = doc.lastAutoTable.finalY + 5;
  
  // Gross Salary
  const grossSalary = 
    parseFloat(salaryLog.base_salary || 0) +
    parseFloat(salaryLog.hra || 0) +
    parseFloat(salaryLog.allowances || 0) +
    parseFloat(salaryLog.bonus || 0) +
    parseFloat(salaryLog.incentives || 0) +
    parseFloat(salaryLog.overtime_pay || 0);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Gross Salary:', 20, yPos);
  doc.text(`₹${grossSalary.toFixed(2)}`, 180, yPos, { align: 'right' });
  yPos += 10;
  
  // Deductions
  doc.text('Deductions:', 20, yPos);
  yPos += 7;
  
  const deductions = [
    ['Deductions', `₹${salaryLog.deductions?.toFixed(2)}`]
  ];
  
  doc.autoTable({
    startY: yPos,
    head: [['Description', 'Amount']],
    body: deductions,
    theme: 'plain',
    styles: {
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 60, halign: 'right' }
    }
  });
  
  yPos = doc.lastAutoTable.finalY + 5;
  
  // Net Salary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(16, 185, 129);
  doc.rect(15, yPos - 5, 180, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('Net Salary:', 20, yPos);
  doc.text(`₹${salaryLog.total_salary?.toFixed(2)}`, 180, yPos, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPos += 15;
  
  // Attendance
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Attendance: ${salaryLog.attendance_days} / ${salaryLog.working_days} days`, 20, yPos);
  yPos += 10;
  
  // Payment Details
  if (salaryLog.paid_status === 'paid') {
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Details:', 20, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment Mode: ${salaryLog.payment_mode || 'N/A'}`, 20, yPos);
    yPos += 5;
    doc.text(`Payment Date: ${salaryLog.payment_date ? new Date(salaryLog.payment_date).toLocaleDateString() : 'N/A'}`, 20, yPos);
    yPos += 5;
    doc.text(`Reference: ${salaryLog.payment_reference || 'N/A'}`, 20, yPos);
  }
  
  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('This is a computer-generated document. No signature required.', 105, 280, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });
  
  // Save PDF
  const fileName = `salary-slip-${employee.employee_code}-${salaryMonth.getFullYear()}-${String(salaryMonth.getMonth() + 1).padStart(2, '0')}.pdf`;
  doc.save(fileName);
};

export const generateEmployeeIDCard = async (employee) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [85.6, 53.98] // Standard ID card size
  });
  
  // Background
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 85.6, 15, 'F');
  
  // Company Name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CollegeCart', 42.8, 8, { align: 'center' });
  doc.text('Employee ID Card', 42.8, 13, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  
  // Photo placeholder
  if (employee.photo) {
    try {
      doc.addImage(employee.photo, 'JPEG', 5, 18, 20, 25);
    } catch (error) {
      doc.rect(5, 18, 20, 25);
    }
  } else {
    doc.rect(5, 18, 20, 25);
  }
  
  // Employee Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(employee.full_name, 28, 22);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`ID: ${employee.employee_code}`, 28, 27);
  doc.text(`Role: ${employee.role?.role_name || 'N/A'}`, 28, 31);
  doc.text(`Dept: ${employee.department?.department_name || 'N/A'}`, 28, 35);
  doc.text(`Joined: ${new Date(employee.joining_date).toLocaleDateString()}`, 28, 39);
  
  // QR Code
  try {
    const qrData = JSON.stringify({
      employee_code: employee.employee_code,
      name: employee.full_name,
      role: employee.role?.role_name
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);
    doc.addImage(qrCodeDataUrl, 'PNG', 60, 18, 20, 20);
  } catch (error) {
    console.error('Error generating QR code:', error);
  }
  
  // Footer
  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.text('This card is property of CollegeCart. If found, please return.', 42.8, 48, { align: 'center' });
  
  // Save PDF
  const fileName = `employee-id-card-${employee.employee_code}.pdf`;
  doc.save(fileName);
};
