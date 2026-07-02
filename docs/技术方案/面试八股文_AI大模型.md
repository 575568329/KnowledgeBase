# AI 大模型面试八股文 (2026)

> 更新时间:2026-07-01
> 关键词:LLM · Prompt Engineering · RAG · 向量数据库 · Fine-tuning

---

## 一、基础概念

### 1. 大语言模型(LLM)核心

**定义**:基于 Transformer 架构,在海量文本上预训练的自回归模型。

**主流模型(2026)**:

| 模型 | 厂商 | 特点 | 上下文长度 |
|------|------|------|-----------|
| GPT-4/4.5 | OpenAI | 多模态,推理能力强 | 128K |
| Claude 3 Opus | Anthropic | 长文本理解,安全性 | 200K |
| Gemini 1.5 Pro | Google | 1M 上下文 | 1M |
| GLM-4 | 智谱 | 中文友好 | 128K |
| Qwen2.5 | 阿里 | 开源,多语言 | 32K |
| DeepSeek-V3 | 深度求索 | MoE,推理强 | 64K |

**核心参数**:
- **temperature**(0-2):生成随机性(0=确定,2=发散)
- **top_p**(0-1):核采样,保留概率质量前 p 的 token
- **max_tokens**:最大生成长度
- **frequency_penalty**:降低重复
- **presence_penalty**:鼓励新话题

### 2. Transformer 架构

**核心机制**:

```
输入 Embedding → 位置编码
    ↓
多头自注意力(Multi-Head Attention)
    ↓
前馈神经网络(FFN)
    ↓
输出
```

**Self-Attention 公式**:

```
Attention(Q, K, V) = softmax(QK^T / √d_k) V
```

**为什么除以 √d_k**:缩放,防止点积过大导致 softmax 梯度消失。

**Encoder vs Decoder**:
- **Encoder-only**(BERT):双向,适合理解任务(分类/NER)
- **Decoder-only**(GPT):单向,适合生成任务
- **Encoder-Decoder**(T5):适合翻译/摘要

### 3. 预训练 vs 微调 vs Prompt

| 方法 | 数据量 | 成本 | 灵活性 | 场景 |
|------|--------|------|--------|------|
| **预训练** | TB 级 | 极高($数百万) | 低 | 通用能力 |
| **全量微调** | 10K~1M | 高(需 GPU 集群) | 中 | 垂直领域 |
| **LoRA/QLoRA** | 1K~100K | 中(单卡可训) | 中 | 垂直领域(高效) |
| **Prompt** | 0~100 | 低(零成本) | 高 | 通用/快速迭代 |
| **RAG** | 任意 | 低 | 高 | 知识库问答 |

---

## 二、Prompt Engineering

### 1. 核心技巧

**角色设定(Role)**:

```
你是一位资深 Python 工程师,擅长代码重构和性能优化。
```

**清晰指令**:

```
# ❌ 模糊
帮我改进这段代码

# ✅ 清晰
重构以下代码,要求:1)提取公共函数 2)添加类型注解 3)优化时间复杂度到 O(n)
```

**Few-shot Learning**(少样本):

```
任务:判断情感
输入:这部电影太棒了! → 输出:正面
输入:完全浪费时间 → 输出:负面
输入:还行吧 → 输出:中性

输入:非常推荐! → 输出:
```

**思维链(Chain-of-Thought)**:

```
Q: 小明有5个苹果,吃掉2个,又买了3个,现在有几个?
A: 让我们一步步分析:
1. 初始:5个
2. 吃掉2个:5-2=3个
3. 买了3个:3+3=6个
答案:6个
```

**自我一致性(Self-Consistency)**:生成多次,取多数答案。

### 2. 高级 Prompt 模式

**ReAct(Reasoning + Acting)**:

```
Question: 2024年美国总统是谁?

Thought: 我需要搜索当前信息
Action: Search["2024美国总统"]
Observation: Joe Biden

Thought: 我已经找到答案
Answer: Joe Biden
```

**Tree-of-Thoughts(ToT)**:探索多条推理路径。

```
问题:用4个4和运算符表示1~10

思路1:4/4+4-4=1
思路2:(4+4)/(4+4)=1
评估:思路1更简洁 ✓
```

**Prompt 压缩**:用小模型总结上下文,喂给大模型。

---

## 三、RAG(检索增强生成)

### 1. 核心流程

```
用户提问 → Query 改写(可选)
    ↓
Embedding(文本→向量)
    ↓
向量检索 Top-K
    ↓
重排序(Rerank)
    ↓
拼接 Prompt
    ↓
LLM 生成答案
```

### 2. Embedding 模型

| 模型 | 维度 | 特点 |
|------|------|------|
| text-embedding-3-large | 3072 | OpenAI 最新 |
| BGE-M3 | 1024 | 多语言,开源 |
| Jina-Embeddings-v2 | 768 | 8K 长文本 |

**余弦相似度**:

```python
similarity = cosine_similarity(query_vec, doc_vec)
# [-1, 1],越接近1越相似
```

### 3. 向量数据库

| 数据库 | 特点 | 适用场景 |
|--------|------|---------|
| **Pinecone** | 云服务,易用 | 快速原型 |
| **Weaviate** | 开源,混合检索 | 自部署 |
| **Milvus** | 高性能,分布式 | 大规模 |
| **Qdrant** | Rust,快速 | 中小规模 |
| **Chroma** | 轻量,本地 | 开发测试 |
| **pgvector** | PostgreSQL 插件 | 已有 PG 栈 |

**索引类型**:
- **HNSW**(分层导航小世界图):高召回,内存占用大
- **IVF**(倒排索引):低内存,召回略低
- **Flat**(暴力搜索):精确但慢

### 4. RAG 优化

**Query 改写**:

```python
# 多查询(Multi-Query)
original = "什么是 RAG?"
queries = [
    "RAG 的定义是什么?",
    "检索增强生成如何工作?",
    "RAG 的应用场景有哪些?"
]
```

**HyDE(Hypothetical Document Embeddings)**:

```python
# 1. LLM 生成假设性答案
hypothetical_answer = llm("什么是 RAG?")

# 2. Embed 假设性答案(而非问题)
query_vec = embed(hypothetical_answer)

# 3. 检索(答案和文档语义更接近)
```

**重排序(Rerank)**:

```python
from cohere import Client

# 向量检索 Top-20
docs = vector_search(query, k=20)

# Cohere Rerank → Top-5
client = Client(api_key="...")
reranked = client.rerank(
    query=query,
    documents=[doc.content for doc in docs],
    top_n=5
)
```

**混合检索(Hybrid Search)**:

```
相关度 = α × 向量相似度 + (1-α) × BM25分数
```

---

## 四、Fine-tuning(微调)

### 1. 方法对比

| 方法 | 训练参数 | 显存 | 效果 |
|------|---------|------|------|
| **全量微调** | 100% | 极高 | 最好 |
| **LoRA** | ~1% | 中 | 近似全量 |
| **QLoRA** | ~1% | 低(量化) | 稍逊 LoRA |
| **Adapter** | ~5% | 中 | 中 |
| **Prompt Tuning** | <0.1% | 低 | 最弱 |

### 2. LoRA 原理

**核心思想**:冻结原模型,只训练低秩矩阵。

```
W' = W + ΔW = W + BA
```

- `W`:预训练权重(冻结)
- `B`(d×r)、`A`(r×k):可训练(r << d,k)

**优势**:
- 参数量小(~1%)
- 推理时可合并回原模型
- 多任务切换(换 LoRA 模块)

### 3. 训练数据

**格式**(Instruction Tuning):

```json
{
  "instruction": "将以下文本翻译成英文",
  "input": "你好世界",
  "output": "Hello World"
}
```

**数据量**:
- 简单任务:1K~10K
- 复杂任务:10K~100K
- 垂直领域:至少5K

**数据质量 > 数量**:高质量 5K 数据优于低质量 50K。

---

## 五、高频面试题

### Q1: 幻觉(Hallucination)如何缓解?

**原因**:
- 训练数据偏差
- 过度自信
- 上下文不足

**缓解方法**:
1. **Prompt 约束**:"仅基于给定文档回答,不知道就说不知道"
2. **RAG**:提供事实依据
3. **引用来源**:强制标注来源
4. **多轮验证**:生成 → 自我检查 → 修正
5. **降低 temperature**:减少随机性

### Q2: Token 限制如何处理长文本?

**策略**:
1. **滑动窗口**:分段处理,重叠边界
2. **Map-Reduce**:分段总结 → 汇总
3. **压缩**:小模型预总结
4. **长文本模型**:Claude 200K / Gemini 1M

### Q3: LLM 安全性问题?

**风险**:
- **Prompt Injection**:注入恶意指令
- **数据泄露**:记忆训练数据
- **有害内容**:生成暴力/歧视内容

**防护**:
1. **输入过滤**:黑名单/正则
2. **输出审查**:毒性检测模型
3. **System Prompt 隔离**:用户输入不覆盖系统指令
4. **Constitutional AI**:价值观对齐

### Q4: 如何评估 LLM 应用?

**指标**:
- **准确率**:人工标注 vs 模型输出
- **BLEU/ROUGE**:生成文本相似度
- **RAGAS**(RAG):faithfulness/relevancy
- **成本**:Token 消耗
- **延迟**:响应时间

**A/B 测试**:真实用户反馈。

### Q5: Function Calling 原理?

**流程**:

```python
# 1. 定义工具
tools = [{
    "name": "get_weather",
    "description": "获取天气",
    "parameters": {
        "type": "object",
        "properties": {
            "location": {"type": "string"}
        }
    }
}]

# 2. LLM 决策
response = llm(messages, tools=tools)

# 3. 如果调用工具
if response.tool_calls:
    result = execute_tool(response.tool_calls[0])
    # 4. 结果回传 LLM
    final = llm(messages + [result])
```

**本质**:LLM 输出结构化 JSON,应用解析执行。

---

## 六、实战场景

### 场景1:多轮对话(带历史)

```python
messages = [
    {"role": "system", "content": "你是助手"},
    {"role": "user", "content": "我叫张三"},
    {"role": "assistant", "content": "你好,张三!"},
    {"role": "user", "content": "我叫什么?"}
]

response = llm(messages)  # 输出:张三
```

**历史管理**:
- 保留最近 N 轮
- 超出上下文 → 总结历史

### 场景2:流式输出(Streaming)

```python
for chunk in llm.stream("写一首诗"):
    print(chunk.choices[0].delta.content, end="")
```

**前端实现**:Server-Sent Events(SSE)。

### 场景3:批量处理

```python
import asyncio

tasks = [llm.ainvoke(q) for q in questions]
results = await asyncio.gather(*tasks)
```

---

## 七、行业应用

| 领域 | 应用 | 技术栈 |
|------|------|--------|
| **客服** | 智能问答 | RAG + Function Calling |
| **教育** | 作业批改/家教 | Fine-tuning + CoT |
| **代码** | Copilot | Code LLM + Agent |
| **医疗** | 诊断辅助 | RAG(医学知识库) |
| **金融** | 研报分析 | 长文本模型 + 抽取 |
| **法律** | 合同审查 | RAG + 实体识别 |

---

## 八、前沿趋势(2026)

1. **多模态融合**:文本+图像+音频统一模型
2. **Agent 自主性**:长期运行,主动规划
3. **MoE 架构**:稀疏激活,高效训练
4. **小模型崛起**:端侧部署(手机/IoT)
5. **上下文长度爆炸**:10M tokens 模型
6. **实时学习**:在线更新知识

---

## 参考资料

- [OpenAI API 文档](https://platform.openai.com/docs)
- [Anthropic Claude 文档](https://docs.anthropic.com/)
- [RAG Interview Questions](https://www.analyticsvidhya.com/blog/2026/02/rag-interview-questions-and-answers/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
