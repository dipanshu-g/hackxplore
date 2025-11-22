import { BaseScraper } from './base-scraper.ts'
import { ScrapedData, ScrapingConfig } from '../shared/types.ts'

export class DevfolioScraper extends BaseScraper {
  constructor(config: ScrapingConfig) {
    super('devfolio', config)
  }

  async scrape(maxPages: number = 10): Promise<ScrapedData[]> {
    const allData: ScrapedData[] = []

    try {
      await this.initialize()

      const baseUrl = this.config.endpoints?.base || 'https://devfolio.co'
      const listingsUrl = this.config.endpoints?.listings || `${baseUrl}/hacks`

      console.log(`Starting Devfolio scraping from: ${listingsUrl}`)

      const page = await this.createPage(listingsUrl)

      // Scroll and load infinite scroll content
      let previousHeight = 0
      let currentHeight = 0
      let scrollAttempts = 0
      const maxScrollAttempts = maxPages * 3 // More attempts for infinite scroll

      do {
        previousHeight = currentHeight
        currentHeight = await page.evaluate('document.body.scrollHeight')

        // Scroll to bottom
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')

        // Wait for content to load
        await this.delay(this.config.rate_limit.delay_between_requests)

        // Check for hackathon cards
        const newOpportunities = await this.extractOpportunitiesFromPage(page, baseUrl)
        allData.push(...newOpportunities)

        console.log(`Scroll attempt ${scrollAttempts + 1}: Found ${newOpportunities.length} opportunities, Total: ${allData.length}`)

        scrollAttempts++

        // Check if we've reached max scroll attempts or if no new content is loading
      } while (scrollAttempts < maxScrollAttempts && currentHeight > previousHeight)

      await page.close()

      // Validate and clean data
      const { valid, errors } = await this.validateData(allData)

      if (errors.length > 0) {
        console.warn(`Devfolio scraping completed with ${errors.length} validation errors`)
        errors.forEach(error => console.warn(`Error: ${error.error}`))
      }

      console.log(`Devfolio scraping completed. Valid opportunities: ${valid.length}`)

      return valid

    } catch (error) {
      console.error('Error during Devfolio scraping:', error)
      throw new Error(`Devfolio scraping failed: ${error.message}`)
    } finally {
      await this.close()
    }
  }

  private async extractOpportunitiesFromPage(page: any, baseUrl: string): Promise<ScrapedData[]> {
    return await page.evaluate((config) => {
      const opportunities: any[] = []

      // Find hackathon cards - Devfolio uses various class names
      const cardSelectors = [
        '[class*="hackathon"]',
        '[class*="event"]',
        '[class*="card"]',
        'a[href*="/hacks/"]',
        'a[href*="/hack/"]'
      ]

      let cards: Element[] = []

      // Try different selectors to find hackathon cards
      for (const selector of cardSelectors) {
        const elements = document.querySelectorAll(selector)
        if (elements.length > 0) {
          cards = Array.from(elements)
          break
        }
      }

      // Filter to only include cards that link to hackathons
      cards = cards.filter(card => {
        const link = card.querySelector('a') || (card.tagName === 'A' ? card : null)
        return link && link.getAttribute('href') && (
          link.getAttribute('href')!.includes('/hacks/') ||
          link.getAttribute('href')!.includes('/hack/') ||
          link.textContent!.toLowerCase().includes('hack')
        )
      })

      for (const card of cards) {
        try {
          const link = card.querySelector('a') || (card.tagName === 'A' ? card : null)
          if (!link) continue

          const relativeUrl = link.getAttribute('href')
          if (!relativeUrl) continue

          const url = relativeUrl.startsWith('http') ? relativeUrl : `https://devfolio.co${relativeUrl}`

          // Extract title
          const titleElement = card.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]')
          let title = titleElement?.textContent?.trim() || link.textContent?.trim() || ''

          // Clean title - remove common suffixes
          title = title.replace(/\s*-\s*Devfolio.*$/i, '').trim()

          if (!title || title.length < 3) continue

          // Extract description
          const descriptionElement = card.querySelector('[class*="description"], [class*="about"], p')
          let description = descriptionElement?.textContent?.trim() || ''

          if (description && description.length > 200) {
            description = description.substring(0, 200) + '...'
          }

          // Extract deadline
          let deadline: string | undefined
          const deadlineSelectors = ['[class*="deadline"]', '[class*="end"]', '[class*="close"]', '[datetime]']

          for (const selector of deadlineSelectors) {
            const element = card.querySelector(selector)
            if (element) {
              const text = element.textContent?.trim() || element.getAttribute('datetime') || ''
              if (text) {
                // Try to parse common date formats
                const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\w+\s+\d{1,2},?\s+\d{4})/)
                if (dateMatch) {
                  deadline = new Date(dateMatch[0]).toISOString()
                  break
                }
              }
            }
          }

          // Extract prize pool
          let prizePool: number | undefined
          const prizeSelectors = ['[class*="prize"]', '[class*="reward"]', '[class*="amount"]']

          for (const selector of prizeSelectors) {
            const element = card.querySelector(selector)
            if (element) {
              const text = element.textContent || ''
              const prizeMatch = text.match(/[\$₹€£¥]?([\d,]+(?:\.\d+)?)/g)
              if (prizeMatch) {
                // Take the largest amount found
                const amounts = prizeMatch.map(p => parseFloat(p.replace(/[^\d.]/g, ''))).filter(n => n > 0)
                if (amounts.length > 0) {
                  prizePool = Math.max(...amounts)
                  break
                }
              }
            }
          }

          // Extract mode (online/offline)
          let mode: string | undefined
          const modeSelectors = ['[class*="mode"]', '[class*="format"]', '[class*="location"]']

          for (const selector of modeSelectors) {
            const element = card.querySelector(selector)
            if (element) {
              const text = element.textContent?.toLowerCase() || ''
              if (text.includes('online') || text.includes('remote')) {
                mode = 'online'
                break
              } else if (text.includes('offline') || text.includes('in-person')) {
                mode = 'offline'
                break
              } else if (text.includes('hybrid')) {
                mode = 'hybrid'
                break
              }
            }
          }

          // Extract location if available
          let location: { city?: string; country?: string; remote?: boolean } | undefined
          const locationElement = card.querySelector('[class*="location"], [class*="venue"]')
          if (locationElement) {
            const locationText = locationElement.textContent?.trim()
            if (locationText) {
              location = {
                city: locationText,
                country: 'India', // Devfolio is primarily India-focused
                remote: mode === 'online'
              }
            }
          }

          // Extract tags/technologies
          const tagElements = card.querySelectorAll('[class*="tag"], [class*="tech"], [class*="skill"]')
          const tags = Array.from(tagElements)
            .map(tag => tag.textContent?.trim().toLowerCase())
            .filter(tag => tag && tag.length > 0 && tag.length < 30)

          // Extract participants if available
          let participantsCount: number | undefined
          const participantsElement = card.querySelector('[class*="participant"], [class*registered]')
          if (participantsElement) {
            const text = participantsElement.textContent || ''
            const match = text.match(/(\d+)/)
            if (match) {
              participantsCount = parseInt(match[1])
            }
          }

          // Only include opportunities with future deadlines (if deadline is available)
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
            location,
            prize_pool: prizePool,
            participants_count: participantsCount,
            // Default values for required fields
            type: 'hackathon' as const,
            benefits: [],
            requirements: []
          }

          opportunities.push(opportunity)

        } catch (error) {
          console.warn('Error processing card:', error)
          continue
        }
      }

      return opportunities
    }, this.config)
  }
}