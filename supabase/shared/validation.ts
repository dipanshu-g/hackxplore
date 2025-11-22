import { ScrapedData, ValidationError } from './types.js';

export class DataValidator {
  private static readonly MAX_TITLE_LENGTH = 200;
  private static readonly MAX_DESCRIPTION_LENGTH = 2000;
  private static readonly MAX_TAGS_COUNT = 10;

  static validateOpportunity(data: ScrapedData): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate title
    if (!data.title || typeof data.title !== 'string') {
      errors.push({ field: 'title', message: 'Title is required and must be a string' });
    } else {
      const trimmedTitle = data.title.trim();
      if (!trimmedTitle) {
        errors.push({ field: 'title', message: 'Title cannot be empty' });
      } else if (trimmedTitle.length > this.MAX_TITLE_LENGTH) {
        errors.push({
          field: 'title',
          message: `Title must be ${this.MAX_TITLE_LENGTH} characters or less`,
          value: trimmedTitle.length
        });
      }
    }

    // Validate description
    if (data.description && typeof data.description === 'string') {
      const cleanedDescription = this.cleanHtml(data.description);
      if (cleanedDescription.length > this.MAX_DESCRIPTION_LENGTH) {
        errors.push({
          field: 'description',
          message: `Description must be ${this.MAX_DESCRIPTION_LENGTH} characters or less`,
          value: cleanedDescription.length
        });
      }
    }

    // Validate URL
    if (!data.url || typeof data.url !== 'string') {
      errors.push({ field: 'url', message: 'URL is required and must be a string' });
    } else {
      try {
        new URL(data.url);
      } catch {
        errors.push({
          field: 'url',
          message: 'URL must be a valid URL format',
          value: data.url
        });
      }
    }

    // Validate deadline
    if (data.deadline) {
      const deadlineDate = new Date(data.deadline);
      if (isNaN(deadlineDate.getTime())) {
        errors.push({
          field: 'deadline',
          message: 'Deadline must be a valid date',
          value: data.deadline
        });
      } else if (deadlineDate <= new Date()) {
        errors.push({
          field: 'deadline',
          message: 'Deadline must be in the future',
          value: data.deadline
        });
      }
    }

    // Validate dates
    ['start_date', 'end_date'].forEach(dateField => {
      const dateValue = data[dateField as keyof ScrapedData];
      if (dateValue) {
        const date = new Date(dateValue as string);
        if (isNaN(date.getTime())) {
          errors.push({
            field: dateField,
            message: `${dateField} must be a valid date`,
            value: dateValue
          });
        }
      }
    });

    // Validate prize pool
    if (data.prize_pool !== undefined) {
      if (typeof data.prize_pool !== 'number' || data.prize_pool < 0) {
        errors.push({
          field: 'prize_pool',
          message: 'Prize pool must be a positive number',
          value: data.prize_pool
        });
      }
    }

    // Validate participants count
    if (data.participants_count !== undefined) {
      if (typeof data.participants_count !== 'number' || data.participants_count < 0) {
        errors.push({
          field: 'participants_count',
          message: 'Participants count must be a positive number',
          value: data.participants_count
        });
      }
    }

    // Validate rating
    if (data.rating !== undefined) {
      if (typeof data.rating !== 'number' || data.rating < 0 || data.rating > 5) {
        errors.push({
          field: 'rating',
          message: 'Rating must be a number between 0 and 5',
          value: data.rating
        });
      }
    }

    // Validate tags
    if (data.tags && Array.isArray(data.tags)) {
      if (data.tags.length > this.MAX_TAGS_COUNT) {
        errors.push({
          field: 'tags',
          message: `Maximum ${this.MAX_TAGS_COUNT} tags allowed`,
          value: data.tags.length
        });
      }
    }

    return errors;
  }

  static normalizeOpportunity(data: ScrapedData): ScrapedData {
    const normalized: ScrapedData = { ...data };

    // Clean and normalize title
    if (normalized.title) {
      normalized.title = normalized.title.trim().replace(/\s+/g, ' ');
    }

    // Clean description (strip HTML)
    if (normalized.description) {
      normalized.description = this.cleanHtml(normalized.description);
    }

    // Ensure absolute URL
    if (normalized.url) {
      normalized.url = this.normalizeUrl(normalized.url);
    }

    // Normalize dates to ISO 8601 UTC
    ['deadline', 'start_date', 'end_date'].forEach(dateField => {
      const dateValue = normalized[dateField as keyof ScrapedData];
      if (dateValue) {
        const date = new Date(dateValue as string);
        if (!isNaN(date.getTime())) {
          (normalized as any)[dateField] = date.toISOString();
        }
      }
    });

    // Normalize tags
    if (normalized.tags && Array.isArray(normalized.tags)) {
      normalized.tags = [...new Set(
        normalized.tags
          .filter(tag => typeof tag === 'string')
          .map(tag => tag.toLowerCase().trim())
          .filter(tag => tag.length > 0)
      )];
    }

    // Normalize other array fields
    ['requirements', 'benefits'].forEach(arrayField => {
      const fieldValue = normalized[arrayField as keyof ScrapedData];
      if (fieldValue && Array.isArray(fieldValue)) {
        (normalized as any)[arrayField] = fieldValue
          .filter(item => typeof item === 'string')
          .map(item => item.trim())
          .filter(item => item.length > 0);
      }
    });

    return normalized;
  }

  private static cleanHtml(html: string): string {
    // Remove HTML tags and normalize whitespace
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.toString();
    } catch {
      // If URL is invalid, return as-is (validation will catch it)
      return url;
    }
  }

  static async convertCurrencyToUSD(amount: number, fromCurrency: string): Promise<number> {
    // Simple currency conversion (in production, use real exchange rate API)
    const exchangeRates: Record<string, number> = {
      'USD': 1,
      'EUR': 1.08,
      'GBP': 1.27,
      'INR': 0.012,  // 1 INR ≈ 0.012 USD
      'CAD': 0.74,
      'AUD': 0.66,
      'JPY': 0.0067
    };

    const rate = exchangeRates[fromCurrency.toUpperCase()];
    if (!rate) {
      console.warn(`Unknown currency: ${fromCurrency}, assuming USD`);
      return amount;
    }

    return amount * rate;
  }

  static parseStipendRange(stipendText: string): { min: number; max: number; currency: string } | null {
    if (!stipendText) return null;

    // Match patterns like "₹10,000-15,000/month", "$500-800/month", "5000 per month"
    const patterns = [
      /([$₹€£¥])?\s*([0-9,]+)\s*[-–]\s*([0-9,]+)\s*(?:\/\s*month|per\s*month)?/i,
      /([$₹€£¥])?\s*([0-9,]+)\s*(?:\/\s*month|per\s*month)/i
    ];

    const currencySymbols: Record<string, string> = {
      '$': 'USD',
      '₹': 'INR',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY',
      'C$': 'CAD',
      'A$': 'AUD'
    };

    for (const pattern of patterns) {
      const match = stipendText.match(pattern);
      if (match) {
        const currencyChar = match[1] || '$'; // Default to USD
        const min = parseInt(match[2].replace(/,/g, ''));
        const max = match[3] ? parseInt(match[3].replace(/,/g, '')) : min;
        const currency = currencySymbols[currencyChar] || 'USD';

        return { min, max, currency };
      }
    }

    return null;
  }
}