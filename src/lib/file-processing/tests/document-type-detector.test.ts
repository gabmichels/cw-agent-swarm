/**
 * Tests for the DocumentTypeDetector service
 */

import { describe, it, expect } from 'vitest';
import { DocumentTypeDetector, DocumentType } from '../services/document-type-detector';

describe('DocumentTypeDetector', () => {
  const detector = new DocumentTypeDetector();
  
  describe('File extension detection', () => {
    it('should detect document types based on file extension', () => {
      // Documents
      expect(detector.detectDocumentType('', 'sample.pdf')).toBe(DocumentType.DOCUMENT);
      expect(detector.detectDocumentType('', 'sample.doc')).toBe(DocumentType.DOCUMENT);
      expect(detector.detectDocumentType('', 'sample.docx')).toBe(DocumentType.DOCUMENT);
      expect(detector.detectDocumentType('', 'sample.txt')).toBe(DocumentType.DOCUMENT);
      
      // Spreadsheets
      expect(detector.detectDocumentType('', 'sample.xlsx')).toBe(DocumentType.SPREADSHEET);
      expect(detector.detectDocumentType('', 'sample.csv')).toBe(DocumentType.SPREADSHEET);
      
      // Presentations
      expect(detector.detectDocumentType('', 'sample.pptx')).toBe(DocumentType.PRESENTATION);
      
      // Images
      expect(detector.detectDocumentType('', 'sample.jpg')).toBe(DocumentType.IMAGE);
      expect(detector.detectDocumentType('', 'sample.png')).toBe(DocumentType.IMAGE);
      
      // Code
      expect(detector.detectDocumentType('', 'sample.js')).toBe(DocumentType.CODE);
      expect(detector.detectDocumentType('', 'sample.py')).toBe(DocumentType.CODE);
      expect(detector.detectDocumentType('', 'sample.json')).toBe(DocumentType.CODE);
      
      // Email
      expect(detector.detectDocumentType('', 'sample.eml')).toBe(DocumentType.EMAIL);
    });
    
    it('should return unknown for unrecognized extensions', () => {
      expect(detector.detectDocumentType('', 'sample.xyz')).toBe(DocumentType.UNKNOWN);
      expect(detector.detectDocumentType('', 'sample')).toBe(DocumentType.UNKNOWN);
    });
    
    it('should handle uppercase and mixed case extensions', () => {
      expect(detector.detectDocumentType('', 'sample.PDF')).toBe(DocumentType.DOCUMENT);
      expect(detector.detectDocumentType('', 'sample.Docx')).toBe(DocumentType.DOCUMENT);
      expect(detector.detectDocumentType('', 'sample.JPG')).toBe(DocumentType.IMAGE);
    });
  });
  
  describe('Content-based detection', () => {
    it('should detect invoices based on content', () => {
      const invoiceContent = 'INVOICE #12345\nPayment due: 30 days\nTotal amount: $1000.00';
      expect(detector.detectDocumentType(invoiceContent, 'document.txt')).toBe(DocumentType.INVOICE);
    });
    
    it('should detect reports based on content', () => {
      const reportContent = 'QUARTERLY REPORT\nExecutive Summary\nFindings and Analysis\nConclusion';
      expect(detector.detectDocumentType(reportContent, 'document.txt')).toBe(DocumentType.REPORT);
    });
    
    it('should detect contracts based on content', () => {
      const contractContent = 'SERVICE AGREEMENT\nThe parties agree to the following terms and conditions...\nIN WITNESS WHEREOF, the parties have signed this agreement.';
      expect(detector.detectDocumentType(contractContent, 'document.txt')).toBe(DocumentType.CONTRACT);
    });
    
    it('should detect research papers based on content', () => {
      const researchContent = 'ABSTRACT\nThis research study explores...\nMETHODOLOGY\nRESULTS\nDISCUSSION';
      expect(detector.detectDocumentType(researchContent, 'document.txt')).toBe(DocumentType.RESEARCH);
    });
    
    it('should detect resumes based on content', () => {
      const resumeContent = 'RESUME\nJohn Doe\nSKILLS\nEXPERIENCE\nEDUCATION\nREFERENCES';
      expect(detector.detectDocumentType(resumeContent, 'document.txt')).toBe(DocumentType.RESUME);
    });
    
    it('should detect code files based on content', () => {
      const codeContent = 'function calculateTotal() {\n  let total = 0;\n  console.log("Calculating total");\n  return total;\n}';
      expect(detector.detectDocumentType(codeContent, 'document.txt')).toBe(DocumentType.CODE);
    });
    
    it('should detect emails based on content', () => {
      const emailContent = 'From: sender@example.com\nTo: recipient@example.com\nSubject: Test Email\n\nThis is a test email.';
      expect(detector.detectDocumentType(emailContent, 'document.txt')).toBe(DocumentType.EMAIL);
    });
  });
  
  describe('Metadata-based detection', () => {
    it('should detect document types from PDF metadata', () => {
      // Invoice metadata
      const invoiceMetadata = {
        Title: 'Invoice #12345',
        Subject: 'Monthly invoice',
        Producer: 'PDFGenerator'
      };
      expect(detector.detectDocumentType('', 'document.pdf', invoiceMetadata)).toBe(DocumentType.INVOICE);
      
      // Report metadata
      const reportMetadata = {
        Title: 'Quarterly Report',
        Subject: 'Analysis and findings',
        Producer: 'PDFGenerator'
      };
      expect(detector.detectDocumentType('', 'document.pdf', reportMetadata)).toBe(DocumentType.REPORT);
      
      // Contract metadata
      const contractMetadata = {
        Title: 'Service Agreement',
        Subject: 'Legal terms and conditions',
        Producer: 'PDFGenerator'
      };
      expect(detector.detectDocumentType('', 'document.pdf', contractMetadata)).toBe(DocumentType.CONTRACT);
    });
  });
  
  describe('Mixed detection scenarios', () => {
    it('should prioritize file type for images regardless of content', () => {
      const content = 'INVOICE #12345\nPayment due: 30 days\nTotal amount: $1000.00';
      expect(detector.detectDocumentType(content, 'invoice.jpg')).toBe(DocumentType.IMAGE);
    });
    
    it('should override extension-based detection with high confidence content detection', () => {
      // Strong invoice content should override txt extension
      const invoiceContent = 'INVOICE #12345\nPayment due: 30 days\nTotal amount: $1000.00\nInvoice number: INV-12345\nDue date: 2023-12-31';
      expect(detector.detectDocumentType(invoiceContent, 'document.txt')).toBe(DocumentType.INVOICE);
    });
    
    it('should default to extension-based detection for weak content matches', () => {
      // Weak invoice content (only one match) should not override document extension
      const weakInvoiceContent = 'This document has the word invoice in it once.';
      expect(detector.detectDocumentType(weakInvoiceContent, 'document.pdf')).toBe(DocumentType.DOCUMENT);
    });
  });
}); 