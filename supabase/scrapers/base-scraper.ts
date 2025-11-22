import { PuppeteerNode, launch } from 'https://deno.land/x/puppeteer@16.2.0/mod.ts'
import { PlatformName, ScrapedData, ScrapingConfig, ScrapingError } from '../shared/types.ts'
import { DataValidator } from '../shared/validation.ts'

export abstract class BaseScraper {
  protected browser: PuppeteerNode | null = null
  protected config: ScrapingConfig
  protected platformName: PlatformName
  protected userAgent = 'HackXplore-Bot/1.0 (+https://hackxplore.com)'

  constructor(platformName: PlatformName, config: ScrapingConfig) {
    this.platformName = platformName
    this.config = config
  }

  async initialize(): Promise<void> {
    try {
      this.browser = await launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      })
    } catch (error) {
      console.error(`Failed to initialize browser for ${this.platformName}:`, error)
      throw new Error(`Browser initialization failed: ${error.message}`)
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  abstract scrape(maxPages: number = 10): Promise<ScrapedData[]>

  protected async createPage(url?: string) {
    if (!this.browser) {
      throw new Error('Browser not initialized')
    }

    const page = await this.browser.newPage()

    // Set user agent and other headers
    await page.setUserAgent(this.userAgent)

    if (this.config.headers) {
      await page.setExtraHTTPHeaders(this.config.headers)
    }

    // Set viewport
    await page.setViewport({ width: 1366, height: 768 })

    // Block unnecessary resources for faster scraping
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const resourceType = req.resourceType()
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort()
      } else {
        req.continue()
      }
    })

    if (url) {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      })
    }

    return page
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  protected async extractTextContent(element: Element | null, selector: string): Promise<string> {
    if (!element) return ''

    const foundElement = element.querySelector(selector)
    return foundElement?.textContent?.trim() || ''
  }

  protected async extractAttribute(element: Element | null, selector: string, attribute: string): Promise<string> {
    if (!element) return ''

    const foundElement = element.querySelector(selector) as any
    return foundElement?.getAttribute(attribute) || ''
  }

  protected async extractMultipleTexts(element: Element | null, selector: string): Promise<string[]> {
    if (!element) return []

    const elements = element.querySelectorAll(selector)
    return Array.from(elements).map(el => el.textContent?.trim() || '').filter(text => text.length > 0)
  }

  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .trim()
  }

  protected extractDeadline(text: string): Date | null {
    // Common deadline patterns
    const patterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, // YYYY/MM/DD
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
      /(\d{1,2})\s+(\w+)\s+(\d{4})/, // DD Month YYYY
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        try {
          const date = new Date(match[0])
          if (!isNaN(date.getTime())) {
            return date
          }
        } catch {
          continue
        }
      }
    }

    return null
  }

  protected extractPrizePool(text: string): number | null {
    // Extract prize pool amounts
    const patterns = [
      /\$([\d,]+(?:\.\d+)?)/, // $10,000
      /₹([\d,]+(?:\.\d+)?)/, // ₹10,000
      /([\d,]+(?:\.\d+)?)\s*(?:USD|dollars?)/i,
      /prize.*?([\d,]+(?:\.\d+)?)/i,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        try {
          const amount = parseFloat(match[1].replace(/,/g, ''))
          if (!isNaN(amount)) {
            return amount
          }
        } catch {
          continue
        }
      }
    }

    return null
  }

  protected extractParticipants(text: string): number | null {
    const patterns = [
      /(\d+)\s*(?:participants?|registrations?|people?)/i,
      /(\d+)\s*(?:have\s+)?(?:registered|joined|participated)/i,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        try {
          const count = parseInt(match[1])
          if (!isNaN(count)) {
            return count
          }
        } catch {
          continue
        }
      }
    }

    return null
  }

  protected async validateData(data: ScrapedData[]): Promise<{ valid: ScrapedData[], errors: ScrapingError[] }> {
    const valid: ScrapedData[] = []
    const errors: ScrapingError[] = []

    for (const item of data) {
      try {
        const validationErrors = DataValidator.validateOpportunity(item)

        if (validationErrors.length === 0) {
          const normalized = DataValidator.normalizeOpportunity(item)
          valid.push(normalized)
        } else {
          errors.push({
            platform: this.platformName,
            error: `Validation failed: ${validationErrors.map(e => e.message).join(', ')}`,
            details: validationErrors,
            timestamp: new Date().toISOString()
          })
        }
      } catch (error) {
        errors.push({
          platform: this.platformName,
          error: `Data validation error: ${error.message}`,
          details: { data: item },
          timestamp: new Date().toISOString()
        })
      }
    }

    return { valid, errors }
  }

  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        if (attempt === maxRetries) {
          break
        }

        // Exponential backoff
        const backoffDelay = delayMs * Math.pow(2, attempt - 1)
        await this.delay(backoffDelay)

        console.warn(`Retry ${attempt}/${maxRetries} for ${this.platformName}: ${error.message}`)
      }
    }

    throw lastError
  }

  protected sanitizeUrl(url: string, baseUrl: string): string {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }

      if (url.startsWith('/')) {
        return new URL(url, baseUrl).toString()
      }

      return new URL(url, baseUrl).toString()
    } catch {
      return url // Return as-is if invalid (validation will catch it)
    }
  }
}