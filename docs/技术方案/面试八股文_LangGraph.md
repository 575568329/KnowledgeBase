# LangGraph 面试八股文 (2026)

> 更新时间:2026-07-01
> 适用版本:LangGraph 0.2+
> 关键词:状态机 · Agent Workflow · Multi-Agent

> 参考资料:[Top 35 LangGraph Questions 2026](https://www.interviewcoder.co/blog/langgraph-interview-questions)

---

## 一、核心概念

### 1. LangGraph 是什么?

**定义**:LangChain 生态的工作流编排框架,基于**有向图(DAG)**构建复杂 Agent 系统。

**与 LangChain 关系**:
- LangChain:链式调用(单向流)
- LangGraph:图结构(支持循环/条件/并行)

**核心能力**:
- **状态管理**:跨节点共享状态
- **循环**:Agent 可多轮迭代决策
- **条件分支**:动态路由
- **并行执行**:多个节点同时运行
- **人工介入**(Human-in-the-Loop)

**适用场景**:
- 多步骤推理(CoT/ReAct)
- Multi-Agent 协作
- 复杂工作流(审批/路由)
- 自主 Agent(持续运行直到目标达成)

### 2. 核心概念

**Graph(图)**:节点(Node)+ 边(Edge)。

```python
from langgraph.graph import StateGraph

# 1. 定义状态
class AgentState(TypedDict):
    messages: List[str]
    next_action: str

# 2. 创建图
graph = StateGraph(AgentState)

# 3. 添加节点
graph.add_node("agent", agent_node)
graph.add_node("tool", tool_node)

# 4. 添加边
graph.add_edge("agent", "tool")  # 固定边
graph.add_conditional_edges(     # 条件边
    "tool",
    should_continue,  # 判断函数
    {
        "continue": "agent",
        "end": END
    }
)

# 5. 设置入口
graph.set_entry_point("agent")

# 6. 编译
app = graph.compile()

# 7. 运行
result = app.invoke({"messages": ["用户输入"]})
```

---

## 二、高频面试题

### Q1: LangGraph vs LangChain Agents?

| 维度 | LangChain Agents | LangGraph |
|------|-----------------|-----------|
| **控制流** | LLM 完全自主 | 显式定义图结构 |
| **可预测性** | 低(黑盒) | 高(可视化) |
| **调试** | 困难 | 每个节点可检查 |
| **复杂度** | 简单任务 | 多步骤/多 Agent |
| **循环** | 有限(max_iterations) | 灵活(自定义终止条件) |

**何时用 LangGraph**:
- 需要严格控制执行流程
- 多个 Agent 协作
- 需要人工审核节点
- 复杂状态管理

### Q2: State 的作用?如何更新?

**State**:跨节点共享的数据结构(类似 Redux)。

```python
from typing import TypedDict, Annotated
from langgraph.graph import add_messages

class State(TypedDict):
    messages: Annotated[List, add_messages]  # 累加消息
    count: int                                # 普通字段

def node_func(state: State) -> State:
    return {
        "messages": [AIMessage(content="回复")],  # add_messages 自动追加
        "count": state["count"] + 1              # 直接覆盖
    }
```

**Reducer(归约器)**:
- `add_messages`:累加列表
- 自定义:如求和/去重

### Q3: 条件边(Conditional Edges)如何实现路由?

```python
def route_func(state: State) -> str:
    last_msg = state["messages"][-1]
    if "搜索" in last_msg.content:
        return "search"
    elif "计算" in last_msg.content:
        return "calculator"
    else:
        return "end"

graph.add_conditional_edges(
    "agent",
    route_func,  # 返回下一个节点名
    {
        "search": "search_node",
        "calculator": "calc_node",
        "end": END
    }
)
```

### Q4: 如何实现 Human-in-the-Loop?

**Checkpointer**(检查点):暂停执行,等待人工输入。

```python
from langgraph.checkpoint.sqlite import SqliteSaver

memory = SqliteSaver.from_conn_string(":memory:")
app = graph.compile(checkpointer=memory)

# 首次运行
config = {"configurable": {"thread_id": "123"}}
result = app.invoke(input, config)

# 人工审核后继续
updated_state = {"approval": "approved"}
result = app.invoke(updated_state, config)  # 从断点继续
```

**中断节点**:

```python
from langgraph.prebuilt import interrupt

def approval_node(state: State):
    if state["needs_review"]:
        return interrupt("等待审批")  # 中断,返回控制权
    return state
```

### Q5: 并行节点如何实现?

```python
from langgraph.graph import ParallelNode

# 并行执行多个节点
graph.add_node("parallel", ParallelNode([
    agent1_node,
    agent2_node,
    agent3_node
]))

# 结果合并到 state
```

### Q6: ReAct Agent 如何用 LangGraph 实现?

```python
from langgraph.prebuilt import ToolExecutor, ToolInvocation

# 定义工具
tools = [search_tool, calculator_tool]
tool_executor = ToolExecutor(tools)

def agent_node(state: State):
    # LLM 决策
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def tool_node(state: State):
    # 执行工具
    last_msg = state["messages"][-1]
    tool_call = last_msg.tool_calls[0]
    result = tool_executor.invoke(ToolInvocation(
        tool=tool_call["name"],
        tool_input=tool_call["args"]
    ))
    return {"messages": [ToolMessage(content=result)]}

def should_continue(state: State) -> str:
    last_msg = state["messages"][-1]
    if last_msg.tool_calls:
        return "continue"
    return "end"

# 构建图
graph.add_node("agent", agent_node)
graph.add_node("tools", tool_node)
graph.add_conditional_edges("agent", should_continue, {
    "continue": "tools",
    "end": END
})
graph.add_edge("tools", "agent")  # 循环回 agent
```

---

## 三、实战场景

### 场景1:Multi-Agent 协作(Supervisor 模式)

```python
# Supervisor 负责任务分配
def supervisor_node(state: State):
    next_agent = llm.invoke(f"分配任务给哪个 agent:{state['task']}")
    return {"next": next_agent}

# 专家 Agent
def researcher_node(state: State):
    research_result = do_research(state["task"])
    return {"research": research_result}

def writer_node(state: State):
    article = write_article(state["research"])
    return {"article": article}

# 路由
graph.add_conditional_edges("supervisor", lambda s: s["next"], {
    "researcher": "researcher",
    "writer": "writer",
    "end": END
})
```

### 场景2:Planning Agent(计划 → 执行)

```python
def plan_node(state: State):
    plan = llm.invoke(f"分解任务:{state['query']}")
    return {"plan": plan.steps}

def execute_node(state: State):
    results = []
    for step in state["plan"]:
        result = execute_step(step)
        results.append(result)
    return {"results": results}

graph.add_edge("plan", "execute")
```

### 场景3:错误重试(带指数退避)

```python
def retry_node(state: State):
    if state["retries"] < 3:
        try:
            result = risky_operation()
            return {"result": result, "retries": 0}
        except Exception as e:
            return {
                "error": str(e),
                "retries": state["retries"] + 1
            }
    else:
        return {"error": "Max retries exceeded"}

def should_retry(state: State) -> str:
    if state.get("error") and state["retries"] < 3:
        return "retry"
    return "end"

graph.add_conditional_edges("retry", should_retry, {
    "retry": "retry",
    "end": END
})
```

---

## 四、高级话题

### 1. 流式输出(Streaming)

```python
for event in app.stream(input, config):
    print(event)  # 每个节点输出实时返回
```

### 2. 时间旅行(Time Travel)

```python
# 查看历史状态
history = app.get_state_history(config)
for state in history:
    print(state.values)

# 回滚到某个状态
app.update_state(config, state.values, as_node="agent")
```

### 3. 子图(Subgraphs)

```python
# 子图作为节点
subgraph = StateGraph(SubState)
subgraph.add_node("sub1", sub_node)
compiled_subgraph = subgraph.compile()

# 嵌入主图
main_graph.add_node("subgraph", compiled_subgraph)
```

### 4. 持久化(Persistence)

```python
from langgraph.checkpoint.postgres import PostgresSaver

# 状态存 PostgreSQL
checkpointer = PostgresSaver.from_conn_string("postgresql://...")
app = graph.compile(checkpointer=checkpointer)

# 跨会话恢复
app.invoke(input, {"configurable": {"thread_id": "user-123"}})
```

---

## 五、调试与监控

### 1. 可视化

```python
from IPython.display import Image, display

display(Image(app.get_graph().draw_mermaid_png()))
```

生成 Mermaid 流程图。

### 2. LangSmith 集成

```bash
export LANGCHAIN_TRACING_V2=true
```

自动记录每个节点的输入/输出。

### 3. 断点调试

```python
def debug_node(state: State):
    print(f"当前状态:{state}")
    breakpoint()  # 插入断点
    return state

graph.add_node("debug", debug_node)
```

---

## 六、常见坑

### 1. 无限循环

**问题**:条件边判断错误,Agent 永远不返回 END。

**解法**:
- 设置 `recursion_limit`
- 确保有明确的终止条件

```python
app = graph.compile(recursion_limit=10)
```

### 2. 状态不一致

**问题**:多个节点修改同一字段,顺序不确定。

**解法**:
- 用 Reducer(如 `add_messages`)自动归约
- 避免并行节点写同一字段

### 3. Checkpointer 性能

**问题**:每步都写数据库,延迟高。

**解法**:
- 仅关键节点保存检查点
- 用内存 Checkpointer(MemorySaver)调试

---

## 参考资料

- [LangGraph 官方文档](https://langchain-ai.github.io/langgraph/)
- [LangGraph Interview Questions](https://www.interviewcoder.co/blog/langgraph-interview-questions)
- [Multi-Agent 最佳实践](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/)
