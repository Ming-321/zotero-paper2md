# Paper2MD 技术路线图

## 当前版本 v0.2.0

### 已完成功能
- ✅ PDF 转 Markdown（通过 MinerU API）
- ✅ AI 总结功能（支持多 AI 提供商）
- ✅ 公式渲染（集成 Better Notes API）
- ✅ 偏好设置 UI
- ✅ 中英文本地化

## 未来规划

### Phase 3: 提示词优化
- [ ] 优化 AI 总结提示词，提升总结质量
- [ ] 针对不同类型论文（综述、实验、理论）定制提示词模板
- [ ] 支持用户自定义提示词模板
- [ ] 添加提示词预览和测试功能

### Phase 4: 并发设计提速
- [ ] 实现并行章节处理，多个章节同时总结
- [ ] 添加进度显示和取消功能
- [ ] 优化 API 调用策略，减少等待时间
- [ ] 实现智能批量处理，支持多篇论文队列

### Phase 5: 多配置管理
- [ ] 支持保存多个 AI 配置（不同提供商/模型）
- [ ] 配置快速切换功能
- [ ] 配置导入/导出功能
- [ ] 按场景推荐配置（速度优先/质量优先/成本优先）

### Phase 6: 架构重构优化
- [ ] 模块化重构，提升代码可维护性
- [ ] 引入状态管理，优化数据流
- [ ] 添加单元测试和集成测试
- [ ] 性能监控和错误报告
- [ ] 插件 API 开放，支持扩展

### 长期愿景
- 支持更多 AI 提供商（Claude、Gemini 等）
- 支持多语言总结（不仅限于中文）
- 集成知识图谱，建立论文关联
- 支持图表分析和描述
- 与 Obsidian、Notion 等工具联动

## 贡献指南

欢迎提交 Issue 和 Pull Request！

- 问题反馈：[GitHub Issues](https://github.com/Ming-321/zotero-paper2md/issues)
- 功能建议：[GitHub Discussions](https://github.com/Ming-321/zotero-paper2md/discussions)
