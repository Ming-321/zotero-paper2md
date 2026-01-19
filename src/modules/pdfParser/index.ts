/**
 * PDF解析器模块入口
 *
 * 提供统一的PDF解析接口，支持多种解析器适配器
 */

export * from "./types";
export { MineruAdapter } from "./adapters/mineruAdapter";

// 默认导出MinerU适配器作为主要解析器
import { MineruAdapter } from "./adapters/mineruAdapter";
export default MineruAdapter;
