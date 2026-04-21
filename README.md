# Zendesk MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for Zendesk that exposes both **Support tickets** and **Help Center (Knowledge Base)** as tools in Claude Code.

## Tools

| Tool | Description |
|---|---|
| `zendesk_list_categories` | List all Help Center categories |
| `zendesk_list_sections` | List sections within a category |
| `zendesk_list_articles` | List articles in a section or category (paginated) |
| `zendesk_get_article` | Fetch the full content of an article by ID |
| `zendesk_search_articles` | Search Help Center articles by keyword |
| `zendesk_get_ticket` | Fetch a support ticket and its comments by ID |
| `zendesk_search_tickets` | Search tickets using Zendesk search syntax |
| `zendesk_update_article_draft` | Update an article's title/body and set it to draft for review |

## Requirements

- Node.js 18+
- A Zendesk account with API access
- A Zendesk API token ([how to create one](https://support.zendesk.com/hc/en-us/articles/4408889192858))

## Installation

```bash
git clone https://github.com/dylan-armstrong-se/zendesk-mcp-server.git
cd zendesk-mcp-server
npm install
```

## Register with Claude Code

```bash
claude mcp add \
  -s user \
  -e "ZENDESK_SUBDOMAIN=your-subdomain" \
  -e "ZENDESK_EMAIL=your-email@company.com" \
  -e "ZENDESK_TOKEN=your-api-token" \
  -e "PATH=/usr/local/bin:/usr/bin:/bin" \
  -- zendesk /usr/local/bin/node /path/to/zendesk-mcp-server/index.js
```

Replace `/path/to/zendesk-mcp-server/` with the absolute path where you cloned the repo.

### Environment Variables

| Variable | Description |
|---|---|
| `ZENDESK_SUBDOMAIN` | Your Zendesk subdomain (e.g. `acme` for `acme.zendesk.com`) |
| `ZENDESK_EMAIL` | Email address of the API user |
| `ZENDESK_TOKEN` | Zendesk API token |
| `NODE_EXTRA_CA_CERTS` | *(Optional)* Path to a custom CA certificate (e.g. for corporate proxies) |

## SSL / Corporate Proxy

If your network uses a TLS-intercepting proxy (e.g. Zscaler), add your CA cert:

```bash
claude mcp add \
  -s user \
  -e "ZENDESK_SUBDOMAIN=your-subdomain" \
  -e "ZENDESK_EMAIL=your-email@company.com" \
  -e "ZENDESK_TOKEN=your-api-token" \
  -e "PATH=/usr/local/bin:/usr/bin:/bin" \
  -e "NODE_EXTRA_CA_CERTS=/path/to/your-ca.pem" \
  -- zendesk /usr/local/bin/node /path/to/zendesk-mcp-server/index.js
```

## Usage Examples

Once registered, use these tools naturally in Claude Code:

- *"List all Help Center categories"*
- *"Search the Zendesk KB for articles about OCPP configuration"*
- *"Get Zendesk ticket 12345 with all comments"*
- *"Search tickets with status:open priority:high"*
- *"Update article 12345 with the revised content and set it to draft"*
