import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Resource,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "example-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      resources: {}, // 添加了对resources能力的支持
    }
  }
);

// 声明对所有的资源列表
const ALL_RESOURCES: Resource[] = Array.from({ length: 100 }, (_, i) => {
  const uri = `test://static/resource/${i + 1}`;
  if (i % 2 === 0) {
    return {
      uri,
      name: `Resource ${i + 1}`,
      mimeType: "text/plain",
      text: `Resource ${i + 1}: This is a plaintext resource`,
    };
  } else {
    const buffer = Buffer.from(`Resource ${i + 1}: This is a base64 blob`);
    return {
      uri,
      name: `Resource ${i + 1}`,
      mimeType: "application/octet-stream",
      blob: buffer.toString("base64"),
    };
  }
});

// 声明对listResource请求的处理方法
server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const cursor = request.params?.cursor;
  let startIndex = 0;

  if (cursor) {
    const decodedCursor = parseInt(atob(cursor), 10);
    if (!isNaN(decodedCursor)) {
      startIndex = decodedCursor;
    }
  }

  const PAGE_SIZE = 10;
  const endIndex = Math.min(startIndex + PAGE_SIZE, ALL_RESOURCES.length);
  const resources = ALL_RESOURCES.slice(startIndex, endIndex);

  let nextCursor: string | undefined;
  if (endIndex < ALL_RESOURCES.length) {
    nextCursor = btoa(endIndex.toString());
  }

  return {
    resources,
    nextCursor,
  };
});

// 声明对readResource请求的处理方法
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri.startsWith("test://static/resource/")) {
    const index = parseInt(uri.split("/").pop() ?? "", 10) - 1;
    if (index >= 0 && index < ALL_RESOURCES.length) {
      const resource = ALL_RESOURCES[index];
      return {
        contents: [resource],
      };
    }
  }

  throw new Error(`Unknown resource: ${uri}`);
});



// 启动服务
async function main() {
    const transport = new StdioServerTransport();
  
    await server.connect(transport);
  
    // Cleanup on exit
    process.on("SIGINT", async () => {
      await server.close();
      process.exit(0);
    });
}
  
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});