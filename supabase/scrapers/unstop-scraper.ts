import { BaseScraper } from './base-scraper.ts'
import { ScrapedData, ScrapingConfig } from '../shared/types.ts'

export class UnstopScraper extends BaseScraper {
  constructor(config: ScrapingConfig) {
    super('unstop', config)
  }

  async scrape(maxPages: number = 10): Promise<ScrapedData[]> {
    const allData: ScrapedData[] = []

    try {
      await this.initialize()

      const baseUrl = this.config.endpoints?.base || 'https://unstop.com'
      const hackathonsUrl = `${baseUrl}/hackathons`

      console.log(`Starting Unstop scraping from: ${hackathonsUrl}`)

      const page = await this.createPage(hackathonsUrl)

      // Handle pagination
      let currentPage = 1
      let hasMoreContent = true

      while (hasMoreContent && currentPage <= maxPages) {
        console.log(`Scraping Unstop page ${currentPage}`)

        // Wait for content to load
        await this.delay(2000)

        // Extract opportunities from current page
        const pageOpportunities = await this.extractOpportunitiesFromPage(page, baseUrl)
        allData.push(...pageOpportunities)

        console.log(`Found ${pageOpportunities.length} opportunities on page ${currentPage}`)

        // Try to find and click next page button
        if (currentPage < maxPages) {
          const hasNextPage = await page.evaluate(() => {
            const nextButton = document.querySelector('[class*="next"], [class*="next-page"], .pagination-next, a[aria-label="Next"]')
            if (nextButton && !(nextButton as HTMLElement).disabled) {
              (nextButton as HTMLElement).click()
              return true
            }
            return false
          })

          if (hasNextPage) {
            await this.delay(this.config.rate_limit.delay_between_requests)
            currentPage++
          } else {
            hasMoreContent = false
          }
        } else {
          hasMoreContent = false
        }
      }

      await page.close()

      // Validate and clean data
      const { valid, errors } = await this.validateData(allData)

      if (errors.length > 0) {
        console.warn(`Unstop scraping completed with ${errors.length} validation errors`)
        errors.forEach(error => console.warn(`Error: ${error.error}`))
      }

      console.log(`Unstop scraping completed. Valid opportunities: ${valid.length}`)

      return valid

    } catch (error) {
      console.error('Error during Unstop scraping:', error)
      throw new Error(`Unstop scraping failed: ${error.message}`)
    } finally {
      await this.close()
    }
  }

  private async extractOpportunitiesFromPage(page: any, baseUrl: string): Promise<ScrapedData[]> {
    return await page.evaluate((config) => {
      const opportunities: any[] = []

      // Unstop uses card-based layout
      const cardSelectors = [
        '[class*="challenge-card"]',
        '[class*="competition-card"]',
        '[class*="event-card"]',
        '.challenge-list .challenge-item',
        'a[href*="/competition/"]',
        'a[href*="/hackathon/"]'
      ]

      let cards: Element[] = []

      for (const selector of cardSelectors) {
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

          const relativeUrl = link.getAttribute('href')
          if (!relativeUrl) continue

          const url = relativeUrl.startsWith('http') ? relativeUrl : `${baseUrl}${relativeUrl}`

          // Extract title
          const titleSelectors = ['h1', 'h2', 'h3', '[class*="title"]', '[class*="name"]']
          let title = ''

          for (const selector of titleSelectors) {
            const element = card.querySelector(selector)
            if (element) {
              title = element.textContent?.trim() || ''
              if (title) break
            }
          }

          if (!title || title.length < 3) continue

          // Clean title
          title = title.replace(/\s*-\s*Unstop.*$/i, '').trim()

          // Extract description
          const descriptionElement = card.querySelector('[class*="description"], [class*="about"], p')
          let description = descriptionElement?.textContent?.trim() || ''

          if (description && description.length > 300) {
            description = description.substring(0, 300) + '...'
          }

          // Extract deadline
          let deadline: string | undefined
          const deadlineSelectors = [
            '[class*="deadline"]',
            '[class*="end-date"]',
            '[class*="last-date"]',
            '[datetime]'
          ]

          for (const selector of deadlineSelectors) {
            const element = card.querySelector(selector)
            if (element) {
              const text = element.textContent?.trim() || element.getAttribute('datetime') || ''
              if (text) {
                const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\w+\s+\d{1,2},?\s+\d{4})/)
                if (dateMatch) {
                  deadline = new Date(dateMatch[0]).toISOString()
                  break
                }
              }
            }
          }

          // Extract prize/reward
          let prizePool: number | undefined
          const prizeSelectors = [
            '[class*="prize"]',
            '[class*="reward"]',
            '[class*="amount"]',
            '[class*="money"]'
          ]

          for (const selector of prizeSelectors) {
            const element = card.querySelector(selector)
            if (element) {
              const text = element.textContent || ''
              const prizeMatch = text.match(/[\$₹€£¥₹]?([\d,]+(?:\.\d+)?)(?:k|k\s*USD|k\s*INR)?/gi)
              if (prizeMatch) {
                const amounts = prizeMatch.map(p => {
                  let amount = p.replace(/[^\d.]/g, '')
                  if (p.toLowerCase().includes('k')) {
                    amount = (parseFloat(amount) * 1000).toString()
                  }
                  return parseFloat(amount)
                }).filter(n => n > 0)
                if (amounts.length > 0) {
                  prizePool = Math.max(...amounts)
                  break
                }
              }
            }
          }

          // Extract mode
          let mode: string | undefined
          const modeElement = card.querySelector('[class*="mode"], [class*="format"]')
          if (modeElement) {
            const text = modeElement.textContent?.toLowerCase() || ''
            if (text.includes('online')) mode = 'online'
            else if (text.includes('offline') || text.includes('in-person')) mode = 'offline'
            else if (text.includes('hybrid')) mode = 'hybrid'
          }

          // Extract tags
          const tagElements = card.querySelectorAll('[class*="tag"], [class*="skill"], [class*="technology"]')
          const tags = Array.from(tagElements)
            .map(tag => tag.textContent?.trim().toLowerCase())
            .filter(tag => tag && tag.length > 0 && tag.length < 30)

          // Extract participants
          let participantsCount: number | undefined
          const participantsElement = card.querySelector('[class*="participant"], [class*="registered"], [class*="applications"]')
          if (participantsElement) {
            const text = participantsElement.textContent || ''
            const match = text.match(/(\d+(?:[,\s]\d+)*)/)
            if (match) {
              participantsCount = parseInt(match[1].replace(/,/g, ''))
            }
          }

          // Skip expired opportunities
          if (deadline && new Date(deadline) < new Date()) {
            continue
          }

          const opportunity: ScrapedData = {
            title,
            description,
            url,
            deadline,
            mode,
            tags: tags.length > 0 ? tags : undefined,
            prize_pool: prizePool,
            participants_count: participantsCount,
            type: 'hackathon',
            benefits: [],
            requirements: []
          }

          opportunities.push(opportunity)

        } catch (error) {
          console.warn('Error processing Unstop card:', error)
          continue
        }
      }

      return opportunities
    }, this.config)
  }
}