---
layout: post
title: "LangChain vs LlamaIndex — 프로덕션에서 뭘 써야 하나"
date: 2026-05-01
series: "Study"
category: "AI·LLM"
tags: [langchain, llamaindex, rag, llm, python]
description: "두 프레임워크의 철학 차이부터 실제 RAG 구현 시 어떤 상황에 무엇을 선택해야 하는지 직접 써본 경험 기반으로 비교합니다."
pinned: false
read_time: 13
---

## 결론부터

- **문서 Q&A, 지식 베이스** → LlamaIndex
- **에이전트, 복잡한 워크플로우** → LangChain
- **둘 다 필요한 경우** → LlamaIndex 데이터 레이어 + LangChain 에이전트 레이어 조합

---

## 철학의 차이

**LangChain**은 LLM을 "블록"처럼 연결하는 프레임워크입니다. 체인, 에이전트, 메모리 등 다양한 컴포넌트를 조합해서 복잡한 워크플로우를 만드는 게 목적입니다.

**LlamaIndex**는 "데이터를 LLM이 사용할 수 있게 준비하는" 프레임워크입니다. 문서 로딩, 인덱싱, 쿼리 최적화에 집중합니다.

---

## 1. RAG 구현 비교

**LlamaIndex로 RAG 구현:**

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core import Settings
from llama_index.llms.anthropic import Anthropic

Settings.llm = Anthropic(model="claude-sonnet-4-6")

# 문서 로딩 + 인덱싱이 3줄
documents = SimpleDirectoryReader("./docs").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

response = query_engine.query("청킹 전략이 뭔가요?")
print(response)
```

**LangChain으로 같은 RAG 구현:**

```python
from langchain_anthropic import ChatAnthropic
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.chains import RetrievalQA

loader = DirectoryLoader("./docs")
documents = loader.load()

splitter = RecursiveCharacterTextSplitter(chunk_size=500)
chunks = splitter.split_documents(documents)

vectorstore = Chroma.from_documents(chunks, OpenAIEmbeddings())
retriever = vectorstore.as_retriever()

llm = ChatAnthropic(model="claude-sonnet-4-6")
chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)

result = chain.invoke({"query": "청킹 전략이 뭔가요?"})
```

단순 RAG는 LlamaIndex가 훨씬 간결합니다.

---

## 2. 에이전트 구현 비교

복잡한 에이전트 (여러 도구 사용, 조건 분기)에서는 LangChain이 강합니다.

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.tools import tool

@tool
def search_docs(query: str) -> str:
    """내부 문서에서 검색합니다."""
    return vector_store.similarity_search(query)

@tool
def run_sql(query: str) -> str:
    """데이터베이스를 조회합니다."""
    return db.execute(query)

@tool
def send_slack(message: str) -> str:
    """Slack으로 메시지를 보냅니다."""
    return slack_client.chat_postMessage(message=message)

tools = [search_docs, run_sql, send_slack]
agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

result = executor.invoke({
    "input": "지난 달 매출 데이터를 찾아서 분석하고 팀에 공유해줘"
})
```

에이전트 워크플로우는 LangChain의 생태계가 압도적으로 풍부합니다.

---

## 3. 프로덕션에서 겪은 문제

**LangChain:**
- 버전 업데이트가 잦고 API가 자주 바뀜 (`langchain` → `langchain-core` → `langchain-community` 분리)
- 추상화 레이어가 두꺼워서 디버깅이 어려움
- 단순 RAG에는 오버엔지니어링 느낌

**LlamaIndex:**
- 문서 이외의 용도(에이전트, 체인)에는 적합하지 않음
- 커뮤니티가 LangChain보다 작음
- 고급 기능 문서화가 부족한 경우 있음

---

## 최종 선택 가이드

```python
def choose_framework(use_case):
    if use_case in ["document_qa", "knowledge_base", "rag"]:
        return "LlamaIndex"  # 데이터 레이어에 최적화

    elif use_case in ["agent", "workflow", "multi_tool"]:
        return "LangChain"   # 워크플로우 오케스트레이션에 최적화

    elif use_case == "complex_rag_with_agents":
        return "LlamaIndex + LangChain"  # 조합 사용
```
