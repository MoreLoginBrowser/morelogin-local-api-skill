# 审核分支 CI 验收记录

日期：2026-09-29。审核分支：`codex/release-validation`。

代码提交：`3e1f3c06abc0928d8e4fe0048165b201ab214b35`。
[GitHub Actions 运行 36584360807](https://github.com/MoreLoginBrowser/morelogin-local-api-skill/actions/runs/36584360807)
结论：success，6/6 jobs 通过。每组执行 npm ci、完整发布验证及报告上传。

| 系统 | Node 22 | Node 24 |
|---|---|---|
| ubuntu-latest | 通过 | 通过 |
| macos-latest | 通过 | 通过 |
| windows-latest | 通过 | 通过 |

每组生成独立的 endpoint-matrix.json、test-events.jsonl、tests.tap 和 package.json，
已作为 `release-evidence-<os>-node-<version>` artifact 归档。Actions artifacts 有保留期限。

首次提交 bb56560 的 Windows 检查失败于规范一致性校验：Git 自动把 LF 转成 CRLF，
导致上游规范快照哈希及生成文本改变。通过 `.gitattributes` 固定文本检出为 LF，
四份快照在 Windows-style checkout 过滤下恢复原始哈希；后续真实 Windows CI 通过。
没有跳过测试、忽略哈希差异或降低契约要求。

本记录只证明上述提交的自动化测试与打包检查通过，不等于真实写入/扣费/删除等
业务验收通过。17 项实机只读证据另见 live-package-readonly.json；实机写操作仍未执行。
主分支未合并，未发布 npm 包或 GitHub Release。后续提交的 CI 以分支实际运行结果为准。
