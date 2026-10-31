#!/usr/bin/env python3
"""Xuất VietOCR (vgg_transformer hoặc vgg_seq2seq) sang ONNX để chạy bằng onnxruntime trong bản cài đặt máy tính.

Cách chạy (cần: pip install torch vietocr onnx onnxruntime):
  python3 scripts/ocr-vietocr/export.py --weights vgg_transformer.pth --arch vgg_transformer --out desktop/ocr/models

Kết quả:
  <out>/vietocr-encoder.onnx   ảnh dòng (1×3×32×W) → đặc trưng (T×1×256)  [CNN + transformer encoder]
  <out>/vietocr-decoder.onnx   (tgt_inp L×1, memory T×1×256) → logits (L×1×V)   [transformer decoder, giải mã từng bước]
  <out>/vietocr.json           từ điển ký tự, cấu hình ảnh, tên mô hình, mã băm
Với vgg_seq2seq: encoder trả (memory, hidden); decoder nhận (tgt 1×1, hidden, memory) → (logits, hidden).
Trọng số VietOCR: https://vocr.vn/data/vietocr/vgg_transformer.pth (Apache-2.0, tác giả pbcquoc).
"""
import argparse
import hashlib
import json
import os
import sys

import torch
import yaml

parser = argparse.ArgumentParser()
parser.add_argument('--weights')
parser.add_argument('--arch', default='vgg_transformer', choices=['vgg_transformer', 'vgg_seq2seq'])
parser.add_argument('--config-dir', default=os.path.join(os.path.dirname(__file__), 'config'))
parser.add_argument('--out', default='desktop/ocr/models')
parser.add_argument('--random-init', action='store_true', help='kiểm thử: khởi tạo ngẫu nhiên thay cho --weights (chỉ để kiểm tra luồng xuất/giải mã)')
parser.add_argument('--quantize', choices=['none', 'decoder', 'all'], default='decoder', help='lượng tử hóa int8: decoder (mặc định — nhỏ hơn, nhanh hơn, độ chính xác gần như fp32), all (nhỏ ~4 lần nhưng bộ mã hóa CNN mất ~1 điểm % ký tự), none')
args = parser.parse_args()

from vietocr.model.transformerocr import VietOCR  # noqa: E402
from vietocr.model.vocab import Vocab  # noqa: E402

base = yaml.safe_load(open(os.path.join(args.config_dir, 'base.yml'), encoding='utf-8'))
spec = yaml.safe_load(open(os.path.join(args.config_dir, f"{args.arch.replace('_', '-')}.yml"), encoding='utf-8'))
cfg = {**base, **spec}
cfg['cnn'] = {**cfg['cnn'], 'pretrained': False}  # trọng số nạp từ --weights, không tải VGG từ Internet
vocab = Vocab(cfg['vocab'])
model = VietOCR(len(vocab), cfg['backbone'], cfg['cnn'], cfg['transformer'], cfg['seq_modeling'])
if args.random_init:
    torch.manual_seed(0)
else:
    if not args.weights:
        sys.exit('Cần --weights <vgg_transformer.pth> (hoặc --random-init để kiểm thử)')
    state = torch.load(args.weights, map_location='cpu')
    model.load_state_dict(state, strict=True)
model.eval()
os.makedirs(args.out, exist_ok=True)
H = cfg['dataset']['image_height']


import math  # noqa: E402

import torch.nn.functional as F  # noqa: E402

# Transformer của VietOCR được viết lại bằng các phép nhân ma trận thường (không dùng nn.MultiheadAttention): bộ xuất
# TorchScript cố định độ dài chuỗi của MultiheadAttention thành hằng số nên ảnh rộng khác sẽ lỗi Reshape khi chạy.
# Kết quả được so với mô hình gốc trước khi xuất (sai số < 1e-4).


def attention(q_in, k_in, v_in, mod, mask=None):
    E = mod.embed_dim
    h = mod.num_heads
    d = E // h
    W, b = mod.in_proj_weight, mod.in_proj_bias
    q = F.linear(q_in, W[:E], b[:E])
    k = F.linear(k_in, W[E : 2 * E], b[E : 2 * E])
    v = F.linear(v_in, W[2 * E :], b[2 * E :])
    L, N = q.shape[0], q.shape[1]
    S = k.shape[0]
    q = q.reshape(L, N * h, d).transpose(0, 1)
    k = k.reshape(S, N * h, d).transpose(0, 1)
    v = v.reshape(S, N * h, d).transpose(0, 1)
    att = torch.bmm(q, k.transpose(1, 2)) / math.sqrt(d)
    if mask is not None:
        att = att + mask
    att = torch.softmax(att, dim=-1)
    out = torch.bmm(att, v).transpose(0, 1).reshape(L, N, E)
    return mod.out_proj(out)


def enc_layer(x, l):
    x = l.norm1(x + attention(x, x, x, l.self_attn))
    return l.norm2(x + l.linear2(F.relu(l.linear1(x))))


def dec_layer(x, mem, l, mask):
    x = l.norm1(x + attention(x, x, x, l.self_attn, mask))
    x = l.norm2(x + attention(x, mem, mem, l.multihead_attn))
    return l.norm3(x + l.linear2(F.relu(l.linear1(x))))


class Encoder(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, img):
        # Viết lại Vgg.forward với chỉ số chiều dương: bản gốc dùng permute(-1, 0, 1) → onnxruntime từ chối đồ thị.
        v = self.m.cnn.model
        x = v.last_conv_1x1(v.dropout(v.features(img)))  # (N, C, H, W)
        src = x.transpose(2, 3).flatten(2).permute(2, 0, 1)  # (T=W·H, N, C)
        t = self.m.transformer
        if cfg['seq_modeling'] != 'transformer':
            memory, hidden = t.forward_encoder(src)
            return memory, hidden
        x = t.pos_enc(src * math.sqrt(t.d_model))
        for l in t.transformer.encoder.layers:
            x = enc_layer(x, l)
        return t.transformer.encoder.norm(x)


class Decoder(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, tgt, memory, hidden=None):
        t = self.m.transformer
        if cfg['seq_modeling'] != 'transformer':
            out, hidden, _ = t.forward_decoder(tgt, memory, hidden)
            return out, hidden
        L = tgt.shape[0]
        mask = torch.triu(torch.full((L, L), float('-inf'), dtype=memory.dtype), diagonal=1)
        x = t.pos_enc(t.embed_tgt(tgt) * math.sqrt(t.d_model))
        for l in t.transformer.decoder.layers:
            x = dec_layer(x, memory, l, mask)
        x = t.transformer.decoder.norm(x)
        return t.fc(x.transpose(0, 1)).transpose(0, 1)  # (L, N, V)


# Tắt đường tắt MultiheadAttention (fastpath) khi xuất: nó cố định độ dài chuỗi thành hằng số, ảnh rộng khác sẽ lỗi Reshape.
torch.backends.mha.set_fastpath_enabled(False)
enc = Encoder(model)
dec = Decoder(model)
img = torch.randn(1, 3, H, 256)
if cfg['seq_modeling'] == 'transformer':
    with torch.no_grad():
        ref_mem = model.transformer.forward_encoder(model.cnn(img))
        my_mem = enc(img)
        tgt0 = torch.tensor([[1, 5, 7]], dtype=torch.long).T
        ref_out, _ = model.transformer.forward_decoder(tgt0, ref_mem)
        my_out = dec(tgt0, my_mem)
    d1 = (ref_mem - my_mem).abs().max().item()
    d2 = (ref_out.transpose(0, 1) - my_out).abs().max().item()
    print(f'Sai số so với mô hình gốc: bộ mã hóa {d1:.2e}, bộ giải mã {d2:.2e}')
    assert d1 < 1e-3 and d2 < 1e-3, 'bản viết lại khác mô hình gốc'
with torch.no_grad():
    if cfg['seq_modeling'] == 'transformer':
        torch.onnx.export(enc, img, os.path.join(args.out, 'vietocr-encoder.onnx'), input_names=['img'], output_names=['memory'], dynamic_axes={'img': {3: 'W'}, 'memory': {0: 'T'}}, opset_version=14, dynamo=False)
        memory = enc(img)
        tgt = torch.tensor([[1]], dtype=torch.long).T  # (L=1, N=1)
        torch.onnx.export(dec, (tgt, memory), os.path.join(args.out, 'vietocr-decoder.onnx'), input_names=['tgt', 'memory'], output_names=['logits'], dynamic_axes={'tgt': {0: 'L'}, 'memory': {0: 'T'}, 'logits': {0: 'L'}}, opset_version=14, dynamo=False)
    else:
        torch.onnx.export(enc, img, os.path.join(args.out, 'vietocr-encoder.onnx'), input_names=['img'], output_names=['memory', 'hidden'], dynamic_axes={'img': {3: 'W'}, 'memory': {0: 'T'}}, opset_version=14, dynamo=False)
        memory, hidden = enc(img)
        tgt = torch.tensor([[1]], dtype=torch.long)
        torch.onnx.export(dec, (tgt, memory, hidden), os.path.join(args.out, 'vietocr-decoder.onnx'), input_names=['tgt', 'memory', 'hidden'], output_names=['logits', 'hidden_out'], dynamic_axes={'memory': {0: 'T'}}, opset_version=14, dynamo=False)

if args.quantize != 'none':
    from onnxruntime.quantization import QuantType, quantize_dynamic

    for n in ['vietocr-decoder.onnx'] + (['vietocr-encoder.onnx'] if args.quantize == 'all' else []):
        p = os.path.join(args.out, n)
        quantize_dynamic(p, p, weight_type=QuantType.QUInt8)

meta = {
    'arch': args.arch,
    'random_init': bool(args.random_init),
    'quantize': args.quantize,
    'seq_modeling': cfg['seq_modeling'],
    'vocab': cfg['vocab'],
    'pad': 0,
    'go': 1,
    'eos': 2,
    'image_height': H,
    'image_min_width': cfg['dataset']['image_min_width'],
    'image_max_width': cfg['dataset']['image_max_width'],
    'max_seq_length': 128,
    'files': {},
}
for n in ['vietocr-encoder.onnx', 'vietocr-decoder.onnx']:
    p = os.path.join(args.out, n)
    meta['files'][n] = {'sha256': hashlib.sha256(open(p, 'rb').read()).hexdigest(), 'bytes': os.path.getsize(p)}
json.dump(meta, open(os.path.join(args.out, 'vietocr.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('Đã xuất:', json.dumps(meta['files'], indent=1))
