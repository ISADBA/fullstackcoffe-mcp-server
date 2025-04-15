import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { zodToJsonSchema } from 'zod-to-json-schema';
import   {z}   from 'zod';
import { exec } from 'child_process';
import {
    ListToolsRequestSchema,
    CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// 声明mcp server
const server = new Server(
  {
    name: "ping-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 声明一个调用系统ping命令的函数
async function ping(ip: string, count: string = '4', timeout: string = '1'): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = `ping -c ${count} -W ${timeout} ${ip}`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Ping failed: ${stderr || error.message}`));
      } else if (stderr) {
        reject(new Error(`Ping error: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "ping_ip",
          description: "Ping an IP address",
          inputSchema: zodToJsonSchema(z.object({
            ip: z.string(),
              count: z.string().optional(),
              timeout: z.string().optional(),})),
        },
      ],
    };
  });
  
  // Define input schema for ping_ip tool
  const PingIpInputSchema = z.object({
    ip: z.string(),
    count: z.string().optional(),
    timeout: z.string().optional()
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (!request.params.arguments) {
        throw new Error("Arguments are required");
      }
  
      switch (request.params.name) {
        case "ping_ip": {
          const { ip, count, timeout } = PingIpInputSchema.parse(request.params.arguments);
          const response = await ping(ip, count ?? '4', timeout ?? '1');
          return {
            result: response,
          }
        }
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      const err = error as Error;
      return {
        error: {
          code: "TOOL_EXECUTION_ERROR",
          message: err.message,
          details: {
            tool: request.params.name,
            stack: process.env.NODE_ENV === "development" ? err.stack : undefined
          }
        }
      }
    }
  });


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