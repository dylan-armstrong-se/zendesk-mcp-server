import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import https from "https";

const SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const EMAIL = process.env.ZENDESK_EMAIL;
const TOKEN = process.env.ZENDESK_TOKEN;

if (!SUBDOMAIN || !EMAIL || !TOKEN) {
  process.stderr.write("Missing required env vars: ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_TOKEN\n");
  process.exit(1);
}

const BASE_URL = `https://${SUBDOMAIN}.zendesk.com`;
const AUTH = Buffer.from(`${EMAIL}/token:${TOKEN}`).toString("base64");

function zendeskFetch(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `${SUBDOMAIN}.zendesk.com`,
      path,
      method: "GET",
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Zendesk API error ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

function zendeskWrite(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: `${SUBDOMAIN}.zendesk.com`,
      path,
      method,
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Zendesk API error ${res.statusCode}: ${data}`));
        } else {
          resolve(res.statusCode === 204 ? {} : JSON.parse(data));
        }
      });
    });

    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

const TOOLS = [
  {
    name: "zendesk_list_categories",
    description: "List all Help Center categories",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "zendesk_list_sections",
    description: "List sections within a Help Center category",
    inputSchema: {
      type: "object",
      properties: {
        category_id: { type: "string", description: "The category ID" },
      },
      required: ["category_id"],
    },
  },
  {
    name: "zendesk_list_articles",
    description: "List articles in a Help Center section or category. Paginates automatically up to 100 articles.",
    inputSchema: {
      type: "object",
      properties: {
        section_id: { type: "string", description: "Section ID (use this OR category_id)" },
        category_id: { type: "string", description: "Category ID — returns all articles across all sections in the category" },
        page: { type: "number", description: "Page number (default 1)" },
      },
    },
  },
  {
    name: "zendesk_get_article",
    description: "Get the full content of a specific Help Center article by ID",
    inputSchema: {
      type: "object",
      properties: {
        article_id: { type: "string", description: "The article ID" },
      },
      required: ["article_id"],
    },
  },
  {
    name: "zendesk_search_articles",
    description: "Search Help Center articles by keyword",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        category_id: { type: "string", description: "Optional: limit search to a specific category" },
      },
      required: ["query"],
    },
  },
  {
    name: "zendesk_get_ticket",
    description: "Get a support ticket by ID, including its comments",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: { type: "string", description: "The ticket ID" },
      },
      required: ["ticket_id"],
    },
  },
  {
    name: "zendesk_search_tickets",
    description: "Search support tickets using Zendesk search syntax (e.g. 'status:open tag:billing')",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results to return (default 20, max 100)" },
      },
      required: ["query"],
    },
  },
  {
    name: "zendesk_update_article_draft",
    description: "Update a Help Center article's title and/or body, and set it to draft status for review. Use this when publishing an audited version of an article that needs human review before going live.",
    inputSchema: {
      type: "object",
      properties: {
        article_id: { type: "string", description: "The article ID to update" },
        title: { type: "string", description: "New article title (optional — omit to keep existing title)" },
        body: { type: "string", description: "New article body as HTML" },
        label_names: {
          type: "array",
          items: { type: "string" },
          description: "Replacement label/tag list for the article (optional — omit to keep existing labels)",
        },
      },
      required: ["article_id", "body"],
    },
  },
];

async function callTool(name, args) {
  switch (name) {
    case "zendesk_list_categories": {
      const data = await zendeskFetch("/api/v2/help_center/categories.json");
      return data.categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        html_url: c.html_url,
      }));
    }

    case "zendesk_list_sections": {
      const data = await zendeskFetch(
        `/api/v2/help_center/categories/${args.category_id}/sections.json`
      );
      return data.sections.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category_id: s.category_id,
        html_url: s.html_url,
      }));
    }

    case "zendesk_list_articles": {
      const page = args.page || 1;
      let path;
      if (args.section_id) {
        path = `/api/v2/help_center/sections/${args.section_id}/articles.json?per_page=100&page=${page}`;
      } else if (args.category_id) {
        path = `/api/v2/help_center/categories/${args.category_id}/articles.json?per_page=100&page=${page}`;
      } else {
        path = `/api/v2/help_center/articles.json?per_page=100&page=${page}`;
      }
      const data = await zendeskFetch(path);
      return {
        articles: data.articles.map((a) => ({
          id: a.id,
          title: a.title,
          section_id: a.section_id,
          updated_at: a.updated_at,
          html_url: a.html_url,
          draft: a.draft,
        })),
        page_count: data.page_count,
        count: data.count,
      };
    }

    case "zendesk_get_article": {
      const data = await zendeskFetch(
        `/api/v2/help_center/articles/${args.article_id}.json`
      );
      const a = data.article;
      return {
        id: a.id,
        title: a.title,
        body: a.body,
        section_id: a.section_id,
        updated_at: a.updated_at,
        html_url: a.html_url,
        draft: a.draft,
        label_names: a.label_names,
      };
    }

    case "zendesk_search_articles": {
      let path = `/api/v2/help_center/articles/search.json?query=${encodeURIComponent(args.query)}&per_page=25`;
      if (args.category_id) {
        path += `&category=${args.category_id}`;
      }
      const data = await zendeskFetch(path);
      return data.results.map((a) => ({
        id: a.id,
        title: a.title,
        section_id: a.section_id,
        updated_at: a.updated_at,
        html_url: a.html_url,
        snippet: a.snippet,
      }));
    }

    case "zendesk_get_ticket": {
      const [ticketData, commentsData] = await Promise.all([
        zendeskFetch(`/api/v2/tickets/${args.ticket_id}.json`),
        zendeskFetch(`/api/v2/tickets/${args.ticket_id}/comments.json`),
      ]);
      const t = ticketData.ticket;
      return {
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        created_at: t.created_at,
        updated_at: t.updated_at,
        tags: t.tags,
        comments: commentsData.comments.map((c) => ({
          id: c.id,
          body: c.plain_body,
          author_id: c.author_id,
          public: c.public,
          created_at: c.created_at,
        })),
      };
    }

    case "zendesk_search_tickets": {
      const limit = Math.min(args.limit || 20, 100);
      const data = await zendeskFetch(
        `/api/v2/search.json?query=${encodeURIComponent(args.query)}&type=ticket&per_page=${limit}`
      );
      return data.results.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        created_at: t.created_at,
        updated_at: t.updated_at,
        tags: t.tags,
      }));
    }

    case "zendesk_update_article_draft": {
      // Step 1: update translation (title + body)
      const translationPayload = { translation: { body: args.body } };
      if (args.title) translationPayload.translation.title = args.title;
      await zendeskWrite(
        "PUT",
        `/api/v2/help_center/articles/${args.article_id}/translations/en-us.json`,
        translationPayload
      );

      // Step 2: set draft: true and optionally update labels
      const articlePayload = { article: { draft: true } };
      if (args.label_names) articlePayload.article.label_names = args.label_names;
      await zendeskWrite(
        "PUT",
        `/api/v2/help_center/articles/${args.article_id}.json`,
        articlePayload
      );

      return {
        article_id: args.article_id,
        status: "draft",
        title_updated: !!args.title,
        labels_updated: !!args.label_names,
        zendesk_url: `https://${SUBDOMAIN}.zendesk.com/hc/en-us/articles/${args.article_id}`,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: "zendesk", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, args || {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
