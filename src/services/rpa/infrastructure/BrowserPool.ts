import puppeteer, { Browser } from 'puppeteer';
import { BrowserConfig, Logger } from '../types/RPATypes';

export class BrowserPool {
  private browsers: Browser[] = [];
  private availableBrowsers: Browser[] = [];
  private inUseBrowsers: Set<Browser> = new Set();

  constructor(
    private readonly config: BrowserConfig,
    private readonly logger: Logger
  ) {}

  async getBrowser(): Promise<Browser> {
    // For now, create a new browser each time
    // In a full implementation, this would manage a pool
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: this.config.launchOptions.args as string[],
      executablePath: this.config.launchOptions.executablePath
    });

    this.inUseBrowsers.add(browser);
    this.logger.debug('Created new browser instance', {
      browserId: browser.process()?.pid
    });

    return browser;
  }

  async returnBrowser(browser: Browser): Promise<void> {
    this.inUseBrowsers.delete(browser);
    
    try {
      await browser.close();
      this.logger.debug('Closed browser instance', {
        browserId: browser.process()?.pid
      });
    } catch (error) {
      this.logger.warn('Failed to close browser', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async cleanup(): Promise<void> {
    const allBrowsers = [...this.browsers, ...Array.from(this.inUseBrowsers)];
    
    for (const browser of allBrowsers) {
      try {
        await browser.close();
      } catch (error) {
        this.logger.warn('Failed to close browser during cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.browsers = [];
    this.availableBrowsers = [];
    this.inUseBrowsers.clear();
  }
} 