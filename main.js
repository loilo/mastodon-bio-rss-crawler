// For more information, see https://crawlee.dev/
import * as fs from 'node:fs'
import { consola } from 'consola'
import { parse } from 'csv-parse/sync'
import {
  PlaywrightCrawler,
  createPlaywrightRouter,
  Dataset,
  RequestQueue
} from 'crawlee'

const csvFile = process.argv[2]

// Check if CSV file exists
if (!fs.existsSync(csvFile)) {
  consola.error('Please provide a valid CSV file as the first argument')
  process.exit(1)
}

// Read & parse CSV file
let csvRecords
try {
  const rawContent = fs.readFileSync(csvFile, 'utf8')
  csvRecords = parse(rawContent)
} catch (error) {
  consola.warn('Could not read CSV file')
  consola.error(error)
  process.exit(1)
}

// Drop header line
csvRecords.shift()

// Convert CSV data to requests
const profileRequsts = csvRecords.map(([profile]) => {
  const [user, host] = profile.split('@')
  const url = `https://${host}/@${user}`

  return {
    url,
    label: 'userProfile',
    userData: {
      user: profile
    }
  }
})

const results = new Map()

const router = createPlaywrightRouter()

// Skip any requests that should not be handled by the crawler
router.addDefaultHandler(async ({ request }) => {
  consola.info('Skipping %s', request.url)
})

// Handle requests to Mastodon profiles
router.addHandler('userProfile', async ({ request, page, enqueueLinks }) => {
  const user = request.userData.user

  consola.log('Scanning %s', user)

  if (!results.has(user)) {
    results.set(user, [])
  }

  // Wait for the site to load
  await page.waitForLoadState('networkidle')

  // Extract links from bio
  const links = await page.locator('.account__header__fields a').all()
  const requests = await Promise.all(
    links.map(async link => ({
      url: await link.getAttribute('href'),
      label: 'userWebsite',
      userData: { user }
    }))
  )

  consola.log("Found %s links on %s's profile", requests.length, user)

  // Append requests to queue
  const requestQueue = await RequestQueue.open()
  await requestQueue.addRequests(requests)
})

// Handle bio websites
router.addHandler('userWebsite', async ({ request, page }) => {
  consola.log(
    'Looking for feeds in %s (by %s)',
    request.url,
    request.userData.user
  )

  // Wait for the site to load
  await page.waitForLoadState('networkidle')

  // Extract feeds from website
  const feedUrls = await page
    .locator(
      'css=link[rel="alternate"]:is([type="application/rss+xml"], [type="application/atom+xml"])'
    )
    .evaluateAll(links => links.map(link => link.href))

  // Add site & feeds to results
  results.get(request.userData.user).push({
    url: request.url,
    feeds: feedUrls
  })

  consola.log('Found feeds in %s', request.url)
})

// Start crawling
consola.info('Enqueuing %s profiles to scan', csvRecords.length)

const crawler = new PlaywrightCrawler({ requestHandler: router })
await crawler.run(profileRequsts)

// Write results to text file
const sitesMarkdown = `# Mastodon Bio Websites\r\n\r\n${[...results]
  .map(
    ([user, sites]) =>
      `## ${user}\r\n\r\n${sites
        .map(
          ({ url, feeds }) =>
            `- ${url}\r\n${feeds
              .map(feed => `   - Feed: ${feed}\r\n`)
              .join('')}`
        )
        .join('')}`
  )
  .join('\r\n\r\n')}`
fs.writeFileSync('websites.md', sitesMarkdown)

consola.success('Done, wrote sites to websites.md')
