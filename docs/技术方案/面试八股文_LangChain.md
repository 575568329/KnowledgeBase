# LangChain 面试八股文 (2026)

> 更新时间:2026-07-01
> 适用版本:LangChain 0.3+
> 关键词:RAG · Agent · Chain · Prompt Engineering

> 参考资料:[LangChain Interview Questions 2026](https://www.interviewcoder.co/blog/langchain-interview-questions) · [Top 50 Questions](https://www.index.dev/interview-questions/langchain-developer)

---

## 一、核心概念

### 1. LangChain 是什么?

**定义**:用于构建 LLM 应用的开发框架,提供组件化的工具链。

**核心模块**:
- **Models**:LLM/ChatModel/Embeddings 接口
- **Prompts**:Prompt 模板管理
- **Chains**:多步骤流程编排
- **Agents**:动态决策,调用工具
- **Memory**:对话上下文管理
- **Retrievers**:向量检索(RAG)
- **Callbacks**:日志/监控/流式输出

**适用场景**:
- 问答系统(RAG)
- 对话机器人
- 代码生成
- 文档分析
- 自动化工作流

### 2. 核心组件架构

```python
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema.runnable import RunnablePassthrough

# 1. Model
llm = ChatOpenAI(model="gpt-4", temperature=0)

# 2. Prompt
prompt = ChatPromptTemplate.from_template("翻译成英文:{text}")

# 3. Chain(LCEL:LangChain Expression Language)
chain = prompt | llm | StrOutputParser()

# 4. 调用
result = chain.invoke({"text": "你好"})
```

---

## 二、高频面试题

### Q1: Chain 是什么?常见的 Chain 类型?

**定义**:将多个组件串联成流程。

**常见类型**:

| Chain 类型 | 作用 | 示例 |
|-----------|------|------|
| **LLMChain** | Prompt → LLM | 基础问答 |
| **SequentialChain** | 多个 Chain 串行执行 | 翻译 → 总结 → 润色 |
| **TransformChain** | 数据预处理 | 清洗输入文本 |
| **RouterChain** | 路由到不同 Chain | 根据问题类型分流 |
| **RetrievalQA** | RAG 问答 | 检索文档 → LLM 回答 |

**LCEL 写法(推荐)**:

```python
chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)
```

### Q2: Agent 与 Chain 的区别?

| | Chain | Agent |
|---|---|---|
| **执行路径** | 固定(预定义) | 动态(LLM 决策) |
| **工具调用** | 手动编排 | 自主选择 |
| **适用场景** | 明确流程 | 复杂决策/未知步骤 |

**Agent 工作流**:

```
用户输入 → LLM 决策 → 选择工具 → 执行 → 观察结果 → 再决策 → ...
         └─────────── ReAct Loop ──────────┘
```

**Agent 类型**:
- **Zero-shot ReAct**:描述工具 → LLM 自主决策
- **Conversational ReAct**:带对话历史
- **OpenAI Functions**:function calling 原生支持
- **Structured Chat**:结构化输出

**示例**:

```python
from langchain.agents import initialize_agent, Tool
from langchain_openai import ChatOpenAI

tools = [
    Tool(
        name="Search",
        func=search_api,
        description="搜索互联网信息"
    ),
    Tool(
        name="Calculator",
        func=calculator,
        description="执行数学计算"
    )
]

agent = initialize_agent(
    tools,
    ChatOpenAI(temperature=0),
    agent="zero-shot-react-description",
    verbose=True
)

agent.run("今天北京天气如何?明天会下雨吗?")
```

### Q3: RAG(检索增强生成)如何实现?

**流程**:

```
用户问题 → Embedding → 向量检索 → 相关文档 Top-K → Prompt 拼接 → LLM 生成答案
```

**实现**:

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA

# 1. 文档切片
documents = load_documents("./docs")
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
texts = splitter.split_documents(documents)

# 2. Embedding + 向量库
embeddings = OpenAIEmbeddings()
vectorstore = Chroma.from_documents(texts, embeddings)

# 3. 检索器
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

# 4. RAG Chain
qa_chain = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(),
    retriever=retriever,
    return_source_documents=True
)

result = qa_chain({"query": "什么是 LangChain?"})
```

**优化技巧**:
- **文档切片**:根据语义切(Semantic Splitter),不只按长度
- **重排序(Rerank)**:Cohere/Jina Reranker 重新排序 Top-K
- **混合检索**:向量检索 + BM25 关键词检索
- **多跳推理**:多轮检索(HyDE/Multi-Query)

### Q4: Memory 的作用?类型有哪些?

**作用**:维护对话上下文,让 LLM"记住"历史。

**类型**:

| Memory 类型 | 机制 | 场景 |
|------------|------|------|
| **ConversationBufferMemory** | 保存完整历史 | 短对话 |
| **ConversationBufferWindowMemory** | 保存最近 N 轮 | 控制上下文长度 |
| **ConversationSummaryMemory** | LLM 总结历史 | 长对话,压缩历史 |
| **ConversationKGMemory** | 提取知识图谱 | 复杂关系推理 |
| **VectorStoreBackedMemory** | 语义检索历史 | 大量历史,按相关性召回 |

```python
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain

memory = ConversationBufferMemory()
chain = ConversationChain(llm=llm, memory=memory)

chain.run("我叫张三")
chain.run("我叫什么名字?")  # 输出:张三
```

### Q5: Prompt 模板最佳实践?

**FewShotPromptTemplate**(少样本学习):

```python
from langchain.prompts import FewShotPromptTemplate

examples = [
    {"input": "happy", "output": "sad"},
    {"input": "big", "output": "small"}
]

example_prompt = PromptTemplate(
    input_variables=["input", "output"],
    template="Input: {input}\nOutput: {output}"
)

prompt = FewShotPromptTemplate(
    examples=examples,
    example_prompt=example_prompt,
    suffix="Input: {adjective}\nOutput:",
    input_variables=["adjective"]
)
```

**PartialPromptTemplate**(部分填充):

```python
prompt = PromptTemplate(
    template="{greeting} {name}!",
    input_variables=["greeting", "name"]
)

partial_prompt = prompt.partial(greeting="Hello")
partial_prompt.format(name="Alice")  # Hello Alice!
```

### Q6: 如何调试 LangChain 应用?

**1. Verbose 模式**:

```python
chain = RetrievalQA.from_chain_type(llm, retriever=retriever, verbose=True)
```

**2. Callbacks**:

```python
from langchain.callbacks import get_openai_callback

with get_openai_callback() as cb:
    result = chain.run(query)
    print(f"Tokens: {cb.total_tokens}, Cost: ${cb.total_cost}")
```

**3. LangSmith**(官方可观测平台):

```bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=your_key
```

自动记录每步输入/输出,可视化链路。

---

## 三、实战场景

### 场景1:多文档 QA(带引用)

```python
from langchain.chains import RetrievalQAWithSourcesChain

chain = RetrievalQAWithSourcesChain.from_chain_type(
    llm=llm,
    retriever=retriever
)

result = chain({"question": "什么是 LCEL?"})
print(result["answer"])
print(result["sources"])  # 引用的文档来源
```

### 场景2:SQL Agent(自然语言转 SQL)

```python
from langchain_community.utilities import SQLDatabase
from langchain_experimental.sql import SQLDatabaseChain

db = SQLDatabase.from_uri("sqlite:///example.db")
chain = SQLDatabaseChain.from_llm(llm, db, verbose=True)

chain.run("2023年销售额最高的产品是什么?")
# 自动生成 SQL:SELECT product, MAX(sales) FROM orders WHERE year=2023
```

### 场景3:多步推理(Reasoning)

```python
from langchain.chains import LLMMathChain

llm_math = LLMMathChain.from_llm(llm)

chain = (
    {"question": RunnablePassthrough()}
    | llm_math
)

chain.invoke("13的平方根乘以7等于多少?")
# 内部:sqrt(13) * 7 ≈ 25.23
```

---

## 四、高级话题

### 1. 自定义工具

```python
from langchain.tools import BaseTool

class CustomSearchTool(BaseTool):
    name = "custom_search"
    description = "搜索内部知识库"
    
    def _run(self, query: str) -> str:
        # 自定义逻辑
        return search_internal_kb(query)
    
    async def _arun(self, query: str) -> str:
        # 异步版本
        return await async_search(query)
```

### 2. 输出解析器

```python
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

class Person(BaseModel):
    name: str = Field(description="姓名")
    age: int = Field(description="年龄")

parser = PydanticOutputParser(pydantic_object=Person)

prompt = PromptTemplate(
    template="提取人物信息:\n{format_instructions}\n{text}",
    input_variables=["text"],
    partial_variables={"format_instructions": parser.get_format_instructions()}
)

chain = prompt | llm | parser
result = chain.invoke({"text": "张三今年25岁"})
# 输出:Person(name='张三', age=25)
```

### 3. 流式输出

```python
for chunk in chain.stream({"question": "什么是 AI?"}):
    print(chunk, end="", flush=True)
```

---

## 五、常见坑与优化

### 1. Token 超限

**问题**:RAG 检索文档过多,超出上下文窗口。

**解法**:
- 减少 Top-K
- Map-Reduce:切片 → 并行总结 → 汇总
- Refine:逐文档迭代精炼答案

### 2. 幻觉(Hallucination)

**问题**:LLM 编造不存在的信息。

**解法**:
- Prompt 加"仅基于检索文档回答,不知道就说不知道"
- 引用来源(RetrievalQAWithSources)
- 事实核查 Agent

### 3. 成本优化

**策略**:
- 缓存:LangChain 内置 `llm_cache`
- 路由:简单问题用小模型(GPT-3.5),复杂问题用 GPT-4
- Embedding 本地化:用开源模型(BGE/Instructor)

---

## 参考资料

- [LangChain 官方文档](https://python.langchain.com/)
- [LangChain Interview Questions 2026](https://www.interviewcoder.co/blog/langchain-interview-questions)
- [RAG Interview Questions](https://www.datacamp.com/blog/rag-interview-questions)
- [Top 50 LangChain Questions](https://www.index.dev/interview-questions/langchain-developer)
