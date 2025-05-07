/**
 * Language Detector Service
 * 
 * Detects the language of text content.
 */

import { ILanguageDetector } from '../types';
import { AppError } from '../../../lib/errors/base';

/**
 * Error codes for language detection operations
 */
export enum LanguageDetectorErrorCode {
  INVALID_INPUT = 'LANGUAGE_DETECTOR_INVALID_INPUT',
  DETECTION_FAILED = 'LANGUAGE_DETECTOR_DETECTION_FAILED',
}

/**
 * Common language patterns for detection
 */
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  'english': [
    /\b(the|and|that|have|for|not|with|you|this|but|his|from|they|say|her|she|will|one|all|would|there|their|what|out|about|who|get|which|when|make|can|like|time|just|him|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|back|after|use|two|how|our|work|first|well|way|even|new|want|because|any|these|give|day|most|us)\b/gi
  ],
  'spanish': [
    /\b(el|la|de|que|y|a|en|un|ser|se|no|haber|por|con|su|para|como|estar|tener|le|lo|todo|pero|más|hacer|o|poder|decir|este|ir|otro|ese|si|me|ya|ver|porque|dar|cuando|él|muy|sin|vez|mucho|saber|qué|sobre|mi|alguno|mismo|yo|también|hasta)\b/gi
  ],
  'french': [
    /\b(le|la|de|et|à|un|être|ce|avoir|que|pour|dans|qui|pas|sur|je|tu|il|dire|ne|nous|vous|ils|elle|au|du|en|y|avec|tout|mais|ou|si|mon|son|me|lui|leur|des|se|par|plus|pouvoir|vouloir|même|prendre|autre|on|deux|comme|notre|bien|où|sans|fois|aussi|nom|devoir|ces|donner|jour|grand|encore)\b/gi
  ],
  'german': [
    /\b(der|die|und|in|den|von|zu|das|mit|sich|des|auf|für|ist|im|dem|nicht|ein|eine|als|auch|es|an|werden|aus|er|hat|daß|sie|nach|bei|um|am|einen|wie|über|so|zum)\b/gi
  ],
  'italian': [
    /\b(il|la|di|che|e|è|non|un|a|per|in|nel|su|con|mi|ti|si|lo|ho|hai|ha|sono|sei|siamo|siete|hanno|essere|avere|fare|questo|quello|molto|tutto|più|meno|ora|dopo|prima|quando|dove|come|perché|quindi|così|suo|mio|tuo|nostro|vostro)\b/gi
  ],
  'portuguese': [
    /\b(o|a|de|que|e|do|da|em|um|para|é|com|não|uma|os|no|se|na|por|mais|as|dos|como|mas|foi|ao|ele|das|tem|à|seu|sua|ou|ser|quando|muito|há|nos|já|está|eu|também|só|pelo|pela|até|isso|ela|entre|era|depois|sem|mesmo|aos|ter|seus|quem|nas|me|esse|eles|estão|você)\b/gi
  ],
  'dutch': [
    /\b(de|het|een|van|en|in|is|dat|op|te|voor|zijn|met|die|niet|aan|er|ook|als|bij|maar|nog|om|uit|ik|je|deze|dit|door|naar|heeft|over|tot|waar|moet|na|onder|kunnen|hun|mijn|dan|zo|zou|of|wat|werden|wij|worden|geen|werd|heb|veel)\b/gi
  ],
  'chinese': [
    /[\\u4e00-\\u9fff]+/g
  ],
  'japanese': [
    /[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff66-\\uff9f]+/g
  ],
  'russian': [
    /[\\u0400-\\u04FF]+/g
  ],
  'arabic': [
    /[\\u0600-\\u06FF]+/g
  ],
  'hindi': [
    /[\\u0900-\\u097F]+/g
  ],
  'korean': [
    /[\\uAC00-\\uD7AF\\u1100-\\u11FF\\u3130-\\u318F\\uA960-\\uA97F\\uD7B0-\\uD7FF]+/g
  ]
};

/**
 * Implementation of the ILanguageDetector interface
 */
export class LanguageDetector implements ILanguageDetector {
  /**
   * Detect the language of the text
   * 
   * @param text The text to analyze
   * @returns The detected language code
   * @throws AppError if detection fails
   */
  detectLanguage(text: string): string {
    // Validate input
    if (!text || typeof text !== 'string') {
      throw new AppError(
        'Invalid text input for language detection',
        LanguageDetectorErrorCode.INVALID_INPUT,
        { providedText: text ? `${text.substring(0, 20)}...` : text }
      );
    }
    
    // Use only a sample of text for efficiency
    const textSample = text.substring(0, 2000);
    
    try {
      // Calculate scores for each language
      const languageScores: Record<string, number> = {};
      
      for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
        let score = 0;
        
        for (const pattern of patterns) {
          // Using match instead of matchAll to fix TypeScript compatibility
          const matches = textSample.match(pattern) || [];
          score += matches.length;
        }
        
        languageScores[language] = score;
      }
      
      // Find the language with the highest score
      let highestScore = 0;
      let detectedLanguage = 'unknown';
      
      for (const [language, score] of Object.entries(languageScores)) {
        if (score > highestScore) {
          highestScore = score;
          detectedLanguage = language;
        }
      }
      
      // Require a minimum confidence threshold
      if (highestScore < 3) {
        return 'unknown';
      }
      
      return detectedLanguage;
    } catch (error) {
      throw new AppError(
        `Failed to detect language: ${error instanceof Error ? error.message : String(error)}`,
        LanguageDetectorErrorCode.DETECTION_FAILED,
        { textSampleLength: textSample.length }
      );
    }
  }
}

/**
 * Enhanced language detector with more sophisticated detection algorithms
 */
export class EnhancedLanguageDetector implements ILanguageDetector {
  /**
   * N-gram model for language detection
   */
  private readonly ngramModel: Record<string, Record<string, number>> = {
    'english': {
      'the': 100, 'and': 95, 'ing': 80, 'tion': 75, 'ed': 70, 'er': 65, 
      'ent': 60, 'on': 55, 'is': 50, 'it': 45, 'at': 40, 're': 35
    },
    'spanish': {
      'de': 100, 'la': 95, 'el': 90, 'en': 85, 'que': 80, 'es': 75, 
      'os': 70, 'as': 65, 'ión': 60, 'ar': 55, 'do': 50, 'co': 45
    },
    'french': {
      'le': 100, 'de': 95, 'es': 90, 'ent': 85, 'la': 80, 'on': 75, 
      'et': 70, 'en': 65, 'ait': 60, 'que': 55, 'ant': 50, 're': 45
    },
    'german': {
      'der': 100, 'die': 95, 'und': 90, 'den': 85, 'ein': 80, 'ich': 75, 
      'sch': 70, 'ung': 65, 'en': 60, 'zu': 55, 'cht': 50, 'ber': 45
    }
  };
  
  /**
   * Detect the language of the text using multiple methods
   * 
   * @param text The text to analyze
   * @returns The detected language code
   */
  detectLanguage(text: string): string {
    // First try the basic detection method
    const basicDetector = new LanguageDetector();
    const basicResult = basicDetector.detectLanguage(text);
    
    // If the basic detector gives a confident result, use it
    if (basicResult !== 'unknown') {
      return basicResult;
    }
    
    // Otherwise, use n-gram analysis for supported languages
    const textSample = text.substring(0, 3000).toLowerCase();
    const scores: Record<string, number> = {};
    
    // Calculate n-gram scores for each language
    for (const [language, ngrams] of Object.entries(this.ngramModel)) {
      let score = 0;
      
      for (const [ngram, weight] of Object.entries(ngrams)) {
        const regex = new RegExp(ngram, 'g');
        const matches = (textSample.match(regex) || []).length;
        score += matches * weight;
      }
      
      scores[language] = score;
    }
    
    // Find the language with the highest score
    let highestScore = 0;
    let detectedLanguage = 'unknown';
    
    for (const [language, score] of Object.entries(scores)) {
      if (score > highestScore) {
        highestScore = score;
        detectedLanguage = language;
      }
    }
    
    return detectedLanguage;
  }
} 