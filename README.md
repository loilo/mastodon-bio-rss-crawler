# Mastodon Bio Crawler

This is a [Node.js](https://nodejs.org/en) tool for extracting personal websites (and their RSS/Atom feeds) from [Mastodon](https://mastodon.social/) bios of the people you follow.

## Usage

First, you'll need a CSV export of your Mastodon follows. You can get this by going to "Import and export" in your Mastodon instance's preferences page (path `/settings/exports/follows.csv`).

Get started by installing dependencies:

```sh
npm ci
```

Then, run the crawler:

```sh
node crawl.js path/to/your/follows.csv
```

If the crawler is done, you'll find the extracted sites in the `websites.md`.
