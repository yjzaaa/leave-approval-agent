# 财务问数场景 (finance-query)

> ⬆️ [返回 scenarios/](../CLAUDE.md)

## 目录结构

```
finance-query/
├── index.ts       # 场景入口
├── tools.ts       # 11 个 Tool（连接/查询/计算/输出）
├── prompt.ts      # System Prompt
└── validator.ts   # 3 层校验
```

## Tool 列表

| 层 | Tool | 说明 |
|-----|------|------|
| 连接 | connect_datasource | 加载 Excel，返回表结构 |
| 连接 | get_schema | 查看列名+类型 |
| 查询 | select_data | 过滤+投影 |
| 查询 | aggregate_data | GROUP BY 聚合 |
| 查询 | join_data | 表连接 |
| 查询 | sort_data | 排序 |
| 查询 | sql_query | 自由 SQL |
| 计算 | calculate_fields | 派生字段 |
| 计算 | generate_cost_rate_sql | 成本分摊 SQL |
| 输出 | generate_chart | 图表 ContentBlock |

## 类型

查询分析型：无表单、无 HITL、无审批流程
