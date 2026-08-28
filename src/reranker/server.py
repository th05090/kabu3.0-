import logging
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from sentence_transformers import CrossEncoder

import torch

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Japanese BGE Reranker API")

# モデルのロード (グローバル変数として保持)
# 初回起動時にHuggingFaceからモデルがダウンロードされます。
model_name = "hotchpotch/japanese-bge-reranker-v2-m3-v1"
logger.info(f"Loading model: {model_name} on CUDA...")
try:
    model = CrossEncoder(model_name, device="cuda")
    # RTX 5080 (sm_120) などでCUDAカーネルエラーが出ないかテスト推論を行う
    model.predict([["test", "test"]])
    logger.info("Model loaded successfully on CUDA.")
except Exception as e:
    logger.error(f"Failed to load or run model on CUDA: {e}")
    logger.info("Falling back to CPU...")
    model = CrossEncoder(model_name, device="cpu")
    logger.info("Model loaded on CPU as fallback.")

class RerankRequest(BaseModel):
    query: str
    documents: List[str]

@app.post("/rerank")
def rerank(request: RerankRequest):
    if not request.documents:
        return {"scores": []}
        
    # queryとdocumentのペアのリストを作成
    pairs = [[request.query, doc] for doc in request.documents]
    
    # 生のLogit（-10.0~+10.0前後）をそのまま返すために、Sigmoid変換をバイパスする
    scores = model.predict(pairs, activation_fn=torch.nn.Identity())
    
    # JSONシリアライズ可能なように float 型のリストに変換して返却
    return {"scores": scores.tolist()}
