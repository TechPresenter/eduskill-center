import { apiHandler } from "@/lib/api/handler";
import { listBlogTags } from "@/server/blog";

/**
 * The whole tag lookup table, ordered by live post count. It feeds the editor's tag field and
 * the admin list filter, which used to derive their options by scanning `take: 1000` posts and
 * flattening every `tags` array in memory.
 */
export const GET = apiHandler({ permission: "cms.view" }, async () => listBlogTags());
