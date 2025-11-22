import { BaseScraper } from './base-scraper.ts'
import { ScrapedData, ScrapingConfig } from '../shared/types.ts'

export class DoraHacksScraper extends BaseScraper {
  constructor(config: ScrapingConfig) {
    super('dorahacks', config)
  }

  async scrape(maxPages: number = 10): Promise<ScrapedData[]> {
    const allData: ScrapedData[] = []

    try {
      await this.initialize()

      const baseUrl = this.config.endpoints?.base || 'https://dorahacks.io'
      const hackathonsUrl = `${baseUrl}/hackathons`

      console.log(`Starting DoraHacks scraping from: ${hackathonsUrl}`)

      const page = await this.createPage(hackathonsUrl)

      // DoraHacks often has better structured API-like content
      await this.delay(3000)

      const pageOpportunities = await this.extractOpportunitiesFromPage(page, baseUrl)
      allData.push(...pageOpportunities)

      await page.close()

      const { valid, errors } = await this.validateData(allData)

      if (errors.length > 0) {
        console.warn(`DoraHacks scraping completed with ${errors.length} validation errors`)
      }

      console.log(`DoraHacks scraping completed. Valid opportunities: ${valid.length}`)
      return valid

    } catch (error) {
      console.error('Error during DoraHacks scraping:', error)
      throw new Error(`DoraHacks scraping failed: ${error.message}`)
    } finally {
      await this.close()
    }
  }

  private async extractOpportunitiesFromPage(page: any, baseUrl: string): Promise<ScrapedData[]> {
    return await page.evaluate((config) => {
      const opportunities: any[] = []

      const selectors = [
        '.hackathon-item',
        '.bounty-item',
        '[class*="hackathon"]',
        'a[href*="/hackathon/"]',
        'a[href*="/bounty/"]'
      ]

      let cards: Element[] = []
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector)
        if (elements.length > 0) {
          cards = Array.from(elements)
          break
        }
      }

      for (const card of cards) {
        try {
          const link = card.querySelector('a') || (card.tagName === 'A' ? card : null)
          if (!link) continue

          const url = link.getAttribute('href') || ''
          if (!url) continue

          const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`

          const titleElement = card.querySelector('h1, h2, h3, [class*="title"]')
          let title = titleElement?.textContent?.trim() || ''

          if (!title || title.length < 3) continue

          const descriptionElement = card.querySelector('[class*="description"], p')
          let description = descriptionElement?.textContent?.trim() || ''

          // Extract deadline and prize similar to other scrapers
          let deadline: string | undefined
          let prizePool: number | undefined

          const deadlineElement = card.querySelector('[class*="deadline"], [datetime]')
          if (deadlineElement) {
            const text = deadlineElement.textContent?.trim() || deadlineElement.getAttribute('datetime') || ''
            const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/)
            if (dateMatch) deadline = new Date(dateMatch[0]).toISOString()
          }

          const prizeElement = card.querySelector('[class*="prize"], [class*="reward"], [class*="amount"]')
          if (prizeElement) {
            const text = prizeElement.textContent || ''
            const match = text.match(/[\$₹€£¥]?([\d,]+(?:\.\d+)?)/)
            if (match) prizePool = parseFloat(match[1].replace(/,/g, ''))
          }

          const opportunity: ScrapedData = {
            title,
            description,
            url: fullUrl,
            deadline,
            prize_pool: prizePool,
            type: 'hackathon',
            benefits: [],
            requirements: []
          }

          opportunities.push(opportunity)

        } catch (error) {
          continue
        }
      }

      return opportunities
    }, this.config)
  }
}

export class Hack2SkillScraper extends BaseScraper {
  constructor(config: ScrapingConfig) {
    super('hack2skill', config)
  }

  async scrape(maxPages: number = 10): Promise<ScrapedData[]> {
    const allData: ScrapedData[] = []

    try {
      await this.initialize()

      const baseUrl = this.config.endpoints?.base || 'https://www.hack2skill.com'
      const hackathonsUrl = `${baseUrl}/hackathons`

      const page = await this.createPage(hackathonsUrl)
      await this.delay(3000)

      const pageOpportunities = await this.extractOpportunitiesFromPage(page, baseUrl)
      allData.push(...pageOpportunities)

      await page.close()

      const { valid, errors } = await this.validateData(allData)
      console.log(`Hack2Skill scraping completed. Valid opportunities: ${valid.length}`)

      return valid

    } catch (error) {
      console.error('Error during Hack2Skill scraping:', error)
      throw new Error(`Hack2Skill scraping failed: ${error.message}`)
    } finally {
      await this.close()
    }
  }

  private async extractOpportunitiesFromPage(page: any, baseUrl: string): Promise<ScrapedData[]> {
    return await page.evaluate(() => {
      const opportunities: any[] = []

      const cards = document.querySelectorAll('.event-card, .hackathon-card, [class*="event"]')

      for (const card of cards) {
        try {
          const link = card.querySelector('a')
          if (!link) continue

          const url = link.getAttribute('href') || ''
          if (!url.includes('hackathon') && !url.includes('event')) continue

          const titleElement = card.querySelector('h1, h2, h3, [class*="title"]')
          const title = titleElement?.textContent?.trim() || ''

          if (!title || title.length < 3) continue

          const descriptionElement = card.querySelector('[class*="description"], p')
          const description = descriptionElement?.textContent?.trim() || ''

          let deadline: string | undefined
          let prizePool: number | undefined

          const deadlineElement = card.querySelector('[class*="deadline"], [class*="date"]')
          if (deadlineElement) {
            const text = deadlineElement.textContent?.trim() || ''
            const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/)
            if (dateMatch) deadline = new Date(dateMatch[0]).toISOString()
          }

          const prizeElement = card.querySelector('[class*="prize"], [class*="money"]')
          if (prizeElement) {
            const text = prizeElement.textContent || ''
            const match = text.match(/([\d,]+(?:\.\d+)?)/)
            if (match) prizePool = parseFloat(match[1].replace(/,/g, ''))
          }

          opportunities.push({
            title,
            description,
            url: url.startsWith('http') ? url : `https://www.hack2skill.com${url}`,
            deadline,
            prize_pool: prizePool,
            type: 'hackathon',
            benefits: [],
            requirements: []
          })

        } catch (error) {
          continue
        }
      }

      return opportunities
    })
  }
}

export class DevpostScraper extends BaseScraper {
  constructor(config: ScrapingConfig) {
    super('devpost', config)
  }

  async scrape(maxPages: number = 10): Promise<ScrapedData[]> {
    const allData: ScrapedData[] = []

    try {
      await this.initialize()

      const baseUrl = this.config.endpoints?.base || 'https://devpost.com'
      const hackathonsUrl = `${baseUrl}/hackathons`

      const page = await this.createPage(hackathonsUrl)
      await this.delay(3000)

      const pageOpportunities = await this.extractOpportunitiesFromPage(page, baseUrl)
      allData.push(...pageOpportunities)

      await page.close()

      const { valid, errors } = await this.validateData(allData)
      console.log(`Devpost scraping completed. Valid opportunities: ${valid.length}`)

      return valid

    } catch (error) {
      console.error('Error during Devpost scraping:', error)
      throw new Error(`Devpost scraping failed: ${error.message}`)
    } finally {
      await this.close()
    }
  }

  private async extractOpportunitiesFromPage(page: any, baseUrl: string): Promise<ScrapedData[]> {
    return await page.evaluate(() => {
      const opportunities: any[] = []

      const cards = document.querySelectorAll('.challenge-list-item, .hackathon-item, [class*="challenge"]')

      for (const card of cards) {
        try {
          const link = card.querySelector('a[href*="/hackathons/"]')
          if (!link) continue

          const url = link.getAttribute('href') || ''
          const title = link.textContent?.trim() || ''

          if (!title || title.length < 3) continue

          const descriptionElement = card.querySelector('.challenge-details, .description')
          const description = descriptionElement?.textContent?.trim() || ''

          let deadline: string | undefined
          let prizePool: number | undefined

          const deadlineElement = card.querySelector('.submission-period, .deadline')
          if (deadlineElement) {
            const text = deadlineElement.textContent?.trim() || ''
            const dateMatch = text.match(/(\w+\s+\d{1,2},?\s+\d{4})/)
            if (dateMatch) deadline = new Date(dateMatch[0]).toISOString()
          }

          const prizeElement = card.querySelector('.prize, .cash-prize')
          if (prizeElement) {
            const text = prizeElement.textContent || ''
            const match = text.match(/\$?([\d,]+(?:\.\d+)?)/)
            if (match) prizePool = parseFloat(match[1].replace(/,/g, ''))
          }

          opportunities.push({
            title,
            description,
            url: url.startsWith('http') ? url : `https://devpost.com${url}`,
            deadline,
            prize_pool: prizePool,
            type: 'hackathon',
            benefits: [],
            requirements: []
          })

        } catch (error) {
          continue
        }
      }

      return opportunities
    })
  }
}

export class InternshalaScraper extends BaseScraper {
  constructor(config: ScrapingConfig) {
    super('internshala', config)
  }

  async scrape(maxPages: number = 10): Promise<ScrapedData[]> {
    const allData: ScrapedData[] = []

    try {
      await this.initialize()

      const baseUrl = this.config.endpoints?.base || 'https://internshala.com'
      const internshipsUrl = `${baseUrl}/internships`

      const page = await this.createPage(internshipsUrl)
      await this.delay(3000)

      const pageOpportunities = await this.extractOpportunitiesFromPage(page, baseUrl)
      allData.push(...pageOpportunities)

      await page.close()

      const { valid, errors } = await this.validateData(allData)
      console.log(`Internshala scraping completed. Valid opportunities: ${valid.length}`)

      return valid

    } catch (error) {
      console.error('Error during Internshala scraping:', error)
      throw new Error(`Internshala scraping failed: ${error.message}`)
    } finally {
      await this.close()
    }
  }

  private async extractOpportunitiesFromPage(page: any, baseUrl: string): Promise<ScrapedData[]> {
    return await page.evaluate(() => {
      const opportunities: any[] = []

      const cards = document.querySelectorAll('.internship_meta, .individual_internship, [class*="internship"]')

      for (const card of cards) {
        try {
          const link = card.querySelector('a[href*="/internship/"]')
          if (!link) continue

          const url = link.getAttribute('href') || ''
          const title = link.textContent?.trim() || ''

          if (!title || title.length < 3) continue

          const descriptionElement = card.querySelector('.job-internship, .profile')
          let description = descriptionElement?.textContent?.trim() || ''

          // Extract company name and add to description
          const companyElement = card.querySelector('.company_name, [class*="company"]')
          const company = companyElement?.textContent?.trim()
          if (company && !description.includes(company)) {
            description = `${company} - ${description}`
          }

          let deadline: string | undefined
          let stipendRange: string | undefined

          const deadlineElement = card.querySelector('.apply_by, [class*="deadline"]')
          if (deadlineElement) {
            const text = deadlineElement.textContent?.trim() || ''
            const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/)
            if (dateMatch) deadline = new Date(dateMatch[0]).toISOString()
          }

          const stipendElement = card.querySelector('.stipend, [class*="stipend"]')
          if (stipendElement) {
            stipendRange = stipendElement.textContent?.trim() || ''
          }

          opportunities.push({
            title,
            description,
            url: url.startsWith('http') ? url : `https://internshala.com${url}`,
            deadline,
            stipend_range: stipendRange,
            type: 'internship',
            benefits: [],
            requirements: []
          })

        } catch (error) {
          continue
        }
      }

      return opportunities
    })
  }
}